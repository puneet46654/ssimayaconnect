/** Quoting alone does not stop spreadsheet software from interpreting attendee text as a formula. */
export function csvEscape(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && (/^\s*[=+@\-\uFF1D\uFF0B\uFF0D\uFF20]/u.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
