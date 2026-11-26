import { Directory, File, Paths } from 'expo-file-system';
import type { TFunction } from 'i18next';
import { Platform, Share } from 'react-native';

import { supabase } from '@/lib/supabase';
import { EXPORT_TABLES, MAX_ROWS, PAGE, ownerFilter, stripColumns } from '@/lib/data-export-plan';
import { buildReport, reportFileName } from '@/lib/data-report';
import { XLSX_TYPE } from '@/lib/xlsx';

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
 * themself (GDPR access and portability, privacy policy §8). Messages are
 * those in their own conversations, including the other side's, as the chat
 * screen shows them. `titles` names other people's listings the person saved,
 * visited or asked about, for the journey sheet.
 */
export async function collectMyData(userId: string): Promise<{ sections: Record<string, Row[]>; titles: Record<string, string> }> {
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
  const own = new Set((sections.properties ?? []).map((p) => p.id));
  const linked = [...(sections.favorites ?? []), ...(sections.viewings ?? []), ...(sections.conversations ?? [])].map((r) => r.property_id as string | null);
  const wanted = [...new Set(linked.filter((id): id is string => !!id && !own.has(id)))];
  const titles: Record<string, string> = {};
  for (let i = 0; i < wanted.length; i += 100) {
    const { data } = await supabase.from('properties').select('id, title').in('id', wanted.slice(i, i + 100));
    for (const p of data ?? []) titles[p.id] = p.title;
  }
  return { sections, titles };
}

/**
 * The person's data as an Excel report (lib/data-report.js). Web: downloads
 * it. iPhone: the share sheet with the file (Save to Files, Mail…). Android:
 * the system folder picker, and the file is saved there. Returns false when
 * the person closed the picker without choosing a folder.
 */
export async function deliverMyData(
  data: { sections: Record<string, Row[]>; titles: Record<string, string> },
  user: { id: string; email?: string | null },
  t: TFunction,
): Promise<boolean> {
  const bytes: Uint8Array = buildReport({ userId: user.id, email: user.email ?? '', sections: data.sections, titles: data.titles, t });
  const name = reportFileName();

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_TYPE }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  if (Platform.OS === 'android') {
    let folder: Directory;
    try {
      folder = await Directory.pickDirectoryAsync();
    } catch {
      return false; // picker closed
    }
    const file = folder.createFile(name, XLSX_TYPE);
    await file.write(bytes);
    return true;
  }

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(bytes);
  await Share.share({ url: file.uri, title: name });
  return true;
}
