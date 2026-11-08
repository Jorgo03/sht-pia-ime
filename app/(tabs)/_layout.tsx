import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LiquidTabBar } from '@/components/liquid-tab-bar';
import { ComparePill } from '@/components/property/compare-pill';

// Home, Search, Messages and Profile are real tabs (state-preserving,
// switched via the floating pill below), so the menu stays on screen in
// Messages and the person moves on from it themselves. Create — the pill's
// other button — is a stack push handled inside LiquidTabBar itself. Map and
// Favorites are no longer tabs at all:
// Map is now a view-mode toggle inside Explore, Favorites moved into
// Profile's menu — same places web keeps them.
export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <View style={styles.fill}>
      <Tabs
        tabBar={(props) => <LiquidTabBar {...props} />}
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" options={{ title: t('common.home') }} />
        <Tabs.Screen name="explore" options={{ title: t('common.search') }} />
        <Tabs.Screen name="messages" options={{ title: t('common.messages') }} />
        <Tabs.Screen name="profile" options={{ title: t('common.profile') }} />
      </Tabs>
      <ComparePill />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
