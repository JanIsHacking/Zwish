import type { LiveSnapshot } from '../../../shared/api/types';
import { formatWatts } from '../../../shared/utils/format';
import { rideCue, targetBand } from '../utils/ride-cue';
import { toneFromDelta } from '../utils/zone-rail';

const TONE_CLASS = {
  over: 'text-over',
  under: 'text-under',
  in: 'text-inzone',
  idle: 'text-paper',
} as const;

export function ZoneGuide({ snapshot }: { snapshot: LiveSnapshot | null }) {
  const heroIsHr = snapshot?.targetKind === 'heart_rate';
  const unit = heroIsHr ? 'bpm' : 'W';
  const hero = heroIsHr ? (snapshot?.hrBpm ?? null) : (snapshot?.powerW ?? null);
  const cue = snapshot?.targetKind ? rideCue(snapshot.delta, unit) : null;
  const band = snapshot ? targetBand(snapshot) : null;
  const toneClass = TONE_CLASS[toneFromDelta(snapshot?.delta ?? null)];
  const needsCalibration = Boolean(snapshot && !snapshot.calibrated && snapshot.powerW !== null);

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_auto_1fr]">
      <div className="col-start-1 row-start-1 flex items-end">
        {cue ? (
          <p className={`text-3xl ${toneClass}`}>
            {cue.verb}
            {cue.amount !== null ? ` ${cue.amount} ${cue.unit}` : ''}
          </p>
        ) : null}
      </div>
      <p className={`num col-start-1 row-start-2 self-center text-[clamp(5rem,14vh,9rem)] leading-none ${toneClass}`}>
        {formatWatts(hero)}
      </p>
      <div className="col-start-1 row-start-3 pt-2">
        {heroIsHr ? (
          <p className="text-muted">
            <span className="num text-3xl text-paper">{formatWatts(snapshot?.powerW ?? null)}</span>
            <span className="ml-1">W</span>
            <span className="ml-3 text-sm">
              <span className="sr-only">average power </span>
              <span aria-hidden="true">Ø </span>
              {formatWatts(snapshot?.avgPowerW ?? null)} W
            </span>
            {needsCalibration ? <span className="ml-3 text-sm">calibrate this level</span> : null}
          </p>
        ) : (
          <p className="text-sm text-muted">
            <span className="sr-only">average power </span>
            <span aria-hidden="true">Ø </span>
            {formatWatts(snapshot?.avgPowerW ?? null)} W
            {needsCalibration ? ' · calibrate this level' : ''}
          </p>
        )}
        {!snapshot ? <p className="mt-2 text-muted">waiting for the wheel</p> : null}
      </div>
      {band ? (
        <div className="col-start-2 row-start-2 self-center pl-6 text-right">
          {band.zone ? <p className="num text-6xl leading-none">{band.zone}</p> : null}
          {band.range ? <p className="num text-3xl text-muted">{band.range}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
