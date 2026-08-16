import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFhoTheme } from '@/hooks/use-fho-theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors, fonts } = useFhoTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.orange1,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fonts.sansSemiBold,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('common.home'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('common.search'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('search.mapView'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="map" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('common.favorites'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="heart" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('common.profile'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
