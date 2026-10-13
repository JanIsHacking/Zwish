import { chainringsLeftToRight, cogsLeftToRight, nextInOrder, type ShiftDirection } from '../utils/gear-layout';
import { ShiftButton } from './ShiftButton';

const VIEW_WIDTH = 160;
const VIEW_HEIGHT = 96;
const MAX_SLOT = 28;

interface DrivetrainProps {
  chainringTeeth: number[];
  cogTeeth: number[];
  activeChainring: number | null;
  activeCog: number | null;
  onShiftChainring: (direction: ShiftDirection) => void;
  onShiftCog: (direction: ShiftDirection) => void;
}

export function Drivetrain({
  chainringTeeth,
  cogTeeth,
  activeChainring,
  activeCog,
  onShiftChainring,
  onShiftCog,
}: DrivetrainProps) {
  const rings = chainringsLeftToRight(chainringTeeth);
  const cogs = cogsLeftToRight(cogTeeth);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShiftButton
          label="Smaller chainring"
          glyph="‹"
          enabled={nextInOrder(rings, activeChainring, -1) !== null}
          onClick={() => onShiftChainring(-1)}
        />
        <GearStack teeth={rings} active={activeChainring} label={`Chainring ${activeChainring ?? 'none'}`} />
        <ShiftButton
          label="Larger chainring"
          glyph="›"
          enabled={nextInOrder(rings, activeChainring, 1) !== null}
          onClick={() => onShiftChainring(1)}
        />
      </div>
      <div className="flex items-center gap-2">
        <ShiftButton
          label="Larger cog"
          glyph="‹"
          enabled={nextInOrder(cogs, activeCog, -1) !== null}
          onClick={() => onShiftCog(-1)}
        />
        <GearStack teeth={cogs} active={activeCog} label={`Cog ${activeCog ?? 'none'}`} />
        <ShiftButton
          label="Smaller cog"
          glyph="›"
          enabled={nextInOrder(cogs, activeCog, 1) !== null}
          onClick={() => onShiftCog(1)}
        />
      </div>
      <p className="num text-center text-3xl leading-none">
        <span className="sr-only">Chainring </span>
        {activeChainring ?? '—'}
        <span className="mx-1 text-muted">×</span>
        <span className="sr-only">cog </span>
        {activeCog ?? '—'}
      </p>
    </div>
  );
}

/** Top view along the axle: each sprocket is a plate whose visible length is its diameter. */
function GearStack({ teeth, active, label }: { teeth: number[]; active: number | null; label: string }) {
  const largest = Math.max(...teeth, 1);
  const slot = teeth.length === 0 ? MAX_SLOT : Math.min(MAX_SLOT, VIEW_WIDTH / teeth.length);
  const plate = Math.max(3, slot * 0.6);
  const offset = (VIEW_WIDTH - slot * teeth.length) / 2;
  const axleY = VIEW_HEIGHT / 2;

  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-24 w-40" role="img" aria-label={label}>
      <line x1="0" x2={VIEW_WIDTH} y1={axleY} y2={axleY} className="stroke-line" strokeWidth="4" />
      {teeth.map((count, index) => {
        const height = (count / largest) * (VIEW_HEIGHT - 4);
        const isActive = count === active;
        return (
          <rect
            key={`${count}-${index}`}
            x={offset + slot * index + (slot - plate) / 2}
            y={axleY - height / 2}
            width={plate}
            height={height}
            rx="1.5"
            className={isActive ? 'fill-signal' : 'fill-muted/60'}
          />
        );
      })}
    </svg>
  );
}
