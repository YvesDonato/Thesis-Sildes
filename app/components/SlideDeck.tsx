"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

type SlideDeckProps = {
  slides: string[];
  deckTitle: string;
  syncRole?: "viewer" | "admin";
  externalSlideIndex?: number;
  externalRevealStep?: number;
  noScroll?: boolean;
  onCursorCommitted?: (cursor: {
    slideIndex: number;
    revealStep: number;
  }) => void | Promise<void>;
};

const SLIDE_HASH = /^#slide-(\d+)$/i;
const ALIGNMENT_DIRECTIVE = /^\s*<!--\s*alignment:\s*(center|left)\s*-->\s*$/i;
const INCREMENTAL_LISTS_DIRECTIVE =
  /^\s*<!--\s*incremental_lists:\s*(true|false)\s*-->\s*$/i;
const LIST_ITEM_NEWLINES_DIRECTIVE =
  /^\s*<!--\s*list_item_newlines:\s*(\d+)\s*-->\s*$/i;
const PAUSE_DIRECTIVE = /^\s*<!--\s*pause(?:\s*:\s*\d+)?\s*-->\s*$/i;
const NEW_LINES_DIRECTIVE =
  /^\s*<!--\s*new_lines?(?:\s*:\s*\d+)?\s*-->\s*$/i;
const LIST_ITEM_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

type SlideChunk = {
  alignment: "left" | "center";
  incrementalLists: boolean;
  listItemNewlines: number;
  revealGroup: number;
  markdown: string;
};

type RenderChunk = SlideChunk & {
  isVisible: boolean;
  normalizedMarkdown: string;
  totalListItems: number;
  visibleListItems: number | null;
};

type NavigationIntent = "next" | "previous" | "jump" | "external";

type TreeNode = {
  type?: string;
  children?: TreeNode[];
};

type RevealMetrics = {
  maxRevealStep: number;
};

const ARTICLE_CLASS_COMMON = [
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:text-[clamp(1.6rem,3vw,2.5rem)] [&_h1]:leading-tight",
  "[&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-[clamp(1.35rem,2.3vw,1.9rem)] [&_h2]:leading-tight",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:leading-tight [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:leading-tight",
  "[&_p]:text-[clamp(1rem,1.1vw,1.15rem)] [&_li]:text-[clamp(1rem,1.1vw,1.15rem)]",
  "[&_blockquote]:text-[clamp(1rem,1.1vw,1.15rem)]",
  "[&_ul]:my-3 [&_ol]:my-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6",
  "[&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square] [&_ol_ol]:list-[lower-alpha]",
  "[&_li+li]:mt-1.5",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted",
  "[&_a]:text-brand [&_a]:underline-offset-[0.2rem]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-code-bg [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-code-fg",
  "[&_code]:font-mono",
  "[&_table]:w-full [&_table]:border-collapse",
  "[&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border",
  "[&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-2 [&_th]:text-left [&_td]:text-left",
  "[&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg",
];

const ARTICLE_CLASS = [
  "w-full max-w-[68rem] max-h-[calc(100vh-11rem)] overflow-auto rounded-2xl border border-border",
  "bg-surface p-[clamp(1.25rem,3.2vw,2.75rem)] shadow-[var(--theme-shadow-elevated)] leading-[1.55]",
  ...ARTICLE_CLASS_COMMON,
].join(" ");

const ARTICLE_CLASS_NO_SCROLL = [
  "w-full max-w-[68rem] overflow-hidden rounded-2xl border border-border",
  "bg-surface p-[clamp(1.25rem,3.2vw,2.75rem)] shadow-[var(--theme-shadow-elevated)] leading-[1.55]",
  ...ARTICLE_CLASS_COMMON,
].join(" ");

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

function hashToIndex(hash: string, total: number) {
  const match = hash.match(SLIDE_HASH);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return clampIndex(parsed - 1, total);
}

function isListItemLine(line: string) {
  return LIST_ITEM_MARKER.test(line);
}

function normalizeListMarkdown(markdown: string, listItemNewlines: number) {
  const desiredBlankLines = Math.max(0, listItemNewlines - 1);
  if (desiredBlankLines === 0) {
    return markdown;
  }

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inCodeFence = false;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      output.push(line);
      index += 1;
      continue;
    }

    if (inCodeFence || !isListItemLine(line)) {
      output.push(line);
      index += 1;
      continue;
    }

    output.push(line);

    let next = index + 1;
    let blankLines = 0;
    while (next < lines.length && lines[next].trim() === "") {
      blankLines += 1;
      next += 1;
    }

    if (next < lines.length && isListItemLine(lines[next])) {
      for (let i = 0; i < desiredBlankLines; i += 1) {
        output.push("");
      }
      index = next;
      continue;
    }

    for (let i = 0; i < blankLines; i += 1) {
      output.push("");
    }

    index += 1;
  }

  return output.join("\n");
}

function countListItems(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  let inCodeFence = false;
  let count = 0;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!inCodeFence && isListItemLine(line)) {
      count += 1;
    }
  }

  return count;
}

function createListItemLimitPlugin(maxVisibleItems: number) {
  return () => {
    return (tree: TreeNode) => {
      let seen = 0;

      const prune = (node: TreeNode) => {
        if (!Array.isArray(node.children)) {
          return;
        }

        const nextChildren: TreeNode[] = [];
        for (const child of node.children) {
          if (child.type === "listItem") {
            seen += 1;
            if (seen <= maxVisibleItems) {
              prune(child);
              nextChildren.push(child);
            }
            continue;
          }

          prune(child);
          nextChildren.push(child);
        }

        node.children = nextChildren;
      };

      prune(tree);
    };
  };
}

function parseSlideChunks(markdown: string): SlideChunk[] {
  const lines = markdown.split(/\r?\n/);
  const chunks: SlideChunk[] = [];
  let currentAlignment: SlideChunk["alignment"] = "left";
  let currentIncrementalLists = false;
  let currentListItemNewlines = 1;
  let currentRevealGroup = 0;
  let inCodeFence = false;
  let buffer: string[] = [];

  const pushChunk = () => {
    const chunkMarkdown = buffer.join("\n").trim();
    if (chunkMarkdown.length > 0) {
      chunks.push({
        alignment: currentAlignment,
        incrementalLists: currentIncrementalLists,
        listItemNewlines: currentListItemNewlines,
        revealGroup: currentRevealGroup,
        markdown: chunkMarkdown,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      buffer.push(line);
      continue;
    }

    if (inCodeFence) {
      buffer.push(line);
      continue;
    }

    const alignmentDirective = line.match(ALIGNMENT_DIRECTIVE);
    if (alignmentDirective) {
      pushChunk();
      currentAlignment =
        alignmentDirective[1].toLowerCase() === "center" ? "center" : "left";
      continue;
    }

    const incrementalListsDirective = line.match(INCREMENTAL_LISTS_DIRECTIVE);
    if (incrementalListsDirective) {
      pushChunk();
      currentIncrementalLists =
        incrementalListsDirective[1].toLowerCase() === "true";
      continue;
    }

    const listItemNewlinesDirective = line.match(LIST_ITEM_NEWLINES_DIRECTIVE);
    if (listItemNewlinesDirective) {
      pushChunk();
      currentListItemNewlines = Math.max(
        1,
        Number.parseInt(listItemNewlinesDirective[1], 10) || 1,
      );
      continue;
    }

    if (PAUSE_DIRECTIVE.test(line)) {
      pushChunk();
      currentRevealGroup += 1;
      continue;
    }

    if (NEW_LINES_DIRECTIVE.test(line)) {
      continue;
    }

    if (/^\s*<!--\s*end_slide\s*-->/.test(line)) {
      continue;
    }

    if (/^\s*<!--/.test(line)) {
      continue;
    }

    if (line.length === 0 && buffer.length === 0) {
      continue;
    }

    buffer.push(line);
  }

  pushChunk();

  if (chunks.length === 0) {
    const trimmed = markdown.trim();
    return trimmed.length > 0
      ? [
          {
            alignment: "left",
            incrementalLists: false,
            listItemNewlines: 1,
            revealGroup: 0,
            markdown: trimmed,
          },
        ]
      : [
          {
            alignment: "left",
            incrementalLists: false,
            listItemNewlines: 1,
            revealGroup: 0,
            markdown: "# No slide content",
          },
        ];
  }

  return chunks;
}

function getRevealMetricsForChunks(chunks: SlideChunk[]): RevealMetrics {
  let maxRevealGroup = 0;
  let totalListItems = 0;

  for (const chunk of chunks) {
    if (chunk.revealGroup > maxRevealGroup) {
      maxRevealGroup = chunk.revealGroup;
    }

    if (!chunk.incrementalLists) {
      continue;
    }

    const normalized = normalizeListMarkdown(
      chunk.markdown,
      chunk.listItemNewlines,
    );
    totalListItems += countListItems(normalized);
  }

  const hasRevealBehavior = maxRevealGroup > 0 || totalListItems > 0;
  if (!hasRevealBehavior) {
    return { maxRevealStep: 0 };
  }

  const additionalListReveals = Math.max(0, totalListItems - 1);
  const totalRevealActions = maxRevealGroup + additionalListReveals;
  return { maxRevealStep: 1 + totalRevealActions };
}

function getMaxRevealStepsForSlide(markdown: string) {
  return getRevealMetricsForChunks(parseSlideChunks(markdown)).maxRevealStep;
}

function getInitialRevealStepForSlide(markdown: string) {
  const max = getMaxRevealStepsForSlide(markdown);
  return max > 0 ? 1 : 0;
}

function clampRevealStepForSlide(markdown: string, revealStep: number) {
  const max = getMaxRevealStepsForSlide(markdown);
  if (!Number.isFinite(revealStep) || max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(Math.floor(revealStep), max));
}

function resolveRevealStepForSlide(
  markdown: string,
  revealStep: number | null | undefined,
) {
  if (revealStep === undefined || revealStep === null) {
    return getInitialRevealStepForSlide(markdown);
  }

  return clampRevealStepForSlide(markdown, revealStep);
}

function shouldAnimateSlideEntry(
  navigationIntent: NavigationIntent,
  previousIndex: number,
  nextIndex: number,
) {
  if (nextIndex <= previousIndex) {
    return false;
  }

  return navigationIntent === "next" || navigationIntent === "external";
}

export default function SlideDeck({
  slides,
  deckTitle,
  syncRole = "viewer",
  externalSlideIndex,
  externalRevealStep,
  noScroll = false,
  onCursorCommitted,
}: SlideDeckProps) {
  const total = slides.length;
  const isFollower = syncRole === "viewer";
  const initialIndex = clampIndex(externalSlideIndex ?? 0, total);
  const initialRevealStep = resolveRevealStepForSlide(
    slides[initialIndex] ?? "",
    externalRevealStep,
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [revealStep, setRevealStep] = useState(initialRevealStep);
  const currentIndexRef = useRef(initialIndex);
  const revealStepRef = useRef(initialRevealStep);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentScale, setContentScale] = useState(1);
  const [slideAnimationKey, setSlideAnimationKey] = useState(0);
  const [animateSlideEntry, setAnimateSlideEntry] = useState(false);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    revealStepRef.current = revealStep;
  }, [revealStep]);

  const recalculateScale = useCallback(() => {
    if (!noScroll) {
      return;
    }

    const viewportElement = viewportRef.current;
    const contentElement = contentRef.current;
    if (!viewportElement || !contentElement) {
      return;
    }

    const viewportWidth = viewportElement.clientWidth;
    const viewportHeight = viewportElement.clientHeight;
    const contentWidth = contentElement.offsetWidth;
    const contentHeight = contentElement.offsetHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      return;
    }

    const nextScale = Math.min(
      1,
      viewportWidth / contentWidth,
      viewportHeight / contentHeight,
    );
    setContentScale((previousScale) =>
      Math.abs(previousScale - nextScale) < 0.01 ? previousScale : nextScale,
    );
  }, [noScroll]);

  useEffect(() => {
    if (!noScroll) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      recalculateScale();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentIndex, noScroll, recalculateScale, revealStep, total]);

  useEffect(() => {
    if (!noScroll) {
      return;
    }

    const viewportElement = viewportRef.current;
    const contentElement = contentRef.current;
    if (!viewportElement || !contentElement) {
      return;
    }

    const onWindowResize = () => {
      recalculateScale();
    };
    window.addEventListener("resize", onWindowResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        recalculateScale();
      });
      observer.observe(viewportElement);
      observer.observe(contentElement);
    }

    return () => {
      window.removeEventListener("resize", onWindowResize);
      observer?.disconnect();
    };
  }, [noScroll, recalculateScale]);

  const goTo = useCallback(
    (
      index: number,
      options: {
        source?: "local" | "external";
        revealStep?: number | null;
        navigationIntent?: NavigationIntent;
      } = {},
    ) => {
      const source = options.source ?? "local";
      const navigationIntent =
        options.navigationIntent ?? (source === "external" ? "external" : "jump");
      if (source === "local" && isFollower) {
        return;
      }

      const clamped = clampIndex(index, total);
      const previousIndex = currentIndexRef.current;
      const slideMarkdown = slides[clamped] ?? "";
      const nextRevealStep = resolveRevealStepForSlide(
        slideMarkdown,
        options.revealStep,
      );
      const slideChanged = clamped !== currentIndexRef.current;
      const revealChanged = nextRevealStep !== revealStepRef.current;
      if (!slideChanged && !revealChanged) {
        return;
      }

      if (slideChanged) {
        currentIndexRef.current = clamped;
        setCurrentIndex(clamped);
        const shouldAnimateForwardEntry = shouldAnimateSlideEntry(
          navigationIntent,
          previousIndex,
          clamped,
        );
        setAnimateSlideEntry(shouldAnimateForwardEntry);
        setSlideAnimationKey((value) => value + 1);
      }
      if (revealChanged) {
        revealStepRef.current = nextRevealStep;
        setRevealStep(nextRevealStep);
      }

      if (
        source === "local" &&
        syncRole === "admin" &&
        onCursorCommitted
      ) {
        void onCursorCommitted({
          slideIndex: clamped,
          revealStep: nextRevealStep,
        });
      }
    },
    [isFollower, onCursorCommitted, slides, syncRole, total],
  );

  const goPrevious = useCallback(() => {
    goTo(currentIndex - 1, { navigationIntent: "previous" });
  }, [currentIndex, goTo]);

  const goFirst = useCallback(() => {
    goTo(0, { navigationIntent: "jump" });
  }, [goTo]);

  const goLast = useCallback(() => {
    goTo(total - 1, { navigationIntent: "jump" });
  }, [goTo, total]);

  useEffect(() => {
    if (isFollower || total === 0) {
      return;
    }

    const handleHashChange = () => {
      const hashIndex = hashToIndex(window.location.hash, total);
      if (hashIndex !== null) {
        goTo(hashIndex, { source: "local", navigationIntent: "jump" });
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [goTo, isFollower, total]);

  useEffect(() => {
    if (externalSlideIndex === undefined || externalSlideIndex === null) {
      return;
    }

    const clampedExternalSlideIndex = clampIndex(externalSlideIndex, total);
    const normalizedExternalRevealStep = resolveRevealStepForSlide(
      slides[clampedExternalSlideIndex] ?? "",
      externalRevealStep,
    );
    if (
      clampedExternalSlideIndex === currentIndexRef.current &&
      normalizedExternalRevealStep === revealStepRef.current
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      goTo(clampedExternalSlideIndex, {
        source: "external",
        navigationIntent: "external",
        revealStep: normalizedExternalRevealStep,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [externalRevealStep, externalSlideIndex, goTo, slides, total]);

  useEffect(() => {
    if (isFollower || total === 0) {
      return;
    }

    const targetHash = `#slide-${currentIndex + 1}`;
    if (window.location.hash === targetHash) {
      return;
    }

    window.history.replaceState(null, "", targetHash);
  }, [currentIndex, isFollower, total]);

  const slide = useMemo(() => {
    if (total === 0) {
      return "# No slides available";
    }

    return slides[currentIndex];
  }, [currentIndex, slides, total]);

  const chunks = useMemo(() => parseSlideChunks(slide), [slide]);

  const revealMetrics = useMemo(
    () => getRevealMetricsForChunks(chunks),
    [chunks],
  );
  const maxRevealSteps = revealMetrics.maxRevealStep;

  const hasPendingReveal = maxRevealSteps > 0 && revealStep < maxRevealSteps;

  const goNext = useCallback(() => {
    if (hasPendingReveal) {
      const nextRevealStep = Math.min(revealStepRef.current + 1, maxRevealSteps);
      if (nextRevealStep === revealStepRef.current) {
        return;
      }

      setAnimateSlideEntry(false);
      revealStepRef.current = nextRevealStep;
      setRevealStep(nextRevealStep);

      if (syncRole === "admin" && onCursorCommitted) {
        void onCursorCommitted({
          slideIndex: currentIndexRef.current,
          revealStep: nextRevealStep,
        });
      }
      return;
    }

    goTo(currentIndex + 1, { navigationIntent: "next" });
  }, [
    currentIndex,
    goTo,
    hasPendingReveal,
    maxRevealSteps,
    onCursorCommitted,
    syncRole,
  ]);

  useEffect(() => {
    if (isFollower || total === 0) {
      return;
    }

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
  }, [goFirst, goLast, goNext, goPrevious, isFollower, total]);

  const renderedChunks = useMemo<RenderChunk[]>(() => {
    const initial = {
      items: [] as RenderChunk[],
      remainingRevealActions: Math.max(0, revealStep - 1),
      currentRevealGroup: 0,
      currentRevealGroupVisible: true,
      firstIncrementalListItemGranted: false,
    };

    return chunks
      .reduce((acc, chunk) => {
        const normalizedMarkdown = normalizeListMarkdown(
          chunk.markdown,
          chunk.listItemNewlines,
        );
        const totalListItems = chunk.incrementalLists
          ? countListItems(normalizedMarkdown)
          : 0;

        const revealGroupDelta =
          chunk.revealGroup === acc.currentRevealGroup
            ? 0
            : Math.max(0, chunk.revealGroup - acc.currentRevealGroup);
        const canRevealGroup =
          revealGroupDelta === 0 ||
          acc.remainingRevealActions >= revealGroupDelta;
        const nextRemainingAfterGroup = canRevealGroup
          ? acc.remainingRevealActions - revealGroupDelta
          : acc.remainingRevealActions;
        const nextGroupVisible =
          revealGroupDelta === 0 ? acc.currentRevealGroupVisible : canRevealGroup;
        const nextCurrentRevealGroup =
          revealGroupDelta === 0 ? acc.currentRevealGroup : chunk.revealGroup;

        if (!nextGroupVisible) {
          return {
            ...acc,
            currentRevealGroup: nextCurrentRevealGroup,
            currentRevealGroupVisible: false,
            items: [
              ...acc.items,
              {
                ...chunk,
                isVisible: false,
                normalizedMarkdown,
                totalListItems,
                visibleListItems: 0,
              },
            ],
          };
        }

        if (!chunk.incrementalLists) {
          return {
            ...acc,
            remainingRevealActions: nextRemainingAfterGroup,
            currentRevealGroup: nextCurrentRevealGroup,
            currentRevealGroupVisible: true,
            items: [
              ...acc.items,
              {
                ...chunk,
                isVisible: true,
                normalizedMarkdown,
                totalListItems,
                visibleListItems: null,
              },
            ],
          };
        }

        const baselineVisibleListItems =
          !acc.firstIncrementalListItemGranted && totalListItems > 0 ? 1 : 0;
        const additionalListItems = Math.max(
          0,
          totalListItems - baselineVisibleListItems,
        );
        const revealedAdditionalListItems = Math.min(
          nextRemainingAfterGroup,
          additionalListItems,
        );

        return {
          ...acc,
          remainingRevealActions:
            nextRemainingAfterGroup - revealedAdditionalListItems,
          currentRevealGroup: nextCurrentRevealGroup,
          currentRevealGroupVisible: true,
          firstIncrementalListItemGranted:
            acc.firstIncrementalListItemGranted || baselineVisibleListItems > 0,
          items: [
            ...acc.items,
            {
              ...chunk,
              isVisible: true,
              normalizedMarkdown,
              totalListItems,
              visibleListItems:
                baselineVisibleListItems + revealedAdditionalListItems,
            },
          ],
        };
      }, initial)
      .items;
  }, [chunks, revealStep]);

  const containerClassName = noScroll
    ? "flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 sm:p-4"
    : "flex min-h-screen flex-col gap-4 p-3 sm:p-4";
  const mainClassName = noScroll
    ? "grid min-h-0 flex-1 place-items-center"
    : "grid flex-1 place-items-center";
  const articleClassName = noScroll ? ARTICLE_CLASS_NO_SCROLL : ARTICLE_CLASS;
  const animatedArticleClassName = [
    articleClassName,
    animateSlideEntry ? "slide-next-enter" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName}>
      <header className="flex flex-col gap-1 text-muted sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="m-0 text-[clamp(1.1rem,1.8vw,1.35rem)] tracking-[0.02em]">
          {deckTitle}
        </h1>
        <p className="m-0 text-[0.95rem] tabular-nums">
          Slide {Math.min(currentIndex + 1, total)} of {total}
        </p>
      </header>

      <main className={mainClassName}>
        <div
          ref={viewportRef}
          className={noScroll ? "grid h-full w-full min-h-0 min-w-0 place-items-center overflow-hidden" : "contents"}
        >
          <div
            ref={contentRef}
            className={noScroll ? "w-full max-w-[68rem]" : "contents"}
            style={
              noScroll
                ? {
                    transform: `scale(${contentScale})`,
                    transformOrigin: "top center",
                  }
                : undefined
            }
          >
            <article
              key={`slide-${currentIndex}-${slideAnimationKey}`}
              className={animatedArticleClassName}
              role="region"
              aria-label={`Slide ${Math.min(currentIndex + 1, total)} of ${total}`}
            >
              {renderedChunks.map((chunk, index) => {
                if (!chunk.isVisible) {
                  return null;
                }

                const remarkPlugins = chunk.incrementalLists
                  ? [
                      remarkGfm,
                      remarkMath,
                      createListItemLimitPlugin(chunk.visibleListItems ?? 0),
                    ]
                  : [remarkGfm, remarkMath];
                const chunkClassName = [
                  index > 0 ? "mt-4" : "",
                  chunk.alignment === "center"
                    ? "text-center [&_ul]:mx-auto [&_ol]:mx-auto [&_ul]:inline-block [&_ol]:inline-block [&_ul]:text-left [&_ol]:text-left [&_img]:mx-auto"
                    : "text-left",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <section key={`${chunk.alignment}-${index}`} className={chunkClassName}>
                    <ReactMarkdown
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={[rehypeRaw, rehypeKatex]}
                      components={{
                        img: (props) => (
                          // Using plain img keeps markdown image passthrough behavior.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            {...props}
                            alt={props.alt ?? ""}
                            loading="lazy"
                            decoding="async"
                          />
                        ),
                      }}
                    >
                      {chunk.normalizedMarkdown}
                    </ReactMarkdown>
                  </section>
                );
              })}
            </article>
          </div>
        </div>
      </main>

      {!isFollower ? (
        <nav className="flex justify-center gap-3" aria-label="Slide navigation">
          <button
            type="button"
            onClick={goPrevious}
            disabled={currentIndex <= 0}
            aria-label="Previous slide"
            className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand transition-colors duration-150 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex >= total - 1 && !hasPendingReveal}
            aria-label="Next slide"
            className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand transition-colors duration-150 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
