import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { LiquidTabBar } from '@/components/liquid-tab-bar';

// Matches web's src/shared/BottomNav.jsx: Home/Search/Profile are the only
// real tabs (state-preserving, switched via the floating pill below).
// Create and Messages — the pill's other two buttons — are stack pushes
// handled inside LiquidTabBar itself, not tab routes, exactly like
// BottomNav.jsx's own `/new-listing` and `/messages` links aren't separate
// router "tabs" on web either. Map and Favorites are no longer tabs at all:
// Map is now a view-mode toggle inside Explore, Favorites moved into
// Profile's menu — same places web keeps them.
export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('common.home') }} />
      <Tabs.Screen name="explore" options={{ title: t('common.search') }} />
      <Tabs.Screen name="profile" options={{ title: t('common.profile') }} />
    </Tabs>
  );
}
