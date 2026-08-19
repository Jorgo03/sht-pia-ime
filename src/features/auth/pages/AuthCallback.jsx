import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import LoadingScreen from "../../../shared/LoadingScreen";

export default function AuthCallback() {
  const navigate = useNavigate();
  const settled = useRef(false);

  useEffect(() => {
    let mounted = true;

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
