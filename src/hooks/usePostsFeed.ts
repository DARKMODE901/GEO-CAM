// src/hooks/usePostsFeed.ts
// Hook de Feed Remoto con paginación por cursor (created_at < último),
// scroll infinito y búsqueda debounced usando TanStack Query v5.

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  fetchRemoteFeedPage,
  type RemoteFeedPage,
  type RemotePhotoFeedItem,
} from '@/services/cloudPhotos';

const PAGE_SIZE = 10;
const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

export function usePostsFeed(userId: string | null | undefined, debouncedSearch = '') {
  const normalizedSearch = debouncedSearch.trim();

  const query = useInfiniteQuery<
    RemoteFeedPage,
    Error,
    { pages: RemoteFeedPage[]; pageParams: (string | null)[] },
    ['posts-feed', string | null | undefined, string],
    string | null
  >({
    queryKey: ['posts-feed', userId, normalizedSearch],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!userId) {
        return { items: [], nextCursor: null };
      }
      return fetchRemoteFeedPage({
        userId,
        cursor: pageParam,
        limit: PAGE_SIZE,
        search: normalizedSearch,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(userId),
    gcTime: SEVEN_DAYS_MS,
    staleTime: 1000 * 30,
  });

  const items: RemotePhotoFeedItem[] = useMemo(() => {
    if (!query.data?.pages) return [];
    const seen = new Set<string>();
    const flattened: RemotePhotoFeedItem[] = [];

    for (const page of query.data.pages) {
      for (const item of page.items) {
        if (!seen.has(item.client_id)) {
          seen.add(item.client_id);
          flattened.push(item);
        }
      }
    }
    return flattened;
  }, [query.data]);

  return {
    items,
    status: query.status,
    fetchStatus: query.fetchStatus,
    error: query.error,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
