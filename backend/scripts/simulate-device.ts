import WebSocket from 'ws';

const deviceId = process.argv[2];
const mode = process.argv[3] ?? 'ride';
if (!deviceId) {
  process.stderr.write('Usage: tsx scripts/simulate-device.ts <deviceId> [ride|coast]\n');
  process.exit(1);
}

const port = process.env.PORT ?? '8000';
const url =
  process.env.ZWISH_DEVICE_URL ??
  `ws://localhost:${port}/api/v1/devices/stream?deviceId=${deviceId}`;

let revCount = 0;
let monoUs = 0;
let seq = 0;
let rpm = mode === 'coast' ? 230 : 200;
const started = Date.now();
const socket = new WebSocket(url);

socket.on('open', () => {
  process.stdout.write(`connected ${mode}\n`);
  const timer = setInterval(() => {
    const elapsed = (Date.now() - started) / 1000;
    if (mode === 'coast') {
      rpm = elapsed < 16 ? 230 : 230 * Math.exp(-0.18 * (elapsed - 16));
      if (rpm < 8) {
        clearInterval(timer);
        process.stdout.write('coast finished\n');
        socket.close();
        process.exit(0);
      }
    }
    const dtUs = Math.round((60 / Math.max(rpm, 1)) * 1_000_000);
    monoUs += dtUs;
    revCount += 1;
    seq += 1;
    socket.send(
      JSON.stringify({
        type: 'sample',
        seq,
        monoUs,
        revCount,
        dtUs,
        hrBpm: mode === 'ride' ? 142 : null,
      }),
    );
  }, 200);
});

socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString()) as { type?: string; serverUs?: number };
  if (message.type === 'ping' && typeof message.serverUs === 'number') {
    socket.send(JSON.stringify({ type: 'pong', serverUs: message.serverUs, monoUs }));
  }
});

socket.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
