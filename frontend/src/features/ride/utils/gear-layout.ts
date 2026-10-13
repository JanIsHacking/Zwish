export type ShiftDirection = -1 | 1;

export function chainringsLeftToRight(teeth: number[]): number[] {
  return [...teeth].sort((left, right) => left - right);
}

export function cogsLeftToRight(teeth: number[]): number[] {
  return [...teeth].sort((left, right) => right - left);
}

export function nextInOrder(ordered: number[], current: number | null, direction: ShiftDirection): number | null {
  const index = current === null ? -1 : ordered.indexOf(current);
  return nextByIndex(ordered, index, direction);
}

export function nextResistanceId(
  levels: { id: string; sortOrder: number }[],
  activeId: string | null,
  direction: ShiftDirection,
): string | null {
  const ordered = [...levels].sort((left, right) => left.sortOrder - right.sortOrder);
  const index = activeId === null ? -1 : ordered.findIndex((level) => level.id === activeId);
  return nextByIndex(ordered, index, direction)?.id ?? null;
}

function nextByIndex<T>(items: T[], index: number, direction: ShiftDirection): T | null {
  if (items.length === 0) {
    return null;
  }
  const start = index < 0 ? 0 : index;
  const nextIndex = Math.min(items.length - 1, Math.max(0, start + direction));
  if (nextIndex === index) {
    return null;
  }
  return items[nextIndex] ?? null;
}
