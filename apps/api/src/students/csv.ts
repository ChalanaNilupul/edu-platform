export const MAX_IMPORT_CSV_CHARS = 1_000_000;
export const MAX_IMPORT_ROWS = 2_000;

export class CsvParseError extends Error {}

export type CsvRecord = {
  line: number;
  fields: string[];
};

export type CsvTable = {
  headers: string[];
  records: CsvRecord[];
};

function isBlank(fields: string[]): boolean {
  return fields.every((field) => field.trim().length === 0);
}

/**
 * Minimal RFC 4180 reader: quoted fields, doubled quotes, CR/LF and CRLF
 * line endings, a leading UTF-8 BOM, and blank lines ignored.
 */
export function parseCsv(input: string): CsvTable {
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input;
  const records: CsvRecord[] = [];

  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);

    if (inQuotes) {
      if (char === '"') {
        if (text.charAt(index + 1) === '"') {
          field += '"';
          index += 2;
          continue;
        }

        inQuotes = false;
        index += 1;
        continue;
      }

      if (char === '\r') {
        if (text.charAt(index + 1) === '\n') {
          index += 1;
        }

        field += '\n';
        line += 1;
        index += 1;
        continue;
      }

      if (char === '\n') {
        line += 1;
      }

      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      if (field.trim().length > 0) {
        throw new CsvParseError(`Unexpected quote on line ${line}`);
      }

      field = '';
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ',') {
      fields.push(field);
      field = '';
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (char === '\r' && text.charAt(index + 1) === '\n') {
        index += 1;
      }

      fields.push(field);

      if (!isBlank(fields)) {
        records.push({ line: recordLine, fields });
      }

      fields = [];
      field = '';
      line += 1;
      recordLine = line;
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (inQuotes) {
    throw new CsvParseError(`Unclosed quoted field starting on line ${recordLine}`);
  }

  if (field.length > 0 || fields.length > 0) {
    fields.push(field);

    if (!isBlank(fields)) {
      records.push({ line: recordLine, fields });
    }
  }

  const [headerRecord, ...rows] = records;

  if (!headerRecord) {
    throw new CsvParseError('The CSV file is empty');
  }

  const headers = headerRecord.fields.map((header) => header.trim().toLowerCase());

  if (headers.some((header) => header.length === 0)) {
    throw new CsvParseError('The header row contains an empty column name');
  }

  const seen = new Set<string>();

  for (const header of headers) {
    if (seen.has(header)) {
      throw new CsvParseError(`The header row contains the column "${header}" twice`);
    }

    seen.add(header);
  }

  return { headers, records: rows };
}
