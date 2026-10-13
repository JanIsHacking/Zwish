import { assertOwner, DomainError } from './access';

describe('access', () => {
  it('rejects a rider reading someone else’s workout', () => {
    expect(() => assertOwner('a', 'b')).toThrow(DomainError);
  });
});
