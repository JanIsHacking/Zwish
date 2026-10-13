# Coding Standards (shared)

> TypeScript and hygiene rules that apply to **both** frontend and backend.
> Area-specific rules live in `backend/AGENTS.md` and `frontend/AGENTS.md`.
> System architecture (devices, clocks, calibration, accounts) lives in
> [`docs/architecture.md`](docs/architecture.md). Later features live in
> [`docs/roadmap.md`](docs/roadmap.md) and stay out of the MVP unless a task asks for them.

Zwish is a home indoor-trainer app. An ESP32 in the basement times wheel pulses (and optional BLE heart rate) and streams them to a NestJS server on the upstairs NUC. A laptop browser is the only UI. The server derives cadence, speed, distance, and power. The ESP32 owns pulse spacing; the NUC owns users, curves, and the workout clock.

## Repo layout

- `frontend/` — React UI
- `backend/` — NestJS API, WebSockets, Prisma
- `firmware/` — ESP32 sensor firmware
- `docs/` — architecture and roadmap

## TypeScript

- `strict` mode; no `any` (use `unknown` + narrowing). One-line justification required if `any` is
  unavoidable; no `@ts-ignore` without a comment.
- Prefer `interface` over `type` for object shapes.
- Avoid `enum` — use `as const` maps / union types. Prisma's generated enums are the exception.

## Naming & control flow

- Descriptive booleans with auxiliary verbs (`isAuthenticated`, `hasActiveCurve`, `canManageUsers`).
- Early returns and guard clauses; handle errors first; no deep nesting.

## Comments & TODOs

- Comments explain non-obvious intent or trade-offs only — never narrate code.
- TODOs must name the follow-up explicitly (link a roadmap item or say what is left). No orphan TODOs.

## Hygiene

- No dead code or commented-out blocks.
- No `console.log` / `console.debug` in production paths (structured server logs instead).
- No unrelated refactoring bundled into a feature change.
- Prefer extending existing patterns over inventing parallel abstractions; keep changes small and
  reviewable.

## Language

- Source identifiers and comments are **English**. User-visible UI copy is English.

## File size

- No app source file (`.ts` / `.tsx`) may exceed **500 lines** (hard limit). Split by concern before
  approaching the limit. Area docs define tighter per-layer caps where applicable.

## Secrets

- `ADMIN_PASSWORD` and database credentials come from the environment. Never log them, never commit
  `.env`.
