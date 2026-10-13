import type { LiveSnapshot } from '../../../shared/api/types';
import { formatWatts } from '../../../shared/utils/format';
import { POWER_TRACE_WINDOW_MS, traceGeometry, type PowerSample } from '../utils/power-trace';

const SCALE = 100;
const WINDOW_SECONDS = POWER_TRACE_WINDOW_MS / 1000;
const SECOND_MARKS = [30, 20, 10, 0];

interface PowerTraceProps {
  samples: PowerSample[];
  snapshot: LiveSnapshot | null;
}

export function PowerTrace({ samples, snapshot }: PowerTraceProps) {
  const nowMs = samples.at(-1)?.atMs ?? 0;
  const band =
    snapshot && snapshot.targetKind !== 'heart_rate' && snapshot.zoneLow !== null && snapshot.zoneHigh !== null
      ? { low: snapshot.zoneLow, high: snapshot.zoneHigh }
      : null;
  const target =
    snapshot?.targetKind === 'watts'
      ? snapshot.targetWatts
      : snapshot?.targetKind === 'power' && snapshot.zoneHigh === null
        ? snapshot.zoneLow
        : null;
  const geometry = traceGeometry(samples, nowMs, SCALE, SCALE, band, target);
  const livePower = samples.at(-1)?.powerW ?? null;

  return (
    <section aria-label={`Power over the last ${WINDOW_SECONDS} seconds`}>
      <div className="relative h-40 rounded-2xl bg-panel py-3 pr-24 pl-3">
        <div className="relative h-full">
          {geometry?.ticks.map((tick) => (
            <div key={tick.watts} className="absolute -right-24 left-0 border-t border-line/70" style={{ top: `${tick.y}%` }}>
              <span className="num absolute left-0 -translate-y-full text-sm leading-tight text-muted">{tick.watts} W</span>
            </div>
          ))}
          <svg
            viewBox={`0 0 ${SCALE} ${SCALE}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            {geometry?.band ? (
              <rect x="0" y={geometry.band.y} width={SCALE} height={geometry.band.height} className="fill-paper" opacity="0.1" />
            ) : null}
            {geometry && geometry.targetY !== null ? (
              <line
                x1="0"
                x2={SCALE}
                y1={geometry.targetY}
                y2={geometry.targetY}
                className="stroke-signal"
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {geometry ? (
              <polyline
                fill="none"
                className="stroke-signal"
                strokeWidth="3"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={geometry.line}
              />
            ) : null}
          </svg>
          {geometry && livePower !== null ? (
            <span
              className="num pointer-events-none absolute left-full ml-2 -translate-y-1/2 rounded-lg bg-signal px-2 text-3xl leading-snug whitespace-nowrap text-ink"
              style={{ top: `${geometry.lastY}%` }}
            >
              {formatWatts(livePower)} W
            </span>
          ) : null}
          {!geometry ? (
            <p className="absolute inset-0 flex items-center justify-center text-muted">waiting for power</p>
          ) : null}
        </div>
      </div>
      <div className="relative mt-1 mr-24 ml-3 h-5">
        {SECOND_MARKS.map((seconds) => (
          <span
            key={seconds}
            className={`num absolute text-sm text-muted ${seconds === WINDOW_SECONDS ? '' : seconds === 0 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${((WINDOW_SECONDS - seconds) / WINDOW_SECONDS) * 100}%` }}
          >
            {seconds === 0 ? 'now' : `−${seconds} s`}
          </span>
        ))}
      </div>
    </section>
  );
}
