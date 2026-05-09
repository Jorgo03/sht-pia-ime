import { supabase } from '@/lib/supabase';

import { Property } from './types';

export async function getFavorites(userId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('property_id, properties(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((f: any) => f.properties).filter(Boolean);
}

export async function addFavorite(
  userId: string,
  propertyId: string,
): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, property_id: propertyId });

  if (error) throw error;
}

export async function removeFavorite(
  userId: string,
  propertyId: string,
): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);

  if (error) throw error;
}

export async function isFavorite(
  userId: string,
  propertyId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('property_id', propertyId);

  if (error) return false;
  return (count ?? 0) > 0;
}
