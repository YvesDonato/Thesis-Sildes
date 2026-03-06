const LATEX_RENDER_BLOCK = /```latex\s+\+render[^\n]*\n([\s\S]*?)\n```/g;

type ParsedRow = {
  cells: string[];
  topRule: boolean;
};

type ParsedTable = {
  rows: ParsedRow[];
  columnCount: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readBracedValue(source: string, openBraceIndex: number) {
  if (source[openBraceIndex] !== "{") {
    return null;
  }

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(openBraceIndex + 1, index),
          endIndex: index,
        };
      }
    }
  }

  return null;
}

function renderLatexInline(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  let output = "";

  for (let index = 0; index < normalized.length; ) {
    if (normalized.startsWith("\\textbf{", index)) {
      const parsed = readBracedValue(normalized, index + "\\textbf".length);
      if (parsed) {
        output += `<strong>${renderLatexInline(parsed.content)}</strong>`;
        index = parsed.endIndex + 1;
        continue;
      }
    }

    if (normalized.startsWith("\\centerline{", index)) {
      const parsed = readBracedValue(
        normalized,
        index + "\\centerline".length,
      );
      if (parsed) {
        output += renderLatexInline(parsed.content);
        index = parsed.endIndex + 1;
        continue;
      }
    }

    if (normalized.startsWith("\\par", index)) {
      index += "\\par".length;
      continue;
    }

    if (normalized.startsWith("\\bigskip", index)) {
      index += "\\bigskip".length;
      continue;
    }

    if (normalized.startsWith("\\centering", index)) {
      index += "\\centering".length;
      continue;
    }

    output += escapeHtml(normalized[index]);
    index += 1;
  }

  return output.trim();
}

function splitCells(rowContent: string) {
  const cells: string[] = [];
  let buffer = "";
  let depth = 0;

  for (let index = 0; index < rowContent.length; index += 1) {
    const char = rowContent[index];

    if (char === "{" && rowContent[index - 1] !== "\\") {
      depth += 1;
      buffer += char;
      continue;
    }

    if (char === "}" && rowContent[index - 1] !== "\\") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }

    if (char === "&" && depth === 0 && rowContent[index - 1] !== "\\") {
      cells.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }

  cells.push(buffer.trim());
  return cells;
}

function splitRows(body: string) {
  const rows: string[] = [];
  let buffer = "";

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "\\" && body[index + 1] === "\\") {
      rows.push(buffer.trim());
      buffer = "";
      index += 1;
      continue;
    }

    buffer += char;
  }

  if (buffer.trim().length > 0) {
    rows.push(buffer.trim());
  }

  return rows;
}

function parseColumnCount(spec: string) {
  let count = 0;

  for (let index = 0; index < spec.length; index += 1) {
    const char = spec[index];
    if ("lcr".includes(char)) {
      count += 1;
      continue;
    }

    if ("pmb".includes(char) && spec[index + 1] === "{") {
      const parsed = readBracedValue(spec, index + 1);
      if (parsed) {
        count += 1;
        index = parsed.endIndex;
      }
    }
  }

  return count;
}

function parseTabular(latexBody: string): ParsedTable | null {
  const marker = "\\begin{tabular}{";
  const markerIndex = latexBody.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const specStart = markerIndex + marker.length - 1;
  const specParsed = readBracedValue(latexBody, specStart);
  if (!specParsed) {
    return null;
  }

  const contentStart = specParsed.endIndex + 1;
  const endMarker = "\\end{tabular}";
  const endIndex = latexBody.indexOf(endMarker, contentStart);
  if (endIndex < 0) {
    return null;
  }

  const tabularBody = latexBody.slice(contentStart, endIndex);
  const rowFragments = splitRows(tabularBody);

  const rows: ParsedRow[] = [];
  let pendingTopRule = false;

  for (const fragment of rowFragments) {
    const hasHline = /\\hline/.test(fragment);
    const stripped = fragment.replace(/\\hline/g, " ").trim();

    if (stripped.length === 0) {
      if (hasHline) {
        pendingTopRule = true;
      }
      continue;
    }

    const parsedCells = splitCells(stripped).map((cell) => renderLatexInline(cell));
    rows.push({
      cells: parsedCells,
      topRule: pendingTopRule || hasHline,
    });

    pendingTopRule = false;
  }

  if (rows.length === 0) {
    return null;
  }

  const specColumns = parseColumnCount(specParsed.content);
  const maxRowColumns = rows.reduce(
    (max, row) => Math.max(max, row.cells.length),
    0,
  );

  return {
    rows,
    columnCount: Math.max(specColumns, maxRowColumns),
  };
}

function padRowCells(cells: string[], targetLength: number) {
  if (cells.length >= targetLength) {
    return cells;
  }

  return [...cells, ...new Array(targetLength - cells.length).fill("")];
}

function renderTableHtml(parsed: ParsedTable) {
  const [headerRow, ...bodyRows] = parsed.rows;
  const normalizedHeader = padRowCells(headerRow.cells, parsed.columnCount);

  const head = [
    "<thead>",
    `<tr class="${headerRow.topRule ? "border-t border-border" : ""}">`,
    ...normalizedHeader.map(
      (cell) =>
        `<th class="border border-border px-3 py-2 text-left font-semibold">${cell || "&nbsp;"}</th>`,
    ),
    "</tr>",
    "</thead>",
  ].join("");

  const body = [
    "<tbody>",
    ...bodyRows.map((row) => {
      const normalized = padRowCells(row.cells, parsed.columnCount);
      return [
        `<tr class="${row.topRule ? "border-t border-border" : ""}">`,
        ...normalized.map(
          (cell) =>
            `<td class="border border-border px-3 py-2 align-top">${cell || "&nbsp;"}</td>`,
        ),
        "</tr>",
      ].join("");
    }),
    "</tbody>",
  ].join("");

  return [
    "",
    '<figure class="my-5 w-full overflow-x-auto">',
    '<table class="min-w-full border-collapse text-left text-[0.95rem] sm:text-[1rem]">',
    head,
    body,
    "</table>",
    "</figure>",
    "",
  ].join("\n");
}

function renderLatexRenderBlock(latexBody: string) {
  const parsed = parseTabular(latexBody);
  if (!parsed) {
    return null;
  }

  return renderTableHtml(parsed);
}

export async function replaceLatexBlocksWithHtml(markdown: string) {
  const matches = Array.from(markdown.matchAll(LATEX_RENDER_BLOCK));
  if (matches.length === 0) {
    return markdown;
  }

  const output: string[] = [];
  let cursor = 0;

  for (const match of matches) {
    const fullMatch = match[0];
    const latexBody = match[1];
    const start = match.index ?? 0;
    const end = start + fullMatch.length;

    output.push(markdown.slice(cursor, start));
    cursor = end;

    const rendered = renderLatexRenderBlock(latexBody);
    if (rendered) {
      output.push(rendered);
    } else {
      console.warn(
        "Could not parse one `latex +render` block as a tabular table; leaving it as code.",
      );
      output.push(fullMatch);
    }
  }

  output.push(markdown.slice(cursor));
  return output.join("");
}
