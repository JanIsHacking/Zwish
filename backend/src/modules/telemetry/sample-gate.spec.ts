import { acceptSeq } from './sample-gate';

describe('sample gate', () => {
  it('accepts a new sequence and drops a retry', () => {
    const cursor = { lastSeq: null as number | null };
    expect(acceptSeq(cursor, 4)).toBe(true);
    expect(acceptSeq(cursor, 4)).toBe(false);
    expect(acceptSeq(cursor, 5)).toBe(true);
  });

  it('treats sequence 1 after a later sequence as a device reboot', () => {
    const cursor = { lastSeq: 40 };
    expect(acceptSeq(cursor, 1)).toBe(true);
    expect(acceptSeq(cursor, 2)).toBe(true);
  });

  it('drops an older sequence that is not a reboot', () => {
    const cursor = { lastSeq: 40 };
    expect(acceptSeq(cursor, 39)).toBe(false);
    expect(cursor.lastSeq).toBe(40);
  });
});