import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface FilterTabsProps {
  tabs: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function FilterTabs({ tabs, activeTab, onTabChange }: FilterTabsProps) {
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
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = selected === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && styles.activeTab]}
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
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
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
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
});
