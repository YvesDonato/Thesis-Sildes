import fs from "node:fs/promises";
import path from "node:path";
import { replaceLatexBlocksWithHtml } from "./latex-render";

const EXAMPLE_PATH = path.join(
  process.cwd(),
  "content/examples/01-thesis-defense.md",
);

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const SLIDE_SEPARATOR = /^\s*---\s*$/;
const END_SLIDE_SEPARATOR = /^\s*<!--\s*end_slide\s*-->\s*$/i;
const NOTES_START = /^\s*<!--\s*notes\s*-->\s*$/i;
const NOTES_END = /^\s*<!--\s*end_notes\s*-->\s*$/i;
const CODE_FENCE = /^\s*```/;
const DEFAULT_DECK_TITLE = "Markdown Slide Maker";

type FrontMatter = {
  title?: string;
  sub_title?: string;
  author?: string;
  speaker_notes?: string;
};

export type DeckSlide = {
  content: string;
  notes?: string;
};

export type DeckData = {
  deckTitle: string;
  deckSubtitle?: string;
  slides: DeckSlide[];
};

type ParsedFrontMatter = {
  frontMatter: FrontMatter;
  body: string;
  hasFrontMatter: boolean;
};

const FALLBACK_SLIDES = [
  {
    content: [
      "# Markdown Slide Maker",
      "",
      "No slide source was found at `content/examples/01-thesis-defense.md`.",
      "",
      "Add markdown slides separated by `---` or `<!-- end_slide -->`.",
    ].join("\n"),
    notes: "Add a markdown deck and optional `<!-- notes -->` blocks.",
  },
];

function normalizeLineEndings(markdown: string) {
  return markdown.replace(/\r\n?/g, "\n");
}

function parseFrontMatter(markdown: string) {
  const normalized = normalizeLineEndings(markdown);
  const match = normalized.match(FRONT_MATTER);

  if (!match) {
    return {
      frontMatter: {} as FrontMatter,
      body: normalized,
      hasFrontMatter: false,
    } satisfies ParsedFrontMatter;
  }

  const rawFrontMatter = match[1].split("\n");
  const frontMatter: FrontMatter = {};

  for (let index = 0; index < rawFrontMatter.length; index += 1) {
    const line = rawFrontMatter[index];
    const parsed = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!parsed) {
      continue;
    }

    const key = parsed[1];
    const value = parsed[2].trim().replace(/^["']|["']$/g, "");

    if (key === "title" && value.length > 0) {
      frontMatter.title = value;
    } else if (key === "sub_title" && value.length > 0) {
      frontMatter.sub_title = value;
    } else if (key === "author" && value.length > 0) {
      frontMatter.author = value;
    } else if (key === "speaker_notes" && value === "|") {
      const noteLines: string[] = [];
      let nextIndex = index + 1;

      while (nextIndex < rawFrontMatter.length) {
        const blockLine = rawFrontMatter[nextIndex];
        if (/^\s{2,}/.test(blockLine) || blockLine.trim().length === 0) {
          noteLines.push(
            blockLine.trim().length === 0 ? "" : blockLine.replace(/^\s{2}/, ""),
          );
          nextIndex += 1;
          continue;
        }
        break;
      }

      const notes = noteLines.join("\n").trim();
      if (notes.length > 0) {
        frontMatter.speaker_notes = notes;
      }
      index = nextIndex - 1;
    } else if (key === "speaker_notes" && value.length > 0) {
      frontMatter.speaker_notes = value;
    }
  }

  return { frontMatter, body: match[2], hasFrontMatter: true };
}

function splitSlides(markdown: string) {
  const lines = normalizeLineEndings(markdown).split("\n");
  const slides: string[] = [];
  let buffer: string[] = [];
  let inCodeFence = false;

  const pushSlide = () => {
    const slide = buffer.join("\n").trim();
    if (slide.length > 0) {
      slides.push(slide);
    }
    buffer = [];
  };

  for (const line of lines) {
    if (CODE_FENCE.test(line)) {
      inCodeFence = !inCodeFence;
      buffer.push(line);
      continue;
    }

    if (
      !inCodeFence &&
      (SLIDE_SEPARATOR.test(line) || END_SLIDE_SEPARATOR.test(line))
    ) {
      pushSlide();
      continue;
    }

    buffer.push(line);
  }

  pushSlide();
  return slides;
}

function patchExampleImagePaths(markdown: string) {
  return markdown
    .replaceAll("(image(1).png)", "(/examples/thesis/image(1).png)")
    .replaceAll("(comparison.png)", "(/examples/thesis/comparison.png)");
}

function extractSlideData(markdown: string): DeckSlide {
  const lines = normalizeLineEndings(markdown).split("\n");
  const contentLines: string[] = [];
  const notesLines: string[] = [];
  let inCodeFence = false;
  let inNotes = false;

  for (const line of lines) {
    if (CODE_FENCE.test(line)) {
      if (inNotes) {
        notesLines.push(line);
      } else {
        contentLines.push(line);
      }
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!inCodeFence && NOTES_START.test(line)) {
      inNotes = true;
      continue;
    }

    if (!inCodeFence && NOTES_END.test(line)) {
      inNotes = false;
      continue;
    }

    if (inNotes) {
      notesLines.push(line);
      continue;
    }

    contentLines.push(line);
  }

  const content = contentLines.join("\n").trim();
  const notes = notesLines.join("\n").trim();

  return {
    content: content.length > 0 ? content : "# No slide content",
    notes: notes.length > 0 ? notes : undefined,
  };
}

function buildFrontMatterSlide(frontMatter: FrontMatter) {
  const lines: string[] = [];

  if (frontMatter.title) {
    lines.push(`# ${frontMatter.title}`);
  }

  if (frontMatter.sub_title) {
    lines.push(`## ${frontMatter.sub_title}`);
  }

  if (frontMatter.author) {
    lines.push(`**Author:** ${frontMatter.author}`);
  }

  return lines.length > 0
    ? {
        content: lines.join("\n\n"),
        notes: frontMatter.speaker_notes?.trim() || undefined,
      }
    : null;
}

function stripNotesFromSlide(markdown: string) {
  const lines = normalizeLineEndings(markdown).split("\n");
  const contentLines: string[] = [];
  let inCodeFence = false;
  let inNotes = false;

  for (const line of lines) {
    if (CODE_FENCE.test(line)) {
      if (!inNotes) {
        contentLines.push(line);
      }
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!inCodeFence && NOTES_START.test(line)) {
      inNotes = true;
      continue;
    }

    if (!inCodeFence && NOTES_END.test(line)) {
      inNotes = false;
      continue;
    }

    if (!inNotes) {
      contentLines.push(line);
    }
  }

  return contentLines.join("\n").trim();
}

function withSlideNotes(markdown: string, notes: string) {
  const content = stripNotesFromSlide(markdown);
  const trimmedNotes = normalizeLineEndings(notes).trim();

  if (trimmedNotes.length === 0) {
    return content;
  }

  if (content.length === 0) {
    return [`<!-- notes -->`, trimmedNotes, `<!-- end_notes -->`].join("\n");
  }

  return [
    `<!-- notes -->`,
    trimmedNotes,
    `<!-- end_notes -->`,
    "",
    content,
  ].join("\n");
}

function serializeFrontMatter(frontMatter: FrontMatter) {
  const lines: string[] = [];

  if (frontMatter.title) {
    lines.push(`title: ${JSON.stringify(frontMatter.title)}`);
  }
  if (frontMatter.sub_title) {
    lines.push(`sub_title: ${JSON.stringify(frontMatter.sub_title)}`);
  }
  if (frontMatter.author) {
    lines.push(`author: ${JSON.stringify(frontMatter.author)}`);
  }
  if (frontMatter.speaker_notes?.trim()) {
    lines.push("speaker_notes: |");
    for (const line of normalizeLineEndings(frontMatter.speaker_notes).split("\n")) {
      lines.push(`  ${line}`);
    }
  }

  if (lines.length === 0) {
    return "";
  }

  return ["---", ...lines, "---"].join("\n");
}

function buildMarkdownDocument(parsed: ParsedFrontMatter, bodySlides: string[]) {
  const frontMatterBlock = parsed.hasFrontMatter
    ? serializeFrontMatter(parsed.frontMatter)
    : "";
  const body = bodySlides.join("\n\n<!-- end_slide -->\n\n").trim();

  if (frontMatterBlock.length === 0) {
    return body.length > 0 ? `${body}\n` : "";
  }

  if (body.length === 0) {
    return `${frontMatterBlock}\n`;
  }

  return `${frontMatterBlock}\n\n${body}\n`;
}

export async function saveSlideNotes(slideIndex: number, notes: string) {
  const markdown = await fs.readFile(EXAMPLE_PATH, "utf8");
  const parsed = parseFrontMatter(markdown);
  const generatedFrontMatterSlide = buildFrontMatterSlide(parsed.frontMatter);
  const hasGeneratedFrontMatterSlide = generatedFrontMatterSlide !== null;
  const trimmedNotes = normalizeLineEndings(notes).trim();

  if (hasGeneratedFrontMatterSlide && slideIndex === 0) {
    parsed.frontMatter.speaker_notes =
      trimmedNotes.length > 0 ? trimmedNotes : undefined;
    const bodySlides = splitSlides(parsed.body.trim());
    const nextMarkdown = buildMarkdownDocument(parsed, bodySlides);
    await fs.writeFile(EXAMPLE_PATH, nextMarkdown, "utf8");
    return trimmedNotes;
  }

  const slideOffset = hasGeneratedFrontMatterSlide ? 1 : 0;
  const bodySlideIndex = slideIndex - slideOffset;
  const bodySlides = splitSlides(parsed.body.trim());

  if (bodySlideIndex < 0 || bodySlideIndex >= bodySlides.length) {
    throw new Error("Invalid slide index");
  }

  bodySlides[bodySlideIndex] = withSlideNotes(bodySlides[bodySlideIndex] ?? "", notes);
  const nextMarkdown = buildMarkdownDocument(parsed, bodySlides);
  await fs.writeFile(EXAMPLE_PATH, nextMarkdown, "utf8");
  return trimmedNotes;
}

export async function loadDeck(): Promise<DeckData> {
  try {
    const markdown = await fs.readFile(EXAMPLE_PATH, "utf8");
    const patched = patchExampleImagePaths(markdown);
    const withRenderedLatex = await replaceLatexBlocksWithHtml(patched);
    const { frontMatter, body } = parseFrontMatter(withRenderedLatex);
    const generatedFrontMatterSlide = buildFrontMatterSlide(frontMatter);
    const bodySlides = splitSlides(body.trim()).map(extractSlideData);
    const slides = generatedFrontMatterSlide
      ? [generatedFrontMatterSlide, ...bodySlides]
      : bodySlides;

    return {
      deckTitle: frontMatter.title ?? DEFAULT_DECK_TITLE,
      deckSubtitle: frontMatter.sub_title,
      slides: slides.length > 0 ? slides : FALLBACK_SLIDES,
    };
  } catch (error) {
    console.error("Failed to load markdown slides:", error);
    return {
      deckTitle: DEFAULT_DECK_TITLE,
      deckSubtitle: undefined,
      slides: FALLBACK_SLIDES,
    };
  }
}
