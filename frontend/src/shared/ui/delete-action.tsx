import { useState } from 'react';
import { GhostButton, IconButton } from './controls';
import { TrashIcon } from './icons';

interface DeleteActionProps {
  name: string;
  blockedReason: string | null;
  isPending: boolean;
  detail?: string;
  variant: 'icon' | 'button';
  onDelete: () => void;
}

export function DeleteAction({
  name,
  blockedReason,
  isPending,
  detail,
  variant,
  onDelete,
}: DeleteActionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  if (blockedReason) {
    return (
      <span className="inline-flex items-center" title={blockedReason}>
        {variant === 'icon' ? (
          <IconButton label={blockedReason} disabled>
            <TrashIcon className="h-4 w-4" />
          </IconButton>
        ) : (
          <GhostButton type="button" disabled>
            Delete
          </GhostButton>
        )}
      </span>
    );
  }
  if (!isConfirming) {
    return variant === 'icon' ? (
      <IconButton label={`Delete ${name}`} disabled={isPending} onClick={() => setIsConfirming(true)}>
        <TrashIcon className="h-4 w-4" />
      </IconButton>
    ) : (
      <GhostButton type="button" disabled={isPending} onClick={() => setIsConfirming(true)}>
        Delete
      </GhostButton>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-paper">Delete {name}?</span>
      {detail ? <span className="text-sm text-muted">{detail}</span> : null}
      <GhostButton type="button" className="text-over" disabled={isPending} onClick={onDelete}>
        {isPending ? 'Deleting…' : 'Delete'}
      </GhostButton>
      <button type="button" className="text-sm text-muted hover:text-paper" onClick={() => setIsConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
