import { useEffect, useRef, useState } from "react";
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
function buildRelayTarget() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('rt');
  if (!target) return null;

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return null; // unparseable — treat as a normal web callback
  }
  if (!RELAY_SCHEMES.includes(parsed.protocol)) return null;

  // Carry over everything Supabase returned (code, or error/error_description)
  // except our own routing parameter, so the app sees exactly what it would
  // have received from a direct redirect.
  params.delete('rt');
  for (const [key, value] of params) parsed.searchParams.set(key, value);
  // Implicit-flow responses arrive in the fragment; pass it through untouched.
  if (window.location.hash && window.location.hash.length > 1) {
    parsed.hash = window.location.hash;
  }

  return parsed.toString();
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const settled = useRef(false);
  // Set when this callback belongs to the mobile app. Rendering a real link
  // matters: browsers commonly block a *scripted* navigation to a custom
  // scheme with no user gesture, and when that happens silently the user is
  // simply stranded on this page — which is exactly the "it ends up on the
  // web app" symptom. The automatic attempt below still runs and usually
  // wins; this is the visible fallback for when it does not.
  const [relayTarget, setRelayTarget] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Before anything session-related: if this callback belongs to the mobile
    // app, hand it straight back rather than establishing a web session for a
    // sign-in that happened on someone's phone.
    const target = buildRelayTarget();
    if (target) {
      settled.current = true;
      setRelayTarget(target);
      // location.href rather than replace(): replace() is more likely to be
      // suppressed for a custom scheme, and there is no history entry worth
      // preserving here anyway.
      window.location.href = target;
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

  if (relayTarget) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: 24,
          textAlign: 'center',
          background: 'var(--fho-bg, #16120f)',
          color: 'var(--fho-text, #f5f0e8)',
        }}
      >
        <p style={{ fontSize: 15, opacity: 0.75, margin: 0 }}>Returning you to the app…</p>
        {/* A genuine anchor, not a button calling location.href: a user tap on
            a real link is the navigation browsers reliably allow through to a
            custom scheme. */}
        <a
          href={relayTarget}
          style={{
            display: 'inline-block',
            padding: '14px 30px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            color: '#fff',
            textDecoration: 'none',
            background:
              'linear-gradient(135deg, var(--fho-orange-1, #ff7d1a), var(--fho-orange-2, #e85d00))',
          }}
        >
          Open the app
        </a>
        <p style={{ fontSize: 12, opacity: 0.5, margin: 0, maxWidth: 320 }}>
          If nothing happened automatically, tap the button above.
        </p>
      </div>
    );
  }

  return <LoadingScreen />;
}
