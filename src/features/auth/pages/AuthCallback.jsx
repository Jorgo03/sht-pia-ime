import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import LoadingScreen from "../../../shared/LoadingScreen";
import "../../../styles/profile.css";
import { authRedirectError, hasAuthCode, linkErrorKey } from "../lib/authLinks";
import { buildRelayTarget as buildRelayFrom, isAllowedRelayTarget } from "../../../lib/oauthRelay";

/**
 * Mobile OAuth relay.
 *
 * Supabase's redirect allow-list cannot express an Expo Go address. But this
 * production callback IS allow-listed, and Supabase preserves extra query
 * parameters through the redirect. So the app points redirectTo here with
 * `?rt=<its own exp:// address>`, and this page forwards the result on.
 *
 * Which addresses may receive the code is a security boundary (an open relay
 * hands over the account): see src/lib/oauthRelay.js.
 */
function buildRelayTarget() {
  // index.html already took the code out of the address (so the Supabase
  // client never sees it) and left the target here.
  const kept = window.__FHO_RELAY_TARGET__;
  if (isAllowedRelayTarget(kept)) return kept;
  return buildRelayFrom(window.location.search, window.location.hash);
}

export default function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settled = useRef(false);
  // Set when this callback belongs to the mobile app. Rendering a real link
  // matters: browsers commonly block a *scripted* navigation to a custom
  // scheme with no user gesture, and when that happens silently the user is
  // simply stranded on this page — which is exactly the "it ends up on the
  // web app" symptom. The automatic attempt below still runs and usually
  // wins; this is the visible fallback for when it does not.
  const [relayTarget, setRelayTarget] = useState(null);
  // A link that cannot sign anyone in, shown at once with a way on, instead
  // of a spinner that gave up after 15 seconds and blamed "the provider".
  const [failure, setFailure] = useState(null);

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
      // preserving here anyway. Not on Android, whose Chrome blocks a jump
      // to an app scheme without a tap: the button below is the way there.
      if (!/Android/i.test(navigator.userAgent)) window.location.href = target;
      return;
    }

    // Read before supabase-js tidies the address.
    const href = window.location.href;
    const linkError = authRedirectError(href);
    if (linkError) {
      settled.current = true;
      const key = linkErrorKey(linkError);
      // A provider's refusal keeps its old message on the sign-in page; an
      // expired or used email link says so here.
      if (key === "errors.oauthFailed") navigate("/profile?error=oauth_failed", { replace: true });
      else setFailure(key);
      return;
    }

    const finishAuth = async () => {
      try {
        // Settles once the client has tried to exchange a ?code= for a session.
        await supabase.auth.initialize();
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

        // A confirmation or sign-in link opened in another browser: the
        // verifier for its ?code= lives in the browser that asked, so the
        // code was never exchanged. (A confirmation is already done by then;
        // only the session is missing.)
        if (hasAuthCode(window.location.href)) {
          settled.current = true;
          setFailure("errors.linkOtherDevice");
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
        <p style={{ fontSize: 15, opacity: 0.75, margin: 0 }}>{t("authCallback.returning")}</p>
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
          {t("authCallback.openApp")}
        </a>
        <p style={{ fontSize: 12, opacity: 0.5, margin: 0, maxWidth: 320 }}>
          {t("authCallback.tapHint")}
        </p>
      </div>
    );
  }

  if (failure) {
    return (
      <div className="profile-page auth-screen">
        <div className="auth-content">
          <div className="auth-glass">
            <div className="auth-message auth-message--error" role="alert">{t(failure)}</div>
            <button className="cta-pill" onClick={() => navigate("/profile", { replace: true })}>
              {t("authConfirm.goSignIn")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <LoadingScreen />;
}
