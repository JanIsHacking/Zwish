import type { PowerCurve, ResistanceLevel } from '../../../shared/api/types';
import { fitLabel } from '../utils/fit-label';
import { RpmChart } from './RpmChart';

export function ActiveCurves({ levels, curves }: { levels: ResistanceLevel[]; curves: PowerCurve[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg">Active curves</h2>
      <ul className="space-y-3">
        {levels.map((level) => {
          const curve = curves.find((item) => item.resistanceLevelId === level.id);
          return (
            <li key={level.id} className="rounded-2xl border border-line p-4">
              <p>
                Level {level.label}
                {curve ? ` · ${curve.tirePressureBar} bar · ${fitLabel(curve.fitKind)}` : ' · not calibrated'}
              </p>
              {curve && curve.measured.length > 1 ? (
                <RpmChart measured={curve.measured} fitted={curve.fitted} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
