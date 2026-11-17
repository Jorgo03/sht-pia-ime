import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery } from '@tanstack/react-query';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useCurrency } from '@/contexts/currency-context';
import { useTheme } from '@/contexts/theme-context';
import { formatDate } from '@/lib/format';
import { priceSteps } from '@/lib/price-history';
import { supabase } from '@/lib/supabase';

/**
 * A listing's price changes (public.property_price_history, written by a
 * database trigger). Shown only when the price has changed at least once;
 * a listing that kept its first price shows nothing, and so does a failed
 * read, since the block is extra information, not the page's subject.
 */
export const PriceHistory = memo(function PriceHistory({ propertyId }: { propertyId: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { formatListingPrice } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ['price-history', propertyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('property_price_history')
        .select('price, currency, changed_at')
        .eq('property_id', propertyId)
        .order('changed_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return priceSteps(rows ?? []);
    },
  });

  if (isLoading) return <View style={styles.skeleton} />;
  if (!data || data.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('detail.priceHistory')}</Text>
      {[...data].reverse().map((step) => {
        const down = step.change != null && step.change < 0;
        const up = step.change != null && step.change > 0;
        return (
          <View key={step.changed_at} style={styles.row}>
            <Text style={styles.date}>{formatDate(step.changed_at, i18n.language)}</Text>
            <Text style={styles.price}>{formatListingPrice(step.price, step.currency)}</Text>
            {step.change != null ? (
              <View style={styles.change}>
                <MaterialIcons name={down ? 'south-east' : up ? 'north-east' : 'east'} size={14} color={down ? colors.accentText : colors.textSecondary} />
                <Text style={styles.changeText}>{`${up ? '+' : ''}${Math.round(step.change * 1000) / 10}%`}</Text>
              </View>
            ) : (
              <Text style={styles.changeText}>{t('detail.priceListed')}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
});

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    skeleton: { height: 64, borderRadius: 14, backgroundColor: colors.glass },
    wrap: { gap: 8, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass },
    title: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary, marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    date: { width: 96, fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary },
    price: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
    change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    changeText: { fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary },
  });
