import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { StormMark } from "@/components/mark";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="min-h-dvh bg-bg text-fg grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-xl bg-surface border border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <StormMark />
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Voltcore</p>
            <h1 className="text-xl font-medium">STORM PATH</h1>
          </div>
        </div>
        <p className="text-sm text-muted">
          Sign in to sync Home, Work, and Gale routes. Map and weather work as guest.
        </p>
        {authEnabled ? (
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="w-full min-h-11 rounded-sm border border-border bg-raised px-4 text-sm hover:border-primary"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/" className="block text-center text-sm text-primary hover:underline">
          Continue as guest
        </Link>
      </div>
    </main>
  );
}
