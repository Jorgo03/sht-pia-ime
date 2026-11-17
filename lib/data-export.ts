import { Platform, Share } from 'react-native';

import { supabase } from '@/lib/supabase';
import { EXPORT_TABLES, MAX_ROWS, PAGE, exportDocument, exportFileName, ownerFilter, stripColumns } from '@/lib/data-export-plan';

type Row = Record<string, unknown>;

async function readAll(table: string, filter: (q: any) => any, omit?: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await filter(supabase.from(table).select('*')).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return stripColumns(rows, omit);
}

/**
 * Everything the service holds about the signed-in person that they can read
 * themself (GDPR access and portability, privacy policy §8): one JSON file.
 * Messages are those in their own conversations, including the other side's,
 * as the chat screen shows them.
 */
export async function collectMyData(userId: string): Promise<string> {
  const sections: Record<string, Row[]> = {};
  for (const { table, match, omit } of EXPORT_TABLES) {
    sections[table] = await readAll(table, (q) => q.or(ownerFilter(match, userId)), omit);
  }
  const ids = (sections.conversations ?? []).map((c) => String(c.id));
  sections.messages = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    sections.messages.push(...(await readAll('messages', (q) => q.in('conversation_id', chunk).order('created_at'))));
  }
  return exportDocument(userId, sections);
}

/** Web: downloads the file. Phones: opens the share sheet with it. */
export async function deliverMyData(json: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: exportFileName(), message: json });
}
