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
        <section className="w-full rounded-2xl border border-[#d8cfbe] bg-[#fffdf8] p-6 shadow-[0_24px_50px_rgba(64,50,29,0.13)]">
          <h1 className="mb-2 text-2xl font-semibold">Admin Login</h1>
          <p className="mb-4 text-sm text-[#726955]">
            Enter the password to control global slide position.
          </p>
          <form action="/api/admin/login" method="post" className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Password</span>
              <input
                name="password"
                type="password"
                required
                className="w-full rounded-lg border border-[#d8cfbe] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-[#1e6f74] px-4 py-2 font-semibold text-[#f9fdfa] transition-colors duration-150 hover:bg-[#154f53]"
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
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-[68rem] items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-xl font-semibold">Admin Controller</h1>
          <p className="text-sm text-[#726955]">
            Session cookie: <code>{ADMIN_COOKIE_NAME}</code>
          </p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-[#d8cfbe] bg-white px-4 py-2 font-semibold text-[#262219] transition-colors duration-150 hover:bg-[#f2efe8]"
          >
            Logout
          </button>
        </form>
      </header>
      <SyncedSlideDeck
        slides={deck.slides}
        deckTitle={deck.deckTitle}
        syncRole="admin"
        initialSlideIndex={presenterState.slideIndex}
        initialRevealStep={presenterState.revealStep}
      />
    </div>
  );
}
