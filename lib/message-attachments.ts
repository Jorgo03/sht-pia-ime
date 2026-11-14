import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Files already sent in a chat (components/messaging/message-attachment.tsx).
// Chats are text only since 2026-11-14 (owner): nothing new can be attached,
// but photos and documents sent before still show, from the private bucket
// that only the conversation's two participants can read (migration
// 20261111234947). The bucket and the messages.attachment column stay.

export const ATTACHMENT_BUCKET = 'message-attachments';

/**
 * A link to a sent file, valid for an hour. The bucket is private, so this is
 * the only way to show it; the link is fetched again before it runs out.
 */
export function useAttachmentUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['message-attachment', path ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path as string, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    retry: 1,
  });
}
