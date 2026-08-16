import { describe, expect, it } from 'vitest';
import { getSearchMatchRank, rankSearchResults } from './searchRanking';

describe('search ranking', () => {
  it('prioritizes full-name prefixes, then word prefixes, then contains matches', () => {
    const results = rankSearchResults(
      ['malaga', 'Laboratory', 'Office Laptop', 'laptop'],
      'la',
      (name) => name,
    );

    expect(results).toEqual(['Laboratory', 'laptop', 'Office Laptop', 'malaga']);
  });

  it('recognizes words separated by punctuation and supports accented characters', () => {
    expect(getSearchMatchRank('Central-laboratory', 'la')).toBe(1);
    expect(getSearchMatchRank('Žuta lampa', 'la')).toBe(1);
    expect(getSearchMatchRank('Malaga', 'la')).toBe(2);
    expect(getSearchMatchRank('Desk', 'la')).toBe(3);
  });
});
