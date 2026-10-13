interface StopConfirmProps {
  isZoneTest: boolean;
  isPending: boolean;
  onKeep: () => void;
  onStop: () => void;
}

export function StopConfirm({ isZoneTest, isPending, onKeep, onStop }: StopConfirmProps) {
  return (
    <div className="rounded-2xl border border-over bg-panel px-4 py-4">
      <p className="text-lg">
        {isZoneTest ? 'Stopping now cancels this test. No result will be saved.' : 'Stop this workout?'}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <button
          className="rounded-full bg-over px-5 py-3 text-lg text-ink disabled:opacity-40"
          disabled={isPending}
          onClick={onStop}
          type="button"
        >
          {isPending ? 'Stopping…' : isZoneTest ? 'Cancel test' : 'Stop'}
        </button>
        <button
          className="rounded-full border border-line px-5 py-3 text-lg disabled:opacity-40"
          disabled={isPending}
          onClick={onKeep}
          type="button"
        >
          Keep riding
        </button>
      </div>
    </div>
  );
}
