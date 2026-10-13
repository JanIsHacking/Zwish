import type { CoastFitKind } from '../../../shared/api/types';

export const FIT_OPTIONS: { kind: CoastFitKind; label: string }[] = [
  { kind: 'linear', label: 'Straight line' },
  { kind: 'exponential', label: 'Exponential decay' },
  { kind: 'quadratic', label: 'Quadratic curve' },
];

export function fitLabel(kind: string): string {
  return FIT_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}
