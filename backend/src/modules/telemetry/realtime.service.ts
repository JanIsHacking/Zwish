import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { IncomingMessage, Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { SESSION_COOKIE } from '../../common/auth/password';
import {
  ClockOffset,
  emptyClock,
  epochUs,
  observePong,
  recordedAtFromMono,
} from '../../domain/clock';
import { rideHasStopped } from '../../domain/wheel-hold';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { snapDisplay } from '../rides/ride-display';
import { RideRegistry } from '../rides/ride-registry';
import { RideState } from '../rides/ride-state';
import { buildSnapshot } from '../rides/snapshot';
import { WorkoutsService } from '../workouts/workouts.service';
import { DevicePresence } from './device-presence';
import { ActivationBus } from './activation-bus';
import { SampleGate } from './sample-gate';

interface DeviceLink {
  trainerId: string;
  clock: ClockOffset;
  ping: NodeJS.Timeout;
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly live = new Set<{ socket: WebSocket; userId: string }>();
  private readonly devices = new Map<WebSocket, DeviceLink>();
  private readonly tails = new Map<WebSocket, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly rides: RideRegistry,
    private readonly workouts: WorkoutsService,
    private readonly presence: DevicePresence,
    private readonly bus: ActivationBus,
    private readonly gate: SampleGate,
  ) {}

  attach(server: Server): void {
    const deviceServer = new WebSocketServer({ noServer: true });
    const liveServer = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/api/v1/devices/stream') {
        deviceServer.handleUpgrade(request, socket, head, (ws) => {
          void this.onDevice(ws, url.searchParams.get('deviceId'));
        });
        return;
      }
      if (url.pathname === '/api/v1/live') {
        liveServer.handleUpgrade(request, socket, head, (ws) => {
          void this.onLive(ws, request);
        });
        return;
      }
      socket.destroy();
    });
    this.timer = setInterval(() => this.tick(), 250);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    for (const link of this.devices.values()) {
      clearInterval(link.ping);
    }
  }

  private async onDevice(socket: WebSocket, deviceId: string | null): Promise<void> {
    if (!deviceId) {
      this.logger.warn('device connection missing an id');
      socket.close(4400, 'device id required');
      return;
    }
    const trainer = await this.prisma.trainer.findUnique({
      where: { deviceId: deviceId.toLowerCase() },
    });
    if (!trainer) {
      this.logger.warn(`rejected unknown device ${deviceId}`);
      socket.close(4404, 'unknown device');
      return;
    }
    this.logger.log(`device online ${deviceId}`);
    const link: DeviceLink = {
      trainerId: trainer.id,
      clock: emptyClock(),
      ping: setInterval(() => this.send(socket, { type: 'ping', serverUs: epochUs() }), 30_000),
    };
    this.devices.set(socket, link);
    this.presence.connect(trainer.id);
    this.send(socket, { type: 'ping', serverUs: epochUs() });
    socket.on('message', (raw) => {
      this.enqueue(socket, () => this.onDeviceMessage(socket, link, raw.toString()));
    });
    socket.on('close', () => {
      clearInterval(link.ping);
      this.devices.delete(socket);
      this.tails.delete(socket);
      this.presence.disconnect(link.trainerId);
    });
  }

  private async onLive(socket: WebSocket, request: IncomingMessage): Promise<void> {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const user = token ? await this.auth.userFromToken(token) : null;
    if (!user) {
      socket.close(4401, 'login required');
      return;
    }
    const client = { socket, userId: user.id };
    this.live.add(client);
    const ride = this.rides.getByUser(user.id);
    if (ride) {
      this.send(socket, { type: 'snapshot', snapshot: buildSnapshot(ride, Date.now()) });
    }
    socket.on('close', () => this.live.delete(client));
  }

  private async onDeviceMessage(socket: WebSocket, link: DeviceLink, raw: string): Promise<void> {
    const message = parseMessage(raw);
    if (!message) {
      return;
    }
    if (message.type === 'pong') {
      link.clock = observePong(link.clock, {
        serverPingUs: message.serverUs,
        serverRecvUs: epochUs(),
        monoUs: message.monoUs,
        nowMs: Date.now(),
      });
      return;
    }
    if (link.clock.offsetUs === null) {
      link.clock = { ...link.clock, offsetUs: epochUs() - message.monoUs };
    }
    const recordedAt = recordedAtFromMono(message.monoUs, link.clock.offsetUs ?? 0);
    if (!this.gate.accept(link.trainerId, message.seq)) {
      this.send(socket, { type: 'ack', seq: message.seq });
      return;
    }
    try {
      this.bus.emit({
        trainerId: link.trainerId,
        seq: message.seq,
        monoUs: message.monoUs,
        recordedAt,
        revCount: message.revCount,
        dtUs: message.dtUs,
        hrBpm: message.hrBpm,
      });
    } catch (error) {
      this.gate.revert(link.trainerId, message.seq);
      const detail = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`activation was not applied: ${detail}`);
      return;
    }
    this.send(socket, { type: 'ack', seq: message.seq });
  }

  private tick(): void {
    const now = Date.now();
    for (const ride of this.rides.all()) {
      this.releaseStoppedWheel(ride, now);
      const snapshot = buildSnapshot(ride, now);
      if (snapshot.finished && (ride.kind === 'planned' || ride.kind === 'zone_test') && !ride.stopping) {
        ride.stopping = true;
        void this.workouts.stop(ride.userId, ride.workoutId).catch(() => {
          ride.stopping = false;
        });
      }
    }
    for (const client of this.live) {
      if (client.socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      const ride = this.rides.getByUser(client.userId);
      if (!ride) {
        continue;
      }
      this.send(client.socket, { type: 'snapshot', snapshot: buildSnapshot(ride, now) });
    }
  }

  private releaseStoppedWheel(ride: RideState, nowMs: number): void {
    if (!rideHasStopped(ride.lastSampleAtMs, nowMs, ride.lastDtUs)) {
      return;
    }
    snapDisplay(ride);
  }

  private enqueue(socket: WebSocket, job: () => Promise<void>): void {
    const previous = this.tails.get(socket) ?? Promise.resolve();
    const next = previous.then(job).catch(() => undefined);
    this.tails.set(socket, next);
  }

  private send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

interface SampleMessage {
  type: 'sample';
  seq: number;
  monoUs: number;
  revCount: number;
  dtUs: number;
  hrBpm: number | null;
}

interface PongMessage {
  type: 'pong';
  serverUs: number;
  monoUs: number;
}

function parseMessage(raw: string): SampleMessage | PongMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.type === 'pong' &&
    typeof record.serverUs === 'number' &&
    typeof record.monoUs === 'number'
  ) {
    return { type: 'pong', serverUs: record.serverUs, monoUs: record.monoUs };
  }
  if (
    record.type === 'sample' &&
    typeof record.seq === 'number' &&
    typeof record.monoUs === 'number' &&
    typeof record.revCount === 'number' &&
    typeof record.dtUs === 'number'
  ) {
    return {
      type: 'sample',
      seq: record.seq,
      monoUs: record.monoUs,
      revCount: record.revCount,
      dtUs: record.dtUs,
      hrBpm: typeof record.hrBpm === 'number' ? record.hrBpm : null,
    };
  }
  return null;
}
