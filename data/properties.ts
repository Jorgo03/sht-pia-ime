import { supabase } from '@/lib/supabase';

import { Property } from './types';

export async function getProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPropertyById(
  id: string,
): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function getFeaturedProperty(): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}
