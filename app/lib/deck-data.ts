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
const CODE_FENCE = /^\s*```/;
const DEFAULT_DECK_TITLE = "Markdown Slide Maker";

type FrontMatter = {
  title?: string;
  sub_title?: string;
  author?: string;
};

export type DeckData = {
  deckTitle: string;
  slides: string[];
};

const FALLBACK_SLIDES = [
  [
    "# Markdown Slide Maker",
    "",
    "No slide source was found at `content/examples/01-thesis-defense.md`.",
    "",
    "Add markdown slides separated by `---` or `<!-- end_slide -->`.",
  ].join("\n"),
];

function normalizeLineEndings(markdown: string) {
  return markdown.replace(/\r\n?/g, "\n");
}

function parseFrontMatter(markdown: string) {
  const normalized = normalizeLineEndings(markdown);
  const match = normalized.match(FRONT_MATTER);

  if (!match) {
    return { frontMatter: {} as FrontMatter, body: normalized };
  }

  const rawFrontMatter = match[1].split("\n");
  const frontMatter: FrontMatter = {};

  for (const line of rawFrontMatter) {
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
    }
  }

  return { frontMatter, body: match[2] };
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

  return lines.length > 0 ? lines.join("\n\n") : null;
}

export async function loadDeck(): Promise<DeckData> {
  try {
    const markdown = await fs.readFile(EXAMPLE_PATH, "utf8");
    const patched = patchExampleImagePaths(markdown);
    const withRenderedLatex = await replaceLatexBlocksWithHtml(patched);
    const { frontMatter, body } = parseFrontMatter(withRenderedLatex);
    const generatedFrontMatterSlide = buildFrontMatterSlide(frontMatter);
    const bodySlides = splitSlides(body.trim());
    const slides = generatedFrontMatterSlide
      ? [generatedFrontMatterSlide, ...bodySlides]
      : bodySlides;

    return {
      deckTitle: frontMatter.title ?? DEFAULT_DECK_TITLE,
      slides: slides.length > 0 ? slides : FALLBACK_SLIDES,
    };
  } catch (error) {
    console.error("Failed to load markdown slides:", error);
    return {
      deckTitle: DEFAULT_DECK_TITLE,
      slides: FALLBACK_SLIDES,
    };
  }
}
