import SyncedSlideDeck from "./components/SyncedSlideDeck";
import { loadDeck } from "./lib/deck-data";
import { getPresenterState } from "./lib/presenter-state";

export const dynamic = "force-dynamic";

export default async function Home() {
  const deck = await loadDeck();
  const presenterState = getPresenterState();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex-1 min-h-0">
        <SyncedSlideDeck
          slides={deck.slides}
          deckTitle={deck.deckTitle}
          syncRole="viewer"
          initialSlideIndex={presenterState.slideIndex}
          initialRevealStep={presenterState.revealStep}
          noScroll
        />
      </div>
    </div>
  );
}
