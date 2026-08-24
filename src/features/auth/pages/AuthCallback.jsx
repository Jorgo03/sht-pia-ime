import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import LoadingScreen from "../../../shared/LoadingScreen";

/**
 * Schemes this page may hand an authorization code to.
 *
 * This list is a security boundary, not a convenience. The relay below
 * forwards the OAuth result to a URL supplied in a query parameter, which is
 * an open redirect unless it is constrained — and an open redirect here would
 * hand an attacker the authorization code, i.e. the account. Only the two
 * schemes belonging to this project's own mobile app are allowed:
 *
 *   exp://          Expo Go during development
 *   shtepia-ime://  dev-client and store builds (app.json `scheme`)
 *
 * http/https are deliberately absent: a web target is exactly the case that
 * would exfiltrate the code to another origin.
 */
const RELAY_SCHEMES = ['exp:', 'shtepia-ime:'];

/**
 * Mobile OAuth relay.
 *
 * Supabase's redirect allow-list cannot express an Expo Go address —
 * `exp://<host>:<port>/--/path` is rejected even with a wildcard, verified by
 * probing the live project. But this production callback IS allow-listed, and
 * Supabase preserves extra query parameters through the redirect. So the app
 * points redirectTo here with `?rt=<its own exp:// address>`, and this page
 * forwards the result on unchanged.
 *
 * The same mechanism Expo's retired auth proxy used, hosted on our own domain
 * rather than a third party's.
 */
function relayToNativeApp() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('rt');
  if (!target) return false;

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return false; // unparseable — treat as a normal web callback
  }
  if (!RELAY_SCHEMES.includes(parsed.protocol)) return false;

  // Carry over everything Supabase returned (code, or error/error_description)
  // except our own routing parameter, so the app sees exactly what it would
  // have received from a direct redirect.
  params.delete('rt');
  for (const [key, value] of params) parsed.searchParams.set(key, value);
  // Implicit-flow responses arrive in the fragment; pass it through untouched.
  if (window.location.hash && window.location.hash.length > 1) {
    parsed.hash = window.location.hash;
  }

  window.location.replace(parsed.toString());
  return true;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const settled = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Before doing anything session-related: if this callback belongs to the
    // mobile app, hand it straight back and do not establish a web session
    // for a sign-in that happened on someone's phone.
    if (relayToNativeApp()) {
      settled.current = true;
      return;
    }

    const finishAuth = async () => {
      try {
        // First check whether Supabase has already restored the session.
        // This is important because onAuthStateChange can fire before or
        // after this callback runs depending on the browser/provider timing.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted || settled.current) return;

        if (session?.user) {
          settled.current = true;
          navigate("/", { replace: true });
          return;
        }

        // OAuth providers may still be processing the callback.
        // onAuthStateChange below will handle SIGNED_IN if it arrives.
      } catch (error) {
        console.error("Auth callback session error:", error);

        if (!mounted || settled.current) return;

        settled.current = true;
        navigate("/profile?error=oauth_failed", { replace: true });
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || settled.current) return;

      if (event === "SIGNED_IN" && session?.user) {
        settled.current = true;
        navigate("/", { replace: true });
      }

      if (event === "SIGNED_OUT") {
        settled.current = true;
        navigate("/profile?error=oauth_failed", { replace: true });
      }
    });

    finishAuth();

    // If the provider redirect never resolves to SIGNED_IN or SIGNED_OUT
    // (closed popup, dropped network, misconfigured provider), this screen
    // would otherwise spin forever with no way out.
    const timeout = setTimeout(() => {
      if (!mounted || settled.current) return;
      settled.current = true;
      navigate("/profile?error=oauth_failed", { replace: true });
    }, 15000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return <LoadingScreen />;
}
