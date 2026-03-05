import SyncedSlideDeck from "./components/SyncedSlideDeck";
import { loadDeck } from "./lib/deck-data";
import { getPresenterState } from "./lib/presenter-state";

export const dynamic = "force-dynamic";

export default async function Home() {
  const deck = await loadDeck();
  const presenterState = getPresenterState();

  return (
    <SyncedSlideDeck
      slides={deck.slides}
      deckTitle={deck.deckTitle}
      syncRole="viewer"
      initialSlideIndex={presenterState.slideIndex}
      initialRevealStep={presenterState.revealStep}
    />
  );
}
