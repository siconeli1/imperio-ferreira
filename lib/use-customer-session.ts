"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type CustomerProfile = {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento?: string | null;
};

export function useCustomerSession() {
  const supabase = getSupabaseBrowserClient();
  const [sessionReady, setSessionReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    setAccessToken(token);

    if (!token) {
      setProfile(null);
      setSessionReady(true);
      return;
    }

    const res = await fetch("/api/client/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setProfile(null);
      setSessionReady(true);
      return;
    }

    const json = await res.json();
    setProfile((json.profile as CustomerProfile | null) ?? null);
    setSessionReady(true);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await refresh();
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [refresh, supabase]);

  const signInWithGoogle = useCallback(
    async (redirectPath?: string) => {
      const redirectTo = redirectPath
        ? `${window.location.origin}${redirectPath}`
        : window.location.href;

      return supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAccessToken(null);
    setProfile(null);
  }, [supabase]);

  return {
    supabase,
    accessToken,
    profile,
    sessionReady,
    refresh,
    signInWithGoogle,
    signOut,
  };
}
