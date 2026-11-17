// The phone app's crash reporter (docs/LAUNCH_TASKS.md F11): the shared rules
// in src/lib/errorReport.js, bound to this app's Supabase client. Off in
// development (__DEV__) and when EXPO_PUBLIC_ERROR_REPORTING=false.
//
// Best effort by nature: a fatal JS error can end the process before the
// insert finishes. Native crashes (outside JavaScript) are not seen here at
// all; that needs a native SDK and is listed as an open item.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { createReporter, type Platform as ReportPlatform } from '@/src/lib/errorReport';

const platform: ReportPlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

export const reportError = createReporter({
  client: supabase,
  platform,
  appVersion: Constants.expoConfig?.version ?? null,
  enabled: !__DEV__ && process.env.EXPO_PUBLIC_ERROR_REPORTING !== 'false',
});

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };

let installed = false;

/** Report uncaught JS errors, then hand them to React Native's own handler. */
export function installGlobalErrorReporting() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (installed || !errorUtils?.getGlobalHandler) return;
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportError('uncaught', error, null);
    previous?.(error, isFatal);
  });
}
