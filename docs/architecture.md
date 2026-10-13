# Zwish architecture

Home indoor trainer. A wheel magnet and hall sensor sit on the bike in the basement. An ESP32 times the pulses and optionally reads a BLE heart-rate strap. It streams samples to a NestJS server on the Intel NUC upstairs. A laptop in the basement is the browser UI. Postgres stores users, equipment, curves, workouts, and every wheel revolution.

Power is derived on the server from wheel speed and the selected resistance curve. Curves can change without reflashing the sensor. Stored wheel speed is the source of truth, so a later refit can recompute watts. Absolute watts are optional (Zwish watts until a scale factor is set).

## Computation split

| Work | Where | Why |
| --- | --- | --- |
| Magnet intervals, revolution count | ESP32 `esp_timer` | Microsecond spacing. WiFi delay must not change RPM. |
| Optional BLE heart rate | ESP32 | The strap is in the basement. The NUC is too far for BLE. |
| Short replay buffer | ESP32 RAM | A dropout is replayed with the original timestamps. |
| Device id | ESP32 NVS | Unguessable UUID. Ingest credential. Not a user. |
| UTC label for each sample | NUC, from ESP monotonic time | One offset maps `monoUs` onto the NUC clock. |
| Cadence, speed, distance, power | NUC | Needs the rider's gears, resistance, bike, and curve. |
| Every wheel revolution, 1 Hz ride chart, full-rate coast-down | NUC | The activation log is the physics record. The ride chart is a one-second downsample. |
| Workout segment clock | NUC | Minutes-long. Keeps advancing if the laptop or sensor drops. |
| Login, plans, zone display, gear and resistance selection | Laptop | Intent and presentation only. |

Cadence while the freehub is engaged:

```
cadenceRpm = wheelRpm * (cogTeeth / chainringTeeth)
```

Trainer power depends on rear-wheel speed and resistance level, not on the gear. Gears are how the rider holds a cadence at a given wheel speed. Resistance and gears are manual. The app records what the rider selected.

Speed and distance use wheel circumference:

```
speedMps = wheelRpm / 60 * (circumferenceMm / 1000)
```

Every revolution is stored as a trainer activation (`seq`, `monoUs`, `revCount`, `dtUs`), whether or not a workout is running. Rpm stays `deltaRevs / dtUs` from the ESP. If that interval is already longer than the ride hold, the edge only opens the next interval: it adds no distance and no rpm. The following edge is the first revolution of the new interval, unless it too lasts longer than the hold cap (8 seconds).

During a ride, average power, cadence, and heart rate are time-weighted means of every closed revolution. The 1 Hz workout sample is the history chart, a downsample of those same revolutions.

The ride screen does not read the database. Power, cadence, speed, and wheel rpm pass through a 3 second time-constant moving average, and the live socket sends that held value four times a second. The screen keeps that value until no pulse has arrived for three times the last gap plus 2.5 seconds (at least 3 seconds, at most 8). Silence is time since the server received the last pulse, so the extra 2.5 seconds covers a short Wi-Fi stall, and the factor covers a much slower next revolution. A 1.5× window clamped to 0.8–3 seconds was snapping the average to 0 before that pulse arrived, then discarding the pulse, so power stayed at 0 until the revolution after it. When the ride hold does expire, the numbers snap to 0 and the moving average is dropped so the next effort starts clean. Coast-down still ends on the shorter stop check (1.5× the last gap, between 0.8 and 3 seconds), so that capture closes once the wheel is actually quiet.

### Why ESP32, not a Pi

Pulse timing, WiFi, and BLE are a microcontroller job. A Pi adds boot time, SD-card failure, and power draw without taking computation off the server. A Pi with a USB ANT+ stick is only a fallback if the chest strap is ANT+-only (see roadmap).

### Heart rate

Modern Garmin straps (HRM-Dual, HRM-Pro, HRM-Pro Plus, HRM 200) advertise the standard BLE Heart Rate service. The ESP32 connects as a central and forwards bpm on the same stream. Confirm once with a phone BLE scanner. Older ANT+-only straps stay on the watch for the MVP. ANT+ from the upstairs NUC will not reach the basement.

## Sample time

Two clocks.

**Spacing (physics).** RPM, coast-down deceleration, and distance use only `dtUs` and `monoUs` measured on the ESP32. A sample that arrives late still occupies its original slot. Subtracting NUC arrival times would turn WiFi jitter into a false wheel speed. At one magnet and a 250 ms revolution, 20 ms of jitter is about an 8% RPM error.

**Labels (timeline).** `recordedAt` is when the ESP32 generated the sample. The NUC is the time server (its OS clock is the household UTC). On connect, and every few minutes, a short exchange estimates:

```
utc = monoUs + offset
```

Prefer the lowest round trip so a WiFi spike does not move the offset. The ESP32 does not call public NTP. A stepped wall clock is never subtracted to produce `dt`.

**Workout segments** stay on the NUC clock. They are not derived from packet spacing.

Ingest messages:

```json
{ "type": "sample", "seq": 12, "monoUs": 1000000, "revCount": 4, "dtUs": 250000, "hrBpm": 142 }
{ "type": "sync", "seq": 13, "monoUs": 1005000 }
```

The server answers sync with `{ "type": "sync-ack", "monoUs": 1005000, "serverUs": 1710000000000000 }`. The device can ignore the ack; the server updates the offset from the lowest recent RTT (arrival time minus `monoUs`, refined by half the round trip when the device echoes a server ping). Implementation: the server sends `{ "type": "ping", "serverUs" }` every 30 s; the device replies `{ "type": "pong", "serverUs", "monoUs" }`. Offset is `serverUs + rtt/2 - monoUs` at the lowest RTT in the window.

## Power curves

Every ride sample stores raw `wheelRpm`, resistance level, and gear teeth, plus derived watts. History can be recomputed from raw speed.

Runtime curve: ordered knots `{ wheelRpm, watts }` per trainer, bike, and resistance level, linearly interpolated, then multiplied by the trainer `powerScale` (default 1). The knots are `I * ω * |α|` from the active coast-down fit. Unanchored results are Zwish watts until `powerScale` is set from a known point.

### Coast-down (MVP calibration)

A curve belongs to one trainer and one bike. A different wheel on the same trainer is a different calibration. Moment of inertia `I` is estimated once for that pair. Resistance levels are numbered 1…n, with n from 1 to 15.

For one level the rider enters rear tire pressure in bar and starts. The screen shows the last 30 seconds of wheel rpm. The rider accelerates to the target rpm and holds it for 5 seconds. The UI then counts down from 3 to 0. At 0 the rider stops pedaling. The capture is the samples from that moment until the wheel first reads 0 rpm.

The rider picks a fit of rpm against time: straight line, exponential decay, or quadratic. The fit is drawn on the measured coast. Confirming stores it. Differentiating the fit gives `α` at each rpm, and the power knots are `I * ω * |α|`. `powerScale` still applies at read and record time.

```
P = I * ω * |α|
```

Pressure is stored on the capture. The trainer page shows the measured coast and the fit on one graph. Recalibrate when rear pressure or roller tension changes. Captures stay immutable. The active curve is a derived version.

## Accounts

Heart rate, zone tests, and workout history are health data. The app is not open on the LAN.

- Empty database: the API refuses to boot unless `ADMIN_PASSWORD` is set. It seeds one admin (`ADMIN_USERNAME`, default `admin`) with an argon2id hash. Seeding runs only when no admin exists. The password is not logged and lives only in the NUC `.env`.
- That account is the only admin. The admin can create and delete riders (name and password). No second admin, no self-signup, no deleting the admin. Deleting a rider deletes their bikes, plans, workouts, samples, and zone tests.
- Login sets an httpOnly session cookie. UI, REST, and the live socket require it. A rider sees only their own bikes, plans, workouts, and heart rate. The admin has the same riding data plus the account screen, not other riders' health data.
- Ingest authenticates with the device id and can only append samples.
- The NUC UI, API, and device socket are served over HTTPS with a local CA. The ESP32 trusts that CA. Do not publish the NUC beyond the home LAN.

Trainers, devices, curves, and calibrations are household equipment. Any logged-in rider can use them. Bikes and health data belong to the account.

## Product model

- **User** — name, password hash, role (`admin` or `rider`), optional FTP, optional heart-rate zone bounds.
- **Bike** — wheel circumference (mm), ordered chainring teeth, ordered cog teeth. Owned by one user.
- **Trainer** — name, numbered resistance levels, linked device id, power scale. Household.
- **Trainer and bike** — moment of inertia, and an active coast-down curve per resistance level.
- **Rider setup** — selected trainer, bike, resistance, chainring, cog. Per user. Each sample snapshots the setup.
- **Plan** — sessions on a week index and weekday. A session is ordered segments: duration, target (`power` or `heart_rate` plus zone index), note. No plan editor. A static dummy plan is copied onto each new user.
- **Workout** — free ride, planned session, or zone test. Server clock drives the segment index.
- **Zone test** — ramp or 20-minute, or an FTP typed in by hand. Ramp: 5 min warmup, then +20 W each minute. The rider stops when they cannot hold the target. Power under 90% of the step for 10 seconds ends the test; FTP is 75% of the last fully completed step. 20-minute: 10 min easy, then 20 min as hard as sustainable. FTP is 95% of that window’s average power. Stopping early cancels the run and saves no result. A planned session with power targets requires an FTP. Power zones are Coggan-style percents of FTP. Heart-rate zones are manual bounds.

### Power zones (percent of FTP)

| Zone | Min % | Max % |
| --- | --- | --- |
| 1 | 0 | 55 |
| 2 | 56 | 75 |
| 3 | 76 | 90 |
| 4 | 91 | 105 |
| 5 | 106 | 120 |
| 6 | 121 | 150 |
| 7 | 151 | — |

### Ride screen

Fixed landscape laptop, readable from the bike. Large type and controls.

- Live column: cadence, heart rate, speed in km/h, and distance across the top, each with an icon. Averages sit under cadence, heart rate, and speed. Current power or heart rate, a Push / Ease / Hold cue, the target band, and the zone rail Z1–Z7 with a target bracket and a current marker. A 15-second power trace sits under the rail. Free rides have the rail and no cue.
- Segment title, note, and time left stay on the live side.
- Right column, only as wide as the controls: saddle-view chainrings and cassette (active sprocket white), a resistance ladder from easier to harder, and Stop.

## Stack

- Frontend: React 19, Vite, TypeScript, pnpm, React Router, TanStack Query, Tailwind, react-hook-form, Zod, WebSocket, Vitest.
- Backend: NestJS, Node 22, pnpm, PostgreSQL, Prisma, class-validator, nestjs-pino, WebSockets, argon2, Jest.
- Firmware: Arduino-style ESP32 in `firmware/`.
- Runtime: `docker-compose.yml` — Postgres, API, TLS proxy. `ADMIN_PASSWORD` from the env file.

HTTP base path `/api/v1`. Errors: `{ "error": { "code", "message" } }`. Store UTC. Dev servers may use HTTP on localhost; the compose stack terminates TLS.
