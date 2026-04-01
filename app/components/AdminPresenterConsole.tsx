"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SlideDeck, {
  getInitialRevealStepForSlide,
  getMaxRevealStepsForSlide,
} from "./SlideDeck";

type AdminPresenterConsoleProps = {
  slides: string[];
  deckTitle: string;
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

type IconName =
  | "arrow_back"
  | "arrow_forward"
  | "cloud_done"
  | "logout"
  | "open_in_new"
  | "play_arrow"
  | "sync";

const STAGE_ARTICLE_CLASS = [
  "w-full max-w-[76rem] overflow-hidden rounded-[1.25rem] border border-slate-200",
  "bg-white p-[clamp(1.25rem,2.6vw,2.5rem)] shadow-[0_30px_80px_rgba(28,36,80,0.16)] leading-[1.55]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:font-headline [&_h1]:text-[clamp(2rem,3.5vw,3.6rem)] [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:leading-[1.02]",
  "[&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:font-headline [&_h2]:text-[clamp(1.45rem,2.4vw,2.2rem)] [&_h2]:font-bold [&_h2]:leading-tight",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-headline [&_h3]:text-[clamp(1.2rem,1.8vw,1.55rem)] [&_h3]:font-bold",
  "[&_p]:text-[clamp(1.02rem,1.08vw,1.18rem)] [&_li]:text-[clamp(1.02rem,1.08vw,1.18rem)]",
  "[&_ul]:my-4 [&_ol]:my-4 [&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal",
  "[&_li+li]:mt-2",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600",
  "[&_a]:text-[#27389a]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-[#1f2428] [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-[#e5ecf3]",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.96rem]",
  "[&_th]:border [&_td]:border [&_th]:border-slate-200 [&_td]:border-slate-200",
  "[&_th]:px-3 [&_td]:px-3 [&_th]:py-2.5 [&_td]:py-2.5",
  "[&_img]:block [&_img]:max-w-full [&_img]:rounded-lg",
].join(" ");

const PREVIEW_ARTICLE_CLASS = [
  "w-full overflow-hidden rounded-2xl border border-slate-200",
  "bg-white p-4 shadow-[0_16px_40px_rgba(28,36,80,0.12)] leading-[1.4]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:font-headline [&_h1]:text-[1.35rem] [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:leading-tight",
  "[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:font-headline [&_h2]:text-[1.05rem] [&_h2]:font-bold",
  "[&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:font-headline [&_h3]:text-[0.95rem] [&_h3]:font-bold",
  "[&_p]:text-[0.83rem] [&_li]:text-[0.83rem]",
  "[&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal",
  "[&_li+li]:mt-1",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600",
  "[&_pre]:overflow-hidden [&_pre]:rounded-lg [&_pre]:bg-[#1f2428] [&_pre]:px-3 [&_pre]:py-2 [&_pre]:text-[0.72rem] [&_pre]:text-[#e5ecf3]",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.72rem]",
  "[&_th]:border [&_td]:border [&_th]:border-slate-200 [&_td]:border-slate-200",
  "[&_th]:px-2 [&_td]:px-2 [&_th]:py-1.5 [&_td]:py-1.5",
  "[&_img]:block [&_img]:max-w-full [&_img]:rounded-md",
].join(" ");

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.floor(numeric));
}

function clampIndex(index: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= total) {
    return total - 1;
  }

  return index;
}

function stripMarkdownSyntax(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSlideTitle(slide: string, fallback: string) {
  const lines = slide.split(/\r?\n/);
  let inCodeFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence || /^\s*<!--/.test(line)) {
      continue;
    }

    const atxHeading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (atxHeading) {
      return stripMarkdownSyntax(atxHeading[1]) || fallback;
    }

    const trimmed = line.trim();
    const next = lines[index + 1]?.trim() ?? "";
    if (
      trimmed.length > 0 &&
      !/^[-*+]|\d+[.)]\s/.test(trimmed) &&
      (/^=+$/.test(next) || /^-+$/.test(next))
    ) {
      return stripMarkdownSyntax(trimmed) || fallback;
    }

    if (trimmed.length > 0) {
      return stripMarkdownSyntax(trimmed) || fallback;
    }
  }

  return fallback;
}

function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const sharedProps = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "cloud_done":
      return (
        <svg {...sharedProps}>
          <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 8.5a4.5 4.5 0 1 1-.5 8.97H7Z" />
          <path d="m9.5 12.5 2 2 4-4" />
        </svg>
      );
    case "sync":
      return (
        <svg {...sharedProps}>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M7 9a7 7 0 0 1 11-2l2 2" />
          <path d="M17 15a7 7 0 0 1-11 2l-2-2" />
        </svg>
      );
    case "arrow_back":
      return (
        <svg {...sharedProps}>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </svg>
      );
    case "arrow_forward":
      return (
        <svg {...sharedProps}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "play_arrow":
      return (
        <svg {...sharedProps}>
          <path d="m8 6 10 6-10 6V6Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "open_in_new":
      return (
        <svg {...sharedProps}>
          <path d="M14 5h5v5" />
          <path d="M10 14 19 5" />
          <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
        </svg>
      );
    case "logout":
      return (
        <svg {...sharedProps}>
          <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
  }

  return null;
}

export default function AdminPresenterConsole({
  slides,
  deckTitle,
  initialSlideIndex,
  initialRevealStep,
}: AdminPresenterConsoleProps) {
  const total = slides.length;
  const [cursor, setCursor] = useState<SlideCursor>(() => ({
    slideIndex: clampIndex(toNonNegativeInteger(initialSlideIndex), total),
    revealStep: toNonNegativeInteger(initialRevealStep),
  }));
  const [streamStatus, setStreamStatus] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setCursor({
        slideIndex: clampIndex(toNonNegativeInteger(initialSlideIndex), total),
        revealStep: toNonNegativeInteger(initialRevealStep),
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialRevealStep, initialSlideIndex, total]);

  useEffect(() => {
    const source = new EventSource("/api/presenter/stream");

    const applyState = (rawData: string) => {
      try {
        const state = JSON.parse(rawData) as PresenterState;
        if (!Number.isFinite(state.slideIndex)) {
          return;
        }

        const nextCursor = {
          slideIndex: clampIndex(toNonNegativeInteger(state.slideIndex), total),
          revealStep: toNonNegativeInteger(state.revealStep, 0),
        };
        setCursor((previousCursor) =>
          previousCursor.slideIndex === nextCursor.slideIndex &&
          previousCursor.revealStep === nextCursor.revealStep
            ? previousCursor
            : nextCursor,
        );
      } catch {
        // Ignore malformed events from the presenter stream.
      }
    };

    const handleSlide = (event: MessageEvent) => {
      applyState(event.data);
    };

    source.onopen = () => {
      setStreamStatus("live");
    };
    source.onerror = () => {
      setStreamStatus("reconnecting");
    };
    source.addEventListener("slide", handleSlide as EventListener);
    source.onmessage = (event) => {
      applyState(event.data);
    };

    return () => {
      source.removeEventListener("slide", handleSlide as EventListener);
      source.close();
    };
  }, [total]);

  const commitCursor = useCallback(
    async (nextCursor: SlideCursor) => {
      setCursor((previousCursor) =>
        previousCursor.slideIndex === nextCursor.slideIndex &&
        previousCursor.revealStep === nextCursor.revealStep
          ? previousCursor
          : nextCursor,
      );

      try {
        await fetch("/api/presenter/slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextCursor),
        });
      } catch (error) {
        console.error("Failed to update presenter cursor:", error);
      }
    },
    [],
  );

  const refreshState = useCallback(async () => {
    try {
      const response = await fetch("/api/presenter/state", {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }

      const state = (await response.json()) as PresenterState;
      setCursor({
        slideIndex: clampIndex(toNonNegativeInteger(state.slideIndex), total),
        revealStep: toNonNegativeInteger(state.revealStep, 0),
      });
      setStreamStatus("live");
    } catch (error) {
      console.error("Failed to refresh presenter state:", error);
    }
  }, [total]);

  const currentIndex = clampIndex(cursor.slideIndex, total);
  const currentSlide = slides[currentIndex] ?? "# No slides available";
  const initialRevealStepForCurrentSlide =
    getInitialRevealStepForSlide(currentSlide);
  const maxRevealSteps = getMaxRevealStepsForSlide(currentSlide);
  const hasPendingReveal =
    maxRevealSteps > 0 && cursor.revealStep < maxRevealSteps;
  const canGoPreviousReveal =
    cursor.revealStep > initialRevealStepForCurrentSlide;
  const currentTitle = useMemo(
    () => getSlideTitle(currentSlide, `Slide ${currentIndex + 1}`),
    [currentIndex, currentSlide],
  );
  const nextIndex = currentIndex < total - 1 ? currentIndex + 1 : null;
  const nextSlide = nextIndex === null ? null : slides[nextIndex] ?? "";
  const nextRevealStep =
    nextSlide === null ? 0 : getInitialRevealStepForSlide(nextSlide);
  const nextTitle =
    nextSlide === null
      ? null
      : getSlideTitle(nextSlide, `Slide ${(nextIndex ?? currentIndex) + 1}`);

  const goToSlide = useCallback(
    (index: number, revealStep?: number) => {
      const clamped = clampIndex(index, total);
      const slide = slides[clamped] ?? "";
      const nextCursor = {
        slideIndex: clamped,
        revealStep:
          revealStep ?? getInitialRevealStepForSlide(slide),
      };

      if (
        nextCursor.slideIndex === cursor.slideIndex &&
        nextCursor.revealStep === cursor.revealStep
      ) {
        return;
      }

      void commitCursor(nextCursor);
    },
    [commitCursor, cursor.revealStep, cursor.slideIndex, slides, total],
  );

  const goPrevious = useCallback(() => {
    if (currentIndex <= 0) {
      return;
    }

    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  const goPreviousReveal = useCallback(() => {
    if (!canGoPreviousReveal) {
      return;
    }

    void commitCursor({
      slideIndex: currentIndex,
      revealStep: Math.max(
        initialRevealStepForCurrentSlide,
        cursor.revealStep - 1,
      ),
    });
  }, [
    canGoPreviousReveal,
    commitCursor,
    currentIndex,
    cursor.revealStep,
    initialRevealStepForCurrentSlide,
  ]);

  const goNext = useCallback(() => {
    if (hasPendingReveal) {
      void commitCursor({
        slideIndex: currentIndex,
        revealStep: Math.min(cursor.revealStep + 1, maxRevealSteps),
      });
      return;
    }

    if (currentIndex >= total - 1) {
      return;
    }

    goToSlide(currentIndex + 1);
  }, [
    commitCursor,
    currentIndex,
    cursor.revealStep,
    goToSlide,
    hasPendingReveal,
    maxRevealSteps,
    total,
  ]);

  const goFirst = useCallback(() => {
    goToSlide(0);
  }, [goToSlide]);

  const goLast = useCallback(() => {
    if (total <= 0) {
      return;
    }

    goToSlide(total - 1);
  }, [goToSlide, total]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        goNext();
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        goPrevious();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        goFirst();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        goLast();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goFirst, goLast, goNext, goPrevious]);

  const streamPillClassName =
    streamStatus === "live"
      ? "bg-emerald-100 text-emerald-800"
      : streamStatus === "connecting"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-200 text-slate-700";
  const streamLabel =
    streamStatus === "live"
      ? "Live Sync"
      : streamStatus === "connecting"
        ? "Connecting"
        : "Reconnecting";

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fb] text-[#191c1e]">
      <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f8f9fb]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <span className="font-headline text-lg font-extrabold tracking-tight text-[#27389a]">
              The Editorial Architect
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              Live
            </span>
          </div>
          <div className="hidden items-center gap-8 font-headline text-sm font-bold tracking-tight md:flex">
            <span className="border-b-2 border-[#27389a] pb-1 text-[#27389a]">
              Presenter
            </span>
            <Link
              href="/"
              className="text-[#48626e] transition-colors hover:text-[#27389a]"
            >
              Audience
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold sm:flex ${streamPillClassName}`}
            >
              <Icon name="cloud_done" className="h-4 w-4" />
              <span>{streamLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshState();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#48626e] transition-colors hover:bg-slate-200/70 hover:text-[#27389a]"
              aria-label="Refresh presenter state"
            >
              <Icon name="sync" className="h-5 w-5" />
            </button>
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-full bg-[#27389a] px-4 py-2 text-sm font-bold text-white transition-transform duration-150 hover:scale-[1.02]"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <section className="flex min-h-0 flex-1 flex-col bg-[#f2f4f6] p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#48626e]">
                Presenter Console
              </p>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[#191c1e] sm:text-4xl">
                {currentTitle}
              </h1>
              <p className="mt-1 text-sm font-medium text-[#48626e] sm:text-base">
                {deckTitle}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                  Slide
                </p>
                <p className="font-headline text-2xl font-extrabold text-[#27389a]">
                  {currentIndex + 1}
                  <span className="ml-1 text-base text-[#48626e]">/ {total}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                  Reveal
                </p>
                <p className="font-headline text-2xl font-extrabold text-[#191c1e]">
                  {cursor.revealStep}
                  <span className="ml-1 text-base text-[#48626e]">
                    / {maxRevealSteps}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(236,238,240,0.7))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:p-4">
            <div className="h-full rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(39,56,154,0.12)]">
              <SlideDeck
                slides={slides}
                deckTitle={deckTitle}
                syncRole="viewer"
                externalSlideIndex={currentIndex}
                externalRevealStep={cursor.revealStep}
                noScroll
                embedded
                showHeader={false}
                showNavigation={false}
                articleClassName={STAGE_ARTICLE_CLASS}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <button
              type="button"
              onClick={goPrevious}
              disabled={currentIndex <= 0}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-[#27389a]/25 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 xl:min-w-[17rem]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e6e8ea] text-[#27389a] transition-colors group-hover:bg-[#27389a] group-hover:text-white">
                  <Icon name="arrow_back" className="h-8 w-8" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Previous
                  </span>
                  <span className="font-headline text-lg font-bold text-[#191c1e]">
                    {currentIndex > 0
                      ? getSlideTitle(
                          slides[currentIndex - 1] ?? "",
                          `Slide ${currentIndex}`,
                        )
                      : "Start of deck"}
                  </span>
                </div>
              </div>
            </button>

            <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-center">
              <button
                type="button"
                onClick={goPreviousReveal}
                disabled={!canGoPreviousReveal}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-[#27389a]/25 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 xl:min-w-[14rem]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e6e8ea] text-[#27389a] transition-colors group-hover:bg-[#27389a] group-hover:text-white">
                  <Icon name="arrow_back" className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Previous reveal
                  </span>
                  <span className="font-headline text-base font-bold text-[#191c1e]">
                    {canGoPreviousReveal
                      ? `Reveal ${cursor.revealStep - 1}`
                      : "At first reveal"}
                  </span>
                </div>
              </button>

              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                  Progress
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#27389a] transition-[width] duration-300"
                    style={{
                      width:
                        total > 0
                          ? `${((currentIndex + 1) / total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-[#191c1e]">
                  {currentIndex + 1}/{total}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex >= total - 1 && !hasPendingReveal}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-[#27389a]/15 bg-[#27389a] px-5 py-4 text-white shadow-[0_18px_40px_rgba(39,56,154,0.18)] transition-all hover:shadow-[0_22px_48px_rgba(39,56,154,0.24)] disabled:cursor-not-allowed disabled:opacity-45 xl:min-w-[17rem]"
            >
              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                  {hasPendingReveal ? "Next reveal" : "Next slide"}
                </span>
                <span className="font-headline text-lg font-bold">
                  {hasPendingReveal
                    ? `Reveal ${Math.min(cursor.revealStep + 1, maxRevealSteps)}`
                    : nextTitle ?? "End of deck"}
                </span>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/12 transition-transform group-hover:scale-105">
                <Icon name="arrow_forward" className="h-8 w-8" />
              </div>
            </button>
          </div>
        </section>

        <aside className="w-full shrink-0 bg-[#f8f9fb] p-4 sm:p-6 xl:w-[24rem]">
          <div className="flex h-full flex-col gap-5">
            <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-headline text-sm font-extrabold uppercase tracking-[0.18em] text-[#48626e]">
                Session
              </h2>
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#f2f4f6] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Deck
                  </p>
                  <p className="mt-1 font-headline text-xl font-extrabold text-[#191c1e]">
                    {deckTitle}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={goFirst}
                    className="rounded-2xl bg-[#eceef0] px-4 py-3 text-left transition-colors hover:bg-[#e0e3e5]"
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                      Jump
                    </span>
                    <span className="mt-1 block font-headline text-base font-bold text-[#191c1e]">
                      First slide
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={goLast}
                    className="rounded-2xl bg-[#eceef0] px-4 py-3 text-left transition-colors hover:bg-[#e0e3e5]"
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                      Jump
                    </span>
                    <span className="mt-1 block font-headline text-base font-bold text-[#191c1e]">
                      Last slide
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-headline text-sm font-extrabold uppercase tracking-[0.18em] text-[#48626e]">
                  Next Up
                </h2>
                <span className="text-xs font-bold text-[#27389a]">
                  {nextIndex === null ? "Final slide" : `Slide ${nextIndex + 1}`}
                </span>
              </div>
              {nextSlide ? (
                <>
                  <div className="aspect-video overflow-hidden rounded-[1.1rem] bg-[#f2f4f6]">
                    <SlideDeck
                      slides={slides}
                      deckTitle={deckTitle}
                      syncRole="viewer"
                      externalSlideIndex={nextIndex ?? currentIndex}
                      externalRevealStep={nextRevealStep}
                      noScroll
                      embedded
                      showHeader={false}
                      showNavigation={false}
                      articleClassName={PREVIEW_ARTICLE_CLASS}
                    />
                  </div>
                  <p className="mt-4 font-headline text-lg font-bold text-[#191c1e]">
                    {nextTitle}
                  </p>
                </>
              ) : (
                <div className="rounded-2xl bg-[#f2f4f6] p-4 text-sm font-medium text-[#48626e]">
                  You are on the final slide. No additional preview is available.
                </div>
              )}
            </section>

            <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-headline text-sm font-extrabold uppercase tracking-[0.18em] text-[#48626e]">
                Live Routes
              </h2>
              <div className="space-y-3">
                <Link
                  href="/"
                  className="flex items-center justify-between rounded-2xl bg-[#f2f4f6] px-4 py-3 transition-colors hover:bg-[#eceef0]"
                >
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                      Audience
                    </span>
                    <span className="mt-1 block font-headline text-base font-bold text-[#191c1e]">
                      Open live view
                    </span>
                  </span>
                  <Icon name="open_in_new" className="h-5 w-5 text-[#27389a]" />
                </Link>
                <form action="/api/admin/logout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-2xl bg-[#27389a] px-4 py-3 text-left text-white transition-opacity hover:opacity-92"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
                        Session
                      </span>
                      <span className="mt-1 block font-headline text-base font-bold">
                        Logout
                      </span>
                    </span>
                    <Icon name="logout" className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </section>
          </div>
        </aside>
      </main>

    </div>
  );
}
