"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DeckSlide } from "../lib/deck-data";
import SlideDeck, {
  getInitialRevealStepForSlide,
  getMaxRevealStepsForSlide,
} from "./SlideDeck";

type AdminPresenterConsoleProps = {
  slides: DeckSlide[];
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

type TimerStatus = "idle" | "running" | "paused";

type IconName =
  | "arrow_back"
  | "arrow_forward"
  | "cloud_done"
  | "logout"
  | "open_in_new"
  | "play_arrow"
  | "sync";

const NOTES_MARKDOWN_CLASS = [
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:text-sm [&_p]:leading-6 [&_p]:text-[#191c1e]",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:text-sm [&_li]:leading-6 [&_li]:text-[#191c1e]",
  "[&_li+li]:mt-1.5",
  "[&_strong]:font-semibold [&_strong]:text-[#191c1e]",
  "[&_em]:italic",
  "[&_code]:rounded [&_code]:bg-[#eceef0] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.82rem]",
].join(" ");

const EMPTY_SLIDE: DeckSlide = {
  content: "# No slides available",
};

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

function formatElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const minutesPart = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const secondsPart = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${minutesPart}:${secondsPart}`;
  }

  return `${minutesPart}:${secondsPart}`;
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
  const [notesByIndex, setNotesByIndex] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      slides.map((slide, index) => [index, slide.notes?.trim() ?? ""]),
    ),
  );
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaveState, setNotesSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [notesError, setNotesError] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerStartedAtRef = useRef<number | null>(null);

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
  const currentSlide = slides[currentIndex] ?? EMPTY_SLIDE;
  const initialRevealStepForCurrentSlide =
    getInitialRevealStepForSlide(currentSlide.content);
  const maxRevealSteps = getMaxRevealStepsForSlide(currentSlide.content);
  const hasPendingReveal =
    maxRevealSteps > 0 && cursor.revealStep < maxRevealSteps;
  const canGoPreviousReveal =
    cursor.revealStep > initialRevealStepForCurrentSlide;
  const currentTitle = useMemo(
    () => getSlideTitle(currentSlide.content, `Slide ${currentIndex + 1}`),
    [currentIndex, currentSlide],
  );
  const nextIndex = currentIndex < total - 1 ? currentIndex + 1 : null;
  const nextSlide = nextIndex === null ? null : (slides[nextIndex] ?? null);
  const nextRevealStep =
    nextSlide === null ? 0 : getInitialRevealStepForSlide(nextSlide.content);
  const nextTitle =
    nextSlide === null
      ? null
      : getSlideTitle(
          nextSlide.content,
          `Slide ${(nextIndex ?? currentIndex) + 1}`,
        );
  const currentNotes =
    notesByIndex[currentIndex] ?? currentSlide.notes?.trim() ?? "";

  useEffect(() => {
    setNotesDraft(currentNotes);
    setNotesSaveState("idle");
    setNotesError("");
    setIsEditingNotes(false);
  }, [currentIndex, currentNotes]);

  useEffect(() => {
    if (timerStatus !== "running") {
      return;
    }

    const updateElapsedTime = () => {
      if (timerStartedAtRef.current === null) {
        return;
      }

      setElapsedMs(Math.max(0, Date.now() - timerStartedAtRef.current));
    };

    updateElapsedTime();
    const intervalId = window.setInterval(updateElapsedTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerStatus]);

  const goToSlide = useCallback(
    (index: number, revealStep?: number) => {
      const clamped = clampIndex(index, total);
      const slide = slides[clamped]?.content ?? "";
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

  const saveNotes = useCallback(async () => {
    setNotesSaveState("saving");
    setNotesError("");

    try {
      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIndex: currentIndex,
          notes: notesDraft,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        notes?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to save notes");
      }

      const savedNotes = payload.notes?.trim() ?? "";
      setNotesByIndex((previous) => ({
        ...previous,
        [currentIndex]: savedNotes,
      }));
      setNotesDraft(savedNotes);
      setNotesSaveState("saved");
      setIsEditingNotes(false);
    } catch (error) {
      setNotesSaveState("error");
      setNotesError(
        error instanceof Error ? error.message : "Failed to save notes",
      );
    }
  }, [currentIndex, notesDraft]);

  const resetNotesDraft = useCallback(() => {
    setNotesDraft(currentNotes);
    setNotesSaveState("idle");
    setNotesError("");
    setIsEditingNotes(false);
  }, [currentNotes]);

  const startTimer = useCallback(() => {
    if (timerStatus === "running") {
      return;
    }

    timerStartedAtRef.current = Date.now() - elapsedMs;
    setTimerStatus("running");
  }, [elapsedMs, timerStatus]);

  const pauseTimer = useCallback(() => {
    if (timerStatus !== "running") {
      return;
    }

    if (timerStartedAtRef.current !== null) {
      setElapsedMs(Math.max(0, Date.now() - timerStartedAtRef.current));
    }
    timerStartedAtRef.current = null;
    setTimerStatus("paused");
  }, [timerStatus]);

  const resetTimer = useCallback(() => {
    timerStartedAtRef.current = null;
    setElapsedMs(0);
    setTimerStatus("idle");
  }, []);

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
  const notesDirty = notesDraft !== currentNotes;
  const formattedElapsedTime = useMemo(
    () => formatElapsedTime(elapsedMs),
    [elapsedMs],
  );
  const timerStatusLabel =
    timerStatus === "running"
      ? "Running"
      : timerStatus === "paused"
        ? "Paused"
        : "Ready";
  const timerStatusClassName =
    timerStatus === "running"
      ? "bg-emerald-100 text-emerald-800"
      : timerStatus === "paused"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-200 text-slate-700";

  const renderNotesPanel = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {isEditingNotes ? (
          <>
            <button
              type="button"
              onClick={() => {
                void saveNotes();
              }}
              disabled={notesSaveState === "saving" || !notesDirty}
              className="rounded-full bg-[#27389a] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {notesSaveState === "saving" ? "Saving..." : "Save notes"}
            </button>
            <button
              type="button"
              onClick={resetNotesDraft}
              disabled={notesSaveState === "saving"}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#191c1e] transition-colors hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsEditingNotes(true);
              setNotesSaveState("idle");
              setNotesError("");
            }}
            className="rounded-full bg-[#27389a] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-95"
          >
            Edit notes
          </button>
        )}
        <span className="text-xs font-semibold text-[#48626e]">
          {notesSaveState === "saved"
            ? "Saved to markdown"
            : notesSaveState === "error"
              ? notesError || "Save failed"
              : notesDirty
                ? "Unsaved changes"
                : "Up to date"}
        </span>
      </div>
      {isEditingNotes ? (
        <label className="block">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
            Edit markdown notes
          </span>
          <textarea
            value={notesDraft}
            onChange={(event) => {
              setNotesDraft(event.target.value);
              if (notesSaveState !== "idle") {
                setNotesSaveState("idle");
              }
              if (notesError) {
                setNotesError("");
              }
            }}
            rows={8}
            spellCheck={false}
            className="min-h-[10rem] w-full rounded-2xl border border-slate-200 bg-[#f8f9fb] px-4 py-3 font-mono text-[0.88rem] leading-6 text-[#191c1e] outline-none transition-colors focus:border-[#27389a] focus:bg-white"
            placeholder="Add speaker notes in markdown for this slide."
          />
        </label>
      ) : null}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
          Preview
        </p>
        {notesDraft.trim() ? (
          <div className={NOTES_MARKDOWN_CLASS}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {notesDraft}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#f2f4f6] p-4 text-sm font-medium text-[#48626e]">
            No speaker notes added for this slide.
          </div>
        )}
      </div>
    </div>
  );

  const renderTimerCard = (compact = false) => (
    <div className="rounded-2xl bg-[#f2f4f6] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
            Presentation timer
          </p>
          <p
            className={[
              "mt-1 font-headline font-extrabold text-[#27389a] tabular-nums",
              compact ? "text-[2rem]" : "text-[2.3rem]",
            ].join(" ")}
          >
            {formattedElapsedTime}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${timerStatusClassName}`}
        >
          {timerStatusLabel}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startTimer}
          disabled={timerStatus === "running"}
          className="rounded-full bg-[#27389a] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Start
        </button>
        <button
          type="button"
          onClick={pauseTimer}
          disabled={timerStatus !== "running"}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#191c1e] transition-colors hover:bg-[#eceef0] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={resetTimer}
          disabled={timerStatus === "idle" && elapsedMs === 0}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#191c1e] transition-colors hover:bg-[#eceef0] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fb] text-[#191c1e]">
      <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f8f9fb]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <span className="max-w-[11rem] truncate font-headline text-base font-extrabold tracking-tight text-[#27389a] sm:max-w-none sm:text-lg">
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
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-[#27389a] transition-colors hover:bg-slate-100 md:hidden"
            >
              <Icon name="open_in_new" className="h-4 w-4" />
              Audience
            </Link>
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
        <section className="flex min-h-0 flex-1 flex-col bg-[#f2f4f6] p-3 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#48626e]">
                Presenter Console
              </p>
              <h1 className="font-headline text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-4xl">
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

          <div className="relative min-h-[18rem] flex-1 rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(236,238,240,0.7))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:min-h-[26rem] sm:rounded-[1.5rem] sm:p-4">
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
                viewMode="audience"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <button
              type="button"
              onClick={goPrevious}
              disabled={currentIndex <= 0}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-[#27389a]/25 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 sm:px-5 sm:py-4 xl:min-w-[17rem]"
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
                          slides[currentIndex - 1]?.content ?? "",
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
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-[#27389a]/25 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 sm:px-5 sm:py-4 xl:min-w-[14rem]"
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

              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
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
              className="group flex items-center justify-between gap-4 rounded-2xl border border-[#27389a]/15 bg-[#27389a] px-4 py-3 text-white shadow-[0_18px_40px_rgba(39,56,154,0.18)] transition-all hover:shadow-[0_22px_48px_rgba(39,56,154,0.24)] disabled:cursor-not-allowed disabled:opacity-45 sm:px-5 sm:py-4 xl:min-w-[17rem]"
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

          <div className="mt-5 flex flex-col gap-3 xl:hidden">
            <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Session
                  </span>
                  <span className="mt-1 block font-headline text-base font-bold text-[#191c1e]">
                    Deck and jump controls
                  </span>
                </span>
                <span className="text-xs font-bold text-[#27389a]">
                  Slide {currentIndex + 1}/{total}
                </span>
              </summary>
              <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                <div className="rounded-2xl bg-[#f2f4f6] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Deck
                  </p>
                  <p className="mt-1 font-headline text-lg font-extrabold text-[#191c1e]">
                    {deckTitle}
                  </p>
                </div>
                {renderTimerCard(true)}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={goFirst}
                    className="rounded-2xl bg-[#eceef0] px-4 py-3 text-left transition-colors hover:bg-[#e0e3e5]"
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                      Jump
                    </span>
                    <span className="mt-1 block font-headline text-sm font-bold text-[#191c1e]">
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
                    <span className="mt-1 block font-headline text-sm font-bold text-[#191c1e]">
                      Last slide
                    </span>
                  </button>
                </div>
              </div>
            </details>

            <details
              open
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Next Up
                  </span>
                  <span className="mt-1 block font-headline text-base font-bold text-[#191c1e]">
                    {nextTitle ?? "Final slide"}
                  </span>
                </span>
                <span className="text-xs font-bold text-[#27389a]">
                  {nextIndex === null ? "Done" : `Slide ${nextIndex + 1}`}
                </span>
              </summary>
              <div className="border-t border-slate-200 px-4 py-4">
                {nextSlide ? (
                  <div className="space-y-3">
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
                        viewMode="audience"
                      />
                    </div>
                    <p className="font-headline text-base font-bold text-[#191c1e]">
                      {nextTitle}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#f2f4f6] p-4 text-sm font-medium text-[#48626e]">
                    You are on the final slide. No additional preview is available.
                  </div>
                )}
              </div>
            </details>

            <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#48626e]">
                    Speaker Notes
                  </span>
                  <span className="mt-1 block font-headline text-base font-bold text-[#191c1e]">
                    Notes for this slide
                  </span>
                </span>
                <span className="text-xs font-bold text-[#27389a]">
                  {currentNotes ? "Ready" : "Empty"}
                </span>
              </summary>
              <div className="border-t border-slate-200 px-4 py-4">
                {renderNotesPanel()}
              </div>
            </details>
          </div>
        </section>

        <aside className="hidden w-full shrink-0 bg-[#f8f9fb] p-4 sm:p-6 xl:block xl:w-[24rem] xl:overflow-y-auto">
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
                {renderTimerCard()}
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
                      viewMode="audience"
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

            <section className="flex min-h-[14rem] flex-1 flex-col rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-headline text-sm font-extrabold uppercase tracking-[0.18em] text-[#48626e]">
                Speaker Notes
              </h2>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {renderNotesPanel()}
              </div>
            </section>
          </div>
        </aside>
      </main>

    </div>
  );
}
