# Zwish

Indoor trainer for the basement. An ESP32 times the rear wheel and an optional BLE heart-rate strap. A NestJS server on the NUC derives cadence, speed, distance, and power. The laptop in the basement is only the browser.

See [docs/architecture.md](docs/architecture.md) for where each computation lives, and [docs/roadmap.md](docs/roadmap.md) for later features (Spotify, richer history, other curve sources).

## Develop

```bash
docker compose up -d postgres
```

Backend (`backend/.env`, not committed):

```bash
cd backend
pnpm install
pnpm exec prisma migrate dev
pnpm start:dev
```

`ADMIN_PASSWORD` is required the first time the database is empty. The default username is `admin`. The API listens on `PORT` from `backend/.env` (8001 in the local example, so it does not collide with anything already bound to 8000). The Vite dev server proxies `/api` to that port.

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:5173 and log in. Create a bike and a trainer, paste the ESP32 device id, then start a free ride.

Simulate the sensor after the trainer is registered:

```bash
cd backend
pnpm exec tsx scripts/simulate-device.ts <device-uuid> ride
pnpm exec tsx scripts/simulate-device.ts <device-uuid> coast
```

## NUC

Copy `.env.example` to `.env`, set `ADMIN_PASSWORD`, then:

```bash
docker compose up -d --build
```

The UI is served on https://localhost (a local certificate is created on first start). Trust that certificate on the basement laptop. The ESP32 connects to the same HTTPS port and accepts the certificate.

## Firmware

Open `firmware/Zwish/Zwish.ino` in the Arduino IDE. Install the ESP32 board package and the ArduinoJson and WebSockets libraries, then select the board "ESP32 Dev Module". On first boot the board opens a WiFi setup page and shows the device id to register in the app. The reed switch is between GPIO 32 and GND, falling edge, internal pull-up. GPIO 32 stays a digital input while WiFi is on.
