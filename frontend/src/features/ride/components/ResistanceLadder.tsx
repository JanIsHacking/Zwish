import type { ResistanceLevel } from '../../../shared/api/types';
import { nextResistanceId, type ShiftDirection } from '../utils/gear-layout';
import { ShiftButton } from './ShiftButton';

interface ResistanceLadderProps {
  levels: ResistanceLevel[];
  activeId: string | null;
  activeLabel: string | null;
  onShift: (direction: ShiftDirection) => void;
}

export function ResistanceLadder({ levels, activeId, activeLabel, onShift }: ResistanceLadderProps) {
  const ordered = [...levels].sort((left, right) => left.sortOrder - right.sortOrder);
  const canEase = nextResistanceId(ordered, activeId, -1) !== null;
  const canHarden = nextResistanceId(ordered, activeId, 1) !== null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShiftButton label="Less resistance" glyph="‹" enabled={canEase} onClick={() => onShift(-1)} />
        <div className="flex h-20 w-40 items-end gap-0.5" aria-label="Resistance">
          {ordered.map((level, index) => {
            const height = ordered.length === 1 ? 100 : 28 + (index / (ordered.length - 1)) * 72;
            const isActive = level.id === activeId;
            return (
              <div
                key={level.id}
                className={`flex-1 rounded-sm ${isActive ? 'bg-signal' : 'bg-muted/50'}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <ShiftButton label="More resistance" glyph="›" enabled={canHarden} onClick={() => onShift(1)} />
      </div>
      <p className="num mt-2 text-center text-3xl leading-none">{activeLabel ?? '—'}</p>
    </div>
  );
}
