import { cookies } from "next/headers";
import AdminPresenterConsole from "../components/AdminPresenterConsole";
import { isAdminFromCookieStore } from "../lib/admin-auth";
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
    <AdminPresenterConsole
      slides={deck.slides}
      deckTitle={deck.deckTitle}
      initialSlideIndex={presenterState.slideIndex}
      initialRevealStep={presenterState.revealStep}
    />
  );
}
