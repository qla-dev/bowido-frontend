export type SearchMatchRank = 0 | 1 | 2 | 3;

const wordCharacter = /^[\p{L}\p{N}]$/u;

/**
 * Ranks a matching display value without allocating word arrays:
 * 0 = the complete value starts with the query;
 * 1 = a later word starts with the query;
 * 2 = the query appears elsewhere;
 * 3 = no match.
 */
export const getSearchMatchRank = (value: string, query: string): SearchMatchRank => {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const normalizedValue = value.toLocaleLowerCase();

  if (normalizedValue.startsWith(normalizedQuery)) {
    return 0;
  }

  let matchIndex = normalizedValue.indexOf(normalizedQuery);
  const hasContainsMatch = matchIndex !== -1;
  let hasWordPrefixMatch = false;

  while (matchIndex !== -1) {
    if (!wordCharacter.test(normalizedValue.charAt(matchIndex - 1))) {
      hasWordPrefixMatch = true;
      break;
    }

    matchIndex = normalizedValue.indexOf(normalizedQuery, matchIndex + 1);
  }

  return hasWordPrefixMatch ? 1 : hasContainsMatch ? 2 : 3;
};

/**
 * Filters and groups results in a single pass. Within a match group, their
 * existing order is retained, avoiding repeated comparisons while typing.
 */
export const rankSearchResults = (
  items: readonly any[],
  query: string,
  getDisplayValue: (item: any) => string,
  matchesAdditionalValue?: (item: any, normalizedQuery: string) => boolean,
): any[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [...items];
  }

  const namePrefixMatches: any[] = [];
  const wordPrefixMatches: any[] = [];
  const containsMatches: any[] = [];

  for (const item of items) {
    const rank = getSearchMatchRank(getDisplayValue(item), normalizedQuery);

    switch (rank) {
      case 0:
        namePrefixMatches.push(item);
        break;
      case 1:
        wordPrefixMatches.push(item);
        break;
      case 2:
        containsMatches.push(item);
        break;
      default:
        if (matchesAdditionalValue?.(item, normalizedQuery)) {
          containsMatches.push(item);
        }
    }
  }

  return [...namePrefixMatches, ...wordPrefixMatches, ...containsMatches];
};
