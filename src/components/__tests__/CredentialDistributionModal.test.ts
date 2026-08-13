import { describe, expect, it } from 'vitest';
import { toggleVisibleCredentialSelection } from '../CredentialDistributionModal';

describe('credential distribution selection', () => {
  it('select all changes only users visible in the active filter', () => {
    const selected = toggleVisibleCredentialSelection(new Set([99]), [1, 2], false);
    expect([...selected].sort((left, right) => left - right)).toEqual([1, 2, 99]);

    const deselected = toggleVisibleCredentialSelection(selected, [1, 2], true);
    expect([...deselected]).toEqual([99]);
  });
});
