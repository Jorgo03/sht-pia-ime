import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useFhoTheme } from '@/hooks/use-fho-theme';

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
  const { colors, radii, fonts } = useFhoTheme();

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
            style={[
              styles.tab,
              {
                borderRadius: radii.pill,
                borderColor: isActive ? colors.orange1 : colors.borderStrong,
                backgroundColor: isActive ? colors.orange1 : colors.surface2,
              },
            ]}
            onPress={() => handlePress(tab)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.tabText,
                {
                  fontFamily: fonts.sansSemiBold,
                  color: isActive ? '#fff' : colors.textMuted,
                },
              ]}>
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
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
  },
});
