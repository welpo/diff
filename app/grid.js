import { getNormalizedReason, normalizeLine } from "./diff.js?h=52ba9aad";

export const DELIMITERS = ["\t", ",", ";"];

function emptyResult(delimiter) {
  return {
    valid: true,
    delimiter,
    rows: [],
    quoted: false,
    hasDelimiter: false,
  };
}

export function parseDelimited(text, delimiter) {
  if (!DELIMITERS.includes(delimiter))
    throw new Error("Unsupported delimiter");
  if (text === "") return emptyResult(delimiter);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let quoteClosed = false;
  let fieldStarted = false;
  let quoted = false;
  let hasDelimiter = false;
  let endedOnNewline = false;

  const invalid = (message) => ({
    valid: false,
    delimiter,
    rows: [],
    quoted,
    hasDelimiter,
    error: message,
  });
  const pushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
    quoteClosed = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    endedOnNewline = false;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else if (char === "\r") {
        if (text[i + 1] === "\n") i++;
        field += "\n";
      } else {
        field += char;
      }
      continue;
    }

    if (quoteClosed && char !== delimiter && char !== "\n" && char !== "\r")
      return invalid("Unexpected character after closing quote");

    if (char === '"') {
      if (fieldStarted || field !== "") {
        field += char;
      } else {
        inQuotes = true;
        fieldStarted = true;
        quoted = true;
      }
    } else if (char === delimiter) {
      hasDelimiter = true;
      pushField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      endedOnNewline = true;
    } else {
      fieldStarted = true;
      field += char;
    }
  }

  if (inQuotes) return invalid("Unclosed quoted field");
  if (!endedOnNewline || row.length > 0 || field !== "") pushRow();

  return { valid: true, delimiter, rows, quoted, hasDelimiter };
}

function isRectangular(rows) {
  if (rows.length === 0) return true;
  const width = rows[0].length;
  return rows.every((row) => row.length === width);
}

function candidatesFor(text) {
  if (text === "") return [];
  const candidates = [];
  for (const delimiter of DELIMITERS) {
    const parsed = parseDelimited(text, delimiter);
    if (
      parsed.valid &&
      parsed.hasDelimiter &&
      isRectangular(parsed.rows) &&
      parsed.rows[0]?.length > 1
    ) {
      candidates.push(parsed);
    }
  }
  return candidates;
}

function candidateScore(parsed) {
  if (parsed.delimiter === "\t") return 1000;
  const shapeScore = parsed.rows.length >= 2 ? 100 : 0;
  const quoteScore = parsed.quoted ? 50 : 0;
  const widthScore = parsed.rows[0]?.length || 0;
  return shapeScore + quoteScore + widthScore;
}

export function detectDelimitedPair(original, modified) {
  const originalCandidates = candidatesFor(original);
  const modifiedCandidates = candidatesFor(modified);
  if (originalCandidates.length === 0 && modifiedCandidates.length === 0)
    return { available: false };

  const originalDelimiters = new Set(
    originalCandidates.map((candidate) => candidate.delimiter),
  );
  const modifiedDelimiters = new Set(
    modifiedCandidates.map((candidate) => candidate.delimiter),
  );
  const delimiters =
    originalCandidates.length > 0 && modifiedCandidates.length > 0
      ? DELIMITERS.filter(
          (delimiter) =>
            originalDelimiters.has(delimiter) &&
            modifiedDelimiters.has(delimiter),
        )
      : DELIMITERS.filter(
          (delimiter) =>
            originalDelimiters.has(delimiter) ||
            modifiedDelimiters.has(delimiter),
        );
  if (delimiters.length === 0) return { available: false };

  const ranked = delimiters
    .map((delimiter) => {
      const a = parseDelimited(original, delimiter);
      const b = parseDelimited(modified, delimiter);
      if (
        !a.valid ||
        !b.valid ||
        !isRectangular(a.rows) ||
        !isRectangular(b.rows)
      )
        return null;
      return {
        delimiter,
        a,
        b,
        score:
          candidateScore(a.hasDelimiter ? a : b) +
          candidateScore(b.hasDelimiter ? b : a),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return { available: false };

  const best = ranked[0];
  const highConfidence =
    best.delimiter === "\t" ||
    (best.a.hasDelimiter && best.a.quoted) ||
    (best.b.hasDelimiter && best.b.quoted) ||
    (best.a.hasDelimiter && best.a.rows.length >= 2) ||
    (best.b.hasDelimiter && best.b.rows.length >= 2);
  return {
    available: true,
    delimiter: best.delimiter,
    label:
      best.delimiter === "\t"
        ? "TSV"
        : best.delimiter === ","
          ? "CSV"
          : "semicolon CSV",
    confidence: highConfidence ? "high" : "low",
    defaultMode: highConfidence ? "grid" : "text",
    original: best.a.rows,
    modified: best.b.rows,
  };
}

export function colLabel(index) {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function gridDiff(original, modified, options = {}, detection = null) {
  const detected = detection || detectDelimitedPair(original, modified);
  if (!detected.available) throw new Error("Input is not a tabular data pair");

  const left = detected.original;
  const right = detected.modified;
  const rows = Math.max(left.length, right.length);
  const cols = Math.max(
    left[0]?.length || 0,
    right[0]?.length || 0,
  );
  const cells = [];
  const changes = [];
  const stats = {
    same: 0,
    filled: 0,
    cleared: 0,
    changed: 0,
    normalized: 0,
  };

  for (let row = 0; row < rows; row++) {
    const resultRow = [];
    for (let col = 0; col < cols; col++) {
      const hasA = row < left.length && col < left[row].length;
      const hasB = row < right.length && col < right[row].length;
      const a = hasA ? left[row][col] : "";
      const b = hasB ? right[row][col] : "";
      const normalizedA = normalizeLine(a, options);
      const normalizedB = normalizeLine(b, options);
      const bothAbsent = !hasA && !hasB;
      const bothEmpty =
        hasA && hasB && normalizedA === "" && normalizedB === "";
      const normalized = a !== b && normalizedA === normalizedB;
      let type = "same";
      if (!hasA && hasB) type = "filled";
      else if (hasA && !hasB) type = "cleared";
      else if (normalizedA !== normalizedB) {
        if (normalizedA === "") type = "filled";
        else if (normalizedB === "") type = "cleared";
        else type = "changed";
      }
      const cell = {
        row,
        col,
        ref: `${colLabel(col)}${row + 1}`,
        type,
        a,
        b,
        normalized,
        normReason: normalized
          ? getNormalizedReason(a, b, options)
          : null,
      };
      resultRow.push(cell);
      if (!bothAbsent && !bothEmpty) stats[type]++;
      if (normalized) stats.normalized++;
      if (type !== "same") changes.push(cell);
    }
    cells.push(resultRow);
  }

  return {
    mode: "grid",
    delimiter: detected.delimiter,
    formatLabel: detected.label,
    originalRows: left.length,
    originalCols: left[0]?.length || 0,
    modifiedRows: right.length,
    modifiedCols: right[0]?.length || 0,
    rows,
    cols,
    cells,
    changes,
    stats,
  };
}
