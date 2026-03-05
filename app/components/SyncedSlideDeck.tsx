"use client";

import { useCallback, useEffect, useState } from "react";
import SlideDeck from "./SlideDeck";

type SyncedSlideDeckProps = {
  slides: string[];
  deckTitle: string;
  syncRole: "viewer" | "admin";
  initialSlideIndex: number;
  initialRevealStep: number;
};

type PresenterState = {
  slideIndex: number;
  revealStep?: number;
  version: number;
  updatedAt: string;
};

type SlideCursor = {
  slideIndex: number;
  revealStep: number;
};

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.floor(numeric));
}

export default function SyncedSlideDeck({
  slides,
  deckTitle,
  syncRole,
  initialSlideIndex,
  initialRevealStep,
}: SyncedSlideDeckProps) {
  const [externalCursor, setExternalCursor] = useState<SlideCursor>(() => ({
    slideIndex: toNonNegativeInteger(initialSlideIndex),
    revealStep: toNonNegativeInteger(initialRevealStep),
  }));

  useEffect(() => {
    const nextCursor = {
      slideIndex: toNonNegativeInteger(initialSlideIndex),
      revealStep: toNonNegativeInteger(initialRevealStep),
    };
    const frameId = window.requestAnimationFrame(() => {
      setExternalCursor((previousCursor) =>
        previousCursor.slideIndex === nextCursor.slideIndex &&
        previousCursor.revealStep === nextCursor.revealStep
          ? previousCursor
          : nextCursor,
      );
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialRevealStep, initialSlideIndex]);

  useEffect(() => {
    const source = new EventSource("/api/presenter/stream");

    const applySlide = (rawData: string) => {
      try {
        const state = JSON.parse(rawData) as PresenterState;
        if (!Number.isFinite(state.slideIndex)) {
          return;
        }

        const nextCursor = {
          slideIndex: toNonNegativeInteger(state.slideIndex),
          revealStep: toNonNegativeInteger(state.revealStep, 0),
        };
        setExternalCursor((previousCursor) =>
          previousCursor.slideIndex === nextCursor.slideIndex &&
          previousCursor.revealStep === nextCursor.revealStep
            ? previousCursor
            : nextCursor,
        );
      } catch {
        // Ignore malformed events.
      }
    };

    const handleSlide = (event: MessageEvent) => {
      applySlide(event.data);
    };

    source.addEventListener("slide", handleSlide as EventListener);
    source.onmessage = (event) => {
      applySlide(event.data);
    };

    return () => {
      source.removeEventListener("slide", handleSlide as EventListener);
      source.close();
    };
  }, []);

  const onCursorCommitted = useCallback(
    async (cursor: SlideCursor) => {
      if (syncRole !== "admin") {
        return;
      }

      try {
        await fetch("/api/presenter/slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slideIndex: cursor.slideIndex,
            revealStep: cursor.revealStep,
          }),
        });
      } catch (error) {
        console.error("Failed to push presenter cursor update:", error);
      }
    },
    [syncRole],
  );

  return (
    <SlideDeck
      slides={slides}
      deckTitle={deckTitle}
      syncRole={syncRole}
      externalSlideIndex={externalCursor.slideIndex}
      externalRevealStep={externalCursor.revealStep}
      onCursorCommitted={
        syncRole === "admin" ? onCursorCommitted : undefined
      }
    />
  );
}
