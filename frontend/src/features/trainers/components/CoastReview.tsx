import type { CoastFitKind, RpmPoint } from '../../../shared/api/types';
import { Button, ErrorText, GhostButton, Hint } from '../../../shared/ui/controls';
import { FIT_OPTIONS } from '../utils/fit-label';
import { RpmChart } from './RpmChart';

interface CoastReviewProps {
  measured: RpmPoint[];
  fitted: RpmPoint[];
  fitKind: CoastFitKind | null;
  inertiaMissing: boolean;
  canConfirm: boolean;
  isFitting: boolean;
  isConfirming: boolean;
  error: string | null;
  onSelect: (kind: CoastFitKind) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CoastReview({
  measured,
  fitted,
  fitKind,
  inertiaMissing,
  canConfirm,
  isFitting,
  isConfirming,
  error,
  onSelect,
  onConfirm,
  onCancel,
}: CoastReviewProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        This is the coast from the moment pedaling stopped until the wheel reached 0 rpm. Choose the curve that follows
        it.
      </p>
      <RpmChart measured={measured} fitted={fitted} />
      <div className="flex flex-wrap gap-2">
        {FIT_OPTIONS.map((option) => (
          <GhostButton
            key={option.kind}
            className={fitKind === option.kind ? 'ring-2 ring-signal' : ''}
            disabled={isFitting}
            onClick={() => onSelect(option.kind)}
          >
            {option.label}
          </GhostButton>
        ))}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!canConfirm && !inertiaMissing && !error ? <Hint>Choose a fit before saving this curve.</Hint> : null}
      {inertiaMissing ? (
        <ErrorText>Save the moment of inertia for this bike on this trainer before using this fit.</ErrorText>
      ) : null}
      <div className="flex gap-3">
        <Button disabled={!canConfirm || isConfirming} onClick={onConfirm}>
          Use this fit
        </Button>
        <GhostButton onClick={onCancel}>Discard</GhostButton>
      </div>
    </div>
  );
}
