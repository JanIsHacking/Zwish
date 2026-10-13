# Roadmap

Documented so the MVP does not paint them out. Not in scope until a task says so.

## Music

- Sign in with Spotify.
- Pick a playlist by genre (or vibe) and a BPM near the segment's target cadence.
- While riding, save the current track to a dedicated Spotify playlist for later DJ digging.
- Music exploration stays tied to genre or vibe selection.

## Training progress

- Richer history than session averages: weekly load, zone distribution, FTP trend beyond the zone-test list, comparisons across blocks.
- Recompute stored watts from raw wheel speed when a curve or `powerScale` changes, as a deliberate action. Samples already keep raw `wheelRpm`, resistance, and gears so this stays possible.

## Calibration experiments

Coast-down is the MVP. Later sources should emit the same knots `{ wheelRpm, watts }` per resistance level:

- Steady ladder: hold several speeds at each level, with a power meter or the coast-down shape supplying watts.
- Import a published virtual-power table for a known trainer model.

## Heart rate hardware

- If the chest strap is ANT+ only, a basement receiver (for example a Pi with a USB ANT+ stick) can forward bpm. The upstairs NUC cannot hear ANT+.
- The ingest sample already has optional `hrBpm`, so a second forwarder does not change the ride UI.

## Accounts

- The seeded admin is the only admin. Extra admins, password reset, and self-service are out of scope.
- Do not expose the NUC beyond the home LAN. Remote access would need a real identity story, not a port forward.
