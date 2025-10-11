import { useState, useMemo } from 'react';

export interface PaginationOptions {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startIndex: number;
    endIndex: number;
  };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
}

export function usePagination<T>(
  data: T[],
  initialPageSize: number = 10,
  initialPage: number = 1
): PaginationResult<T> {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const paginatedData = useMemo(() => {
    const total = data?.length || 0;
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = Math.min(page, totalPages) || 1;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    
    const items = data?.slice(startIndex, endIndex) || [];
    
    return {
      items,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        startIndex: total > 0 ? startIndex + 1 : 0,
        endIndex: total > 0 ? endIndex : 0,
      }
    };
  }, [data, page, pageSize]);

  const goToNextPage = () => {
    if (paginatedData.pagination.hasNextPage) {
      setPage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (paginatedData.pagination.hasPreviousPage) {
      setPage(prev => prev - 1);
    }
  };

  const goToFirstPage = () => {
    setPage(1);
  };

  const goToLastPage = () => {
    setPage(paginatedData.pagination.totalPages);
  };

  const handleSetPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= paginatedData.pagination.totalPages) {
      setPage(newPage);
    }
  };

  const handleSetPageSize = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };

  return {
    ...paginatedData,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  };
}