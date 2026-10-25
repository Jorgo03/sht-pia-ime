import { Link, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

// Where Google/Apple/LinkedIn sign-in returns on the website, ported from the
// Vite site's AuthCallback.jsx. Web only (app/auth/callback.tsx sends the
// phone apps home).
//
// Two jobs:
// - Mobile relay fallback. app/+html.tsx forwards ?rt=<the app's address>
//   before the bundle loads; if the browser blocked that scripted jump to a
//   custom scheme, this shows a real link to tap. Only the app's own schemes
//   are accepted: forwarding to http(s) would leak the sign-in code.
// - A web sign-in: the Supabase client redeems ?code= on creation; wait for
//   the session, then go home, or back to Profile after 15 s without one.

const RELAY_SCHEMES = ['exp:', 'shtepia-ime:'];

function buildRelayTarget(): string | null {
  // app/+html.tsx already took the code out of the address and left it here.
  const kept = (window as { __FHO_RELAY_TARGET__?: unknown }).__FHO_RELAY_TARGET__;
  if (typeof kept === 'string') {
    try {
      if (RELAY_SCHEMES.includes(new URL(kept).protocol)) return kept;
    } catch {
      // fall through to the address
    }
  }
  const params = new URLSearchParams(window.location.search);
  const target = params.get('rt');
  if (!target) return null;
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return null;
  }
  if (!RELAY_SCHEMES.includes(parsed.protocol)) return null;
  params.delete('rt');
  params.forEach((value, key) => parsed.searchParams.set(key, value));
  if (window.location.hash && window.location.hash.length > 1) parsed.hash = window.location.hash;
  return parsed.toString();
}

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const settled = useRef(false);
  const [relayTarget] = useState(() => (typeof window === 'undefined' ? null : buildRelayTarget()));

  useEffect(() => {
    if (relayTarget) {
      settled.current = true;
      // Android's Chrome blocks a jump to an app scheme without a tap.
      if (!/Android/i.test(navigator.userAgent)) window.location.href = relayTarget;
      return;
    }
    let mounted = true;
    const finish = (to: '/' | '/profile') => {
      if (!mounted || settled.current) return;
      settled.current = true;
      router.replace(to);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) finish('/');
      })
      .catch(() => finish('/profile'));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) finish('/');
      if (event === 'SIGNED_OUT') finish('/profile');
    });
    // A provider redirect that never resolves would otherwise spin forever.
    const timeout = setTimeout(() => finish('/profile'), 15000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [relayTarget, router]);

  if (relayTarget) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{t('authCallback.returning')}</Text>
        {/* A real link: a tap is the navigation browsers reliably let through
            to a custom scheme. */}
        <Link href={relayTarget as Href} style={styles.button}>
          {t('authCallback.openApp')}
        </Link>
        <Text style={styles.hint}>{t('authCallback.tapHint')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.text}>{t('authCallback.signingIn')}</Text>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, backgroundColor: colors.primary },
  text: { fontFamily: Fonts?.sans, fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  button: {
    fontFamily: Fonts?.sansBold,
    fontSize: 15,
    color: '#fff',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 30,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  hint: { fontFamily: Fonts?.sans, fontSize: 12, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
});
