import { cookies } from "next/headers";
import SyncedSlideDeck from "../components/SyncedSlideDeck";
import {
  ADMIN_COOKIE_NAME,
  isAdminFromCookieStore,
} from "../lib/admin-auth";
import { loadDeck } from "../lib/deck-data";
import { getPresenterState } from "../lib/presenter-state";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminFromCookieStore(cookieStore);

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <section className="w-full rounded-2xl border border-border bg-surface p-6 shadow-[var(--theme-shadow-elevated)]">
          <h1 className="mb-2 text-2xl font-semibold">Admin Login</h1>
          <p className="mb-4 text-sm text-muted">
            Enter the password to control global slide position.
          </p>
          <form action="/api/admin/login" method="post" className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Password</span>
              <input
                name="password"
                type="password"
                required
                className="w-full rounded-lg border border-border px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand transition-colors duration-150 hover:bg-brand-hover"
            >
              Login
            </button>
          </form>
        </section>
      </main>
    );
  }

  const [deck, presenterState] = await Promise.all([
    loadDeck(),
    Promise.resolve(getPresenterState()),
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-[68rem] shrink-0 items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-xl font-semibold">Admin Controller</h1>
          <p className="text-sm text-muted">
            Session cookie: <code>{ADMIN_COOKIE_NAME}</code>
          </p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-border bg-paper px-4 py-2 font-semibold text-ink transition-colors duration-150 hover:bg-page-base"
          >
            Logout
          </button>
        </form>
      </header>
      <div className="flex-1 min-h-0">
        <SyncedSlideDeck
          slides={deck.slides}
          deckTitle={deck.deckTitle}
          syncRole="admin"
          initialSlideIndex={presenterState.slideIndex}
          initialRevealStep={presenterState.revealStep}
          noScroll
        />
      </div>
    </div>
  );
}
