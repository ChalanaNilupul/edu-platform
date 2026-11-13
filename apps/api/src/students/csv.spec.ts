import { describe, expect, it } from 'vitest';

import { CsvParseError, parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('parses headers and rows with trimmed, lower-cased header names', () => {
    const table = parseCsv('First_Name,Last_Name\nNimal,Perera\nKamal,Silva\n');

    expect(table.headers).toEqual(['first_name', 'last_name']);
    expect(table.records).toEqual([
      { line: 2, fields: ['Nimal', 'Perera'] },
      { line: 3, fields: ['Kamal', 'Silva'] },
    ]);
  });

  it('keeps blank optional cells as empty strings', () => {
    const table = parseCsv('first_name,email\nNimal,\n');

    expect(table.records[0]?.fields).toEqual(['Nimal', '']);
  });

  it('handles quoted commas, doubled quotes, embedded newlines, CRLF and a BOM', () => {
    const table = parseCsv(
      '\uFEFFfirst_name,address_line1\r\n"Nimal, Jr.","""Lake"" Road\r\nColombo 3"\r\n',
    );

    expect(table.headers).toEqual(['first_name', 'address_line1']);
    expect(table.records).toEqual([{ line: 2, fields: ['Nimal, Jr.', '"Lake" Road\nColombo 3'] }]);
  });

  it('tracks line numbers across quoted newlines and skips blank lines', () => {
    const table = parseCsv('first_name,notes\n"Nimal","line one\nline two"\n\nKamal,\n');

    expect(table.records).toEqual([
      { line: 2, fields: ['Nimal', 'line one\nline two'] },
      { line: 5, fields: ['Kamal', ''] },
    ]);
  });

  it('parses a last row without a trailing newline', () => {
    const table = parseCsv('first_name\nNimal');

    expect(table.records).toEqual([{ line: 2, fields: ['Nimal'] }]);
  });

  it('rejects an empty file', () => {
    expect(() => parseCsv('')).toThrow(CsvParseError);
    expect(() => parseCsv('\n\n')).toThrow('The CSV file is empty');
  });

  it('rejects an unclosed quoted field with the line it started on', () => {
    expect(() => parseCsv('first_name\n"Nimal\n')).toThrow(
      'Unclosed quoted field starting on line 2',
    );
  });

  it('rejects a quote in the middle of an unquoted field', () => {
    expect(() => parseCsv('first_name\nNi"mal\n')).toThrow('Unexpected quote on line 2');
  });

  it('rejects empty and duplicate header names', () => {
    expect(() => parseCsv('first_name,\nNimal,\n')).toThrow(
      'The header row contains an empty column name',
    );
    expect(() => parseCsv('first_name,first_name\nNimal,Nimal\n')).toThrow(
      'The header row contains the column "first_name" twice',
    );
  });
});
