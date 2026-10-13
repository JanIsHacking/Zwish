/// <reference types="vitest/globals" />
import { chainringsLeftToRight, cogsLeftToRight, nextInOrder, nextResistanceId } from './gear-layout';

describe('gear layout', () => {
  it('puts the small chainring on the left', () => {
    expect(chainringsLeftToRight([50, 34])).toEqual([34, 50]);
  });

  it('puts the large cog on the left', () => {
    expect(cogsLeftToRight([13, 28, 15])).toEqual([28, 15, 13]);
  });

  it('steps along the saddle view and stops at the ends', () => {
    const rings = chainringsLeftToRight([50, 34]);
    expect(nextInOrder(rings, 34, 1)).toBe(50);
    expect(nextInOrder(rings, 50, 1)).toBeNull();
    expect(nextInOrder(rings, 34, -1)).toBeNull();
  });

  it('steps resistance from easier to harder', () => {
    const levels = [
      { id: 'hard', sortOrder: 2 },
      { id: 'easy', sortOrder: 0 },
      { id: 'mid', sortOrder: 1 },
    ];
    expect(nextResistanceId(levels, 'easy', 1)).toBe('mid');
    expect(nextResistanceId(levels, 'hard', 1)).toBeNull();
    expect(nextResistanceId(levels, 'mid', -1)).toBe('easy');
  });
});
