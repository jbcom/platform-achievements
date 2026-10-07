/** A CSV field: quoted when it holds a comma, a quote or a line break. */
export const csvField = (value: string | number): string => {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** One CSV row, without a line break. */
export const csvRow = (values: readonly (string | number)[]): string =>
  values.map(csvField).join(',')

/** Rows as a file body: one per line, ending with a line break. */
export const csvLines = (rows: readonly string[]): string => `${rows.join('\n')}\n`
