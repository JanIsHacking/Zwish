import { Injectable } from '@nestjs/common';

interface SeqCursor {
  lastSeq: number | null;
}

/** Drops retries of a sequence the server already accepted. A seq of 1 after a later seq is a reboot. */
export function acceptSeq(cursor: SeqCursor, seq: number): boolean {
  if (cursor.lastSeq === null || (seq === 1 && cursor.lastSeq > 1)) {
    cursor.lastSeq = seq;
    return true;
  }
  if (seq <= cursor.lastSeq) {
    return false;
  }
  cursor.lastSeq = seq;
  return true;
}

@Injectable()
export class SampleGate {
  private readonly cursors = new Map<string, SeqCursor>();
  private readonly previousSeq = new Map<string, number | null>();

  accept(trainerId: string, seq: number): boolean {
    const cursor = this.cursors.get(trainerId) ?? { lastSeq: null };
    const before = cursor.lastSeq;
    const accepted = acceptSeq(cursor, seq);
    this.cursors.set(trainerId, cursor);
    if (accepted) {
      this.previousSeq.set(trainerId, before);
    }
    return accepted;
  }

  revert(trainerId: string, seq: number): void {
    const cursor = this.cursors.get(trainerId);
    if (!cursor || cursor.lastSeq !== seq) {
      return;
    }
    cursor.lastSeq = this.previousSeq.get(trainerId) ?? null;
  }
}
