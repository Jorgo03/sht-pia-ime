import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AtticoColors } from '@/constants/theme';

interface FilterTabsProps {
  tabs: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function FilterTabs({ tabs, activeTab, onTabChange }: FilterTabsProps) {
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

const styles = StyleSheet.create({
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
    borderColor: AtticoColors.glassBorder,
    backgroundColor: AtticoColors.glass,
  },
  activeTab: {
    backgroundColor: AtticoColors.accent,
    borderColor: AtticoColors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: AtticoColors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
});
