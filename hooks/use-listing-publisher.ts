import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { fetchPublisher, publisherView } from '@/src/features/properties/lib/publisher';

type Listing = (NonNullable<Parameters<typeof publisherView>[1]> & { id?: string }) | null | undefined;

/** Who published this listing (src/features/properties/lib/publisher.js). */
export function useListingPublisher(property: Listing) {
  const id = property?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['properties', 'publisher', id ?? ''],
    queryFn: () => fetchPublisher(supabase, id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return { ...publisherView(data ?? null, property), loading: isLoading };
}
