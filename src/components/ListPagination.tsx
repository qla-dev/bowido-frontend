import type { FC } from 'react';
import type { AppLanguage } from '../i18n';

/**
 * Legacy HMR compatibility export. Visible pagination has been replaced by
 * InfiniteScrollFooter; this is intentionally rendered as nothing.
 */
type ListPaginationProps = {
  total: number;
  limit: number;
  offset: number;
  count: number;
  isLoading?: boolean;
  language: AppLanguage;
  onPageChange: (offset: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: readonly number[];
};

export const ListPagination: FC<ListPaginationProps> = () => null;
