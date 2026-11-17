import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface FilterTabsProps {
  tabs: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** Tighter pills, for labels that would otherwise wrap on a phone. */
  compact?: boolean;
}

export function FilterTabs({ tabs, activeTab, onTabChange, compact = false }: FilterTabsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Controlled when `activeTab` is supplied, so an external reset actually
  // clears the selection instead of leaving a stale highlight behind.
  // Falls back to internal state for uncontrolled callers.
  const [internal, setInternal] = useState(tabs[0]);
  const selected = activeTab ?? internal;

  const handlePress = (tab: string) => {
    setInternal(tab);
    onTabChange?.(tab);
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {tabs.map((tab) => {
        const isActive = selected === tab;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            key={tab}
            style={[styles.tab, compact && styles.tabCompact, isActive && styles.activeTab]}
            onPress={() => handlePress(tab)}
            activeOpacity={0.7}>
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    // A Galaxy Fold's cover screen is 280 wide: the third pill ran off the
    // edge instead of moving to a second line.
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  containerCompact: {
    gap: 8,
  },
  tabCompact: {
    paddingHorizontal: 14,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  activeTab: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
});
