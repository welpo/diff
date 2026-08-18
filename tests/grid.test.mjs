import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  colLabel,
  detectDelimitedPair,
  gridDiff,
  parseDelimited,
} from '../app/grid.js';

describe('Delimited parsing', () => {
  it('parses quoted CSV fields, escaped quotes, and multiline values', () => {
    const csv =
      'name,notes\r\n"Ada","line 1\r\nline 2"\r\n"Bob","said ""hi"""';
    const parsed = parseDelimited(csv, ',');

    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.quoted, true);
    assert.deepStrictEqual(parsed.rows, [
      ['name', 'notes'],
      ['Ada', 'line 1\nline 2'],
      ['Bob', 'said "hi"'],
    ]);
  });

  it('preserves empty cells and omits only the final record newline', () => {
    const parsed = parseDelimited('a\t\tc\n1\t2\t\n', '\t');

    assert.deepStrictEqual(parsed.rows, [
      ['a', '', 'c'],
      ['1', '2', ''],
    ]);
  });

  it('rejects malformed quoting', () => {
    assert.strictEqual(parseDelimited('"open,value', ',').valid, false);
    assert.strictEqual(parseDelimited('"value"x,next', ',').valid, false);
  });

  it('allows literal quotes inside unquoted spreadsheet cells', () => {
    const parsed = parseDelimited('name\tnote\nAda\tShe said "hi"', '\t');

    assert.strictEqual(parsed.valid, true);
    assert.deepStrictEqual(parsed.rows[1], ['Ada', 'She said "hi"']);
  });
});

describe('Delimited detection', () => {
  it('auto-selects rectangular TSV, including a single row', () => {
    const detected = detectDelimitedPair('a\tb', 'a\tc');

    assert.strictEqual(detected.available, true);
    assert.strictEqual(detected.delimiter, '\t');
    assert.strictEqual(detected.defaultMode, 'grid');
    assert.strictEqual(detected.label, 'TSV');
  });

  it('recognizes multi-row comma and semicolon CSV with high confidence', () => {
    const comma = detectDelimitedPair('a,b\n1,2', 'a,b\n1,3');
    const semicolon = detectDelimitedPair('a;b\n1;2', 'a;b\n1;3');

    assert.strictEqual(comma.delimiter, ',');
    assert.strictEqual(comma.defaultMode, 'grid');
    assert.strictEqual(semicolon.delimiter, ';');
    assert.strictEqual(semicolon.defaultMode, 'grid');
    assert.strictEqual(semicolon.label, 'semicolon CSV');
  });

  it('offers ambiguous single-row CSV but defaults it to text', () => {
    const detected = detectDelimitedPair('hello,world', 'hello,there');

    assert.strictEqual(detected.available, true);
    assert.strictEqual(detected.confidence, 'low');
    assert.strictEqual(detected.defaultMode, 'text');
  });

  it('treats quoted single-row CSV as high confidence', () => {
    const detected = detectDelimitedPair('"hello","world"', '"hello","there"');

    assert.strictEqual(detected.available, true);
    assert.strictEqual(detected.defaultMode, 'grid');
  });

  it('rejects plain text, ragged data, and mismatched delimiters', () => {
    assert.strictEqual(
      detectDelimitedPair('hello\nworld', 'hello\nthere').available,
      false,
    );
    assert.strictEqual(
      detectDelimitedPair('a,b\nc', 'a,b\nd').available,
      false,
    );
    assert.strictEqual(
      detectDelimitedPair('a,b\n1,2', 'a;b\n1;2').available,
      false,
    );
  });

  it('lets an empty side inherit the detected delimiter', () => {
    const detected = detectDelimitedPair('', 'a;b\n1;2');

    assert.strictEqual(detected.available, true);
    assert.strictEqual(detected.delimiter, ';');
    assert.deepStrictEqual(detected.original, []);
  });
});

describe('Grid diffing', () => {
  it('classifies changed, filled, and cleared cells by coordinate', () => {
    const original = 'name\tage\nAda\t36\nBob\t\nEve\t30';
    const modified = 'name\tage\nAda\t37\nBob\t42\nEve\t';
    const result = gridDiff(original, modified);

    assert.deepStrictEqual(
      result.changes.map(({ ref, type }) => ({ ref, type })),
      [
        { ref: 'B2', type: 'changed' },
        { ref: 'B3', type: 'filled' },
        { ref: 'B4', type: 'cleared' },
      ],
    );
    assert.deepStrictEqual(result.stats, {
      same: 5,
      filled: 1,
      cleared: 1,
      changed: 1,
      normalized: 0,
    });
  });

  it('applies text normalization per cell', () => {
    const result = gridDiff('key\tvalue  ', 'key\tvalue', {
      trailing: true,
    });

    assert.strictEqual(result.changes.length, 0);
    assert.strictEqual(result.stats.normalized, 1);
    assert.strictEqual(result.cells[0][1].normalized, true);
    assert.deepStrictEqual(result.cells[0][1].normReason, ['whitespace']);
  });

  it('detects added empty columns and rows', () => {
    const column = gridDiff('a\tb', 'a\tb\t');
    const row = gridDiff('a\tb\n1\t2', 'a\tb\n1\t2\n\t');

    assert.deepStrictEqual(
      column.changes.map(({ ref, type }) => ({ ref, type })),
      [{ ref: 'C1', type: 'filled' }],
    );
    assert.deepStrictEqual(
      row.changes.map(({ ref, type }) => ({ ref, type })),
      [
        { ref: 'A3', type: 'filled' },
        { ref: 'B3', type: 'filled' },
      ],
    );
  });

  it('creates spreadsheet column labels', () => {
    assert.strictEqual(colLabel(0), 'A');
    assert.strictEqual(colLabel(25), 'Z');
    assert.strictEqual(colLabel(26), 'AA');
    assert.strictEqual(colLabel(701), 'ZZ');
  });
});
