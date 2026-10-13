interface ShiftButtonProps {
  label: string;
  glyph: string;
  enabled: boolean;
  onClick: () => void;
}

export function ShiftButton({ label, glyph, enabled, onClick }: ShiftButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="num flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-line bg-panel-2 pb-1 text-6xl leading-none text-paper active:bg-line disabled:opacity-25"
      disabled={!enabled}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}
