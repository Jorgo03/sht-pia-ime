import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AtticoColors } from '@/constants/theme';

interface FilterTabsProps {
  tabs: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function FilterTabs({ tabs, activeTab, onTabChange }: FilterTabsProps) {
  const [selected, setSelected] = useState(activeTab ?? tabs[0]);

  const handlePress = (tab: string) => {
    setSelected(tab);
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
