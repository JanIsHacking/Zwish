export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertOwner(actorId: string, ownerId: string): void {
  if (actorId !== ownerId) {
    throw new DomainError('FORBIDDEN', 403, 'You cannot access another rider’s data');
  }
}
