import type { LiveSnapshot } from '../../../shared/api/types';
import { RAIL_BANDS, percentToRail, toneFromDelta, zoneFrame } from '../utils/zone-rail';

const BAND_COLOR = ['#243044', '#2c3b28', '#3d4424', '#4a4420', '#4a341c', '#4a241c', '#4a1c28'];

export function ZoneRail({ snapshot }: { snapshot: LiveSnapshot }) {
  const tone = toneFromDelta(snapshot.delta);
  const marker = markerPosition(snapshot);
  const frame = snapshot.targetZone ? zoneFrame(snapshot.targetZone) : null;
  const targetTick =
    snapshot.targetKind === 'watts' && snapshot.ftpWatts && snapshot.targetWatts !== null
      ? percentToRail((snapshot.targetWatts / snapshot.ftpWatts) * 100)
      : null;

  return (
    <div className="relative">
      <div className="flex h-14 overflow-hidden rounded-2xl">
        {RAIL_BANDS.map((band, index) => (
          <div
            key={band.zone}
            className="flex items-end justify-center pb-1 text-xs text-paper/80"
            style={{
              width: `${percentToRail(band.to) - percentToRail(band.from)}%`,
              background: BAND_COLOR[index] ?? '#333',
            }}
          >
            Z{band.zone}
          </div>
        ))}
      </div>
      {frame ? (
        <div
          className="pointer-events-none absolute top-0 h-14 rounded-xl border-2 border-paper"
          style={{ left: `${frame.left}%`, width: `${frame.width}%` }}
        />
      ) : null}
      {targetTick !== null ? (
        <div className="absolute top-0 h-14 w-0.5 bg-signal" style={{ left: `${targetTick}%` }} />
      ) : null}
      {marker !== null ? (
        <div
          className={`absolute -top-1 h-16 w-1.5 rounded-full ${tone === 'over' ? 'bg-over' : tone === 'under' ? 'bg-under' : 'bg-inzone'}`}
          style={{ left: `calc(${marker}% - 3px)` }}
        />
      ) : null}
    </div>
  );
}

function markerPosition(snapshot: LiveSnapshot): number | null {
  if (snapshot.targetKind === 'heart_rate' && snapshot.hrBpm !== null && snapshot.zoneLow !== null) {
    const low = Math.max(40, snapshot.zoneLow - 20);
    const high = (snapshot.zoneHigh ?? snapshot.zoneLow + 10) + 15;
    return Math.min(100, Math.max(0, ((snapshot.hrBpm - low) / (high - low)) * 100));
  }
  if (snapshot.ftpWatts && snapshot.powerW !== null) {
    return percentToRail((snapshot.powerW / snapshot.ftpWatts) * 100);
  }
  return null;
}
