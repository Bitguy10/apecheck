'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-client';
import { AuthForm } from '@/components/AuthForm';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('next') || '/';

  // Already signed in → bounce out.
  useEffect(() => {
    getBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace(redirectTo);
      });
  }, [router, redirectTo]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-10">
      <div className="mb-6 text-center">
        <Link href="/" className="font-display text-3xl font-black tracking-tight text-text-primary">
          Ape<span className="text-signal-green">Check</span>
        </Link>
        <p className="mt-2 max-w-xs text-sm text-text-secondary">
          Sign in to build your watchlist and get dev-dump alerts.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-panel/60 p-6 shadow-glow-purple">
        <AuthForm redirectTo={redirectTo} />
      </div>

      <p className="mt-6 max-w-sm text-center font-mono text-[10px] leading-relaxed text-text-muted">
        Only buy what you can afford to lose. Scores are risk signals, not guarantees or financial advice.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
