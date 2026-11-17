import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { START_PARAM, shouldStartOnSignIn } from '@/src/features/auth/lib/startScreen';

/**
 * Opens the phone app on the sign-in screen when nobody is signed in
 * (src/features/auth/lib/startScreen.js). Mounted once, under the navigator,
 * after session restore has finished (app/_layout.tsx AppGate). Decides once
 * per launch: signing out later does not throw the person back here.
 */
export function SignedOutStart() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (done.current) return;
    done.current = true;
    if (shouldStartOnSignIn({ platform: Platform.OS, signedIn: !!user, pathname })) {
      router.replace(`/profile?${START_PARAM}=1` as Href);
    }
  }, [loading, user, pathname, router]);

  return null;
}
