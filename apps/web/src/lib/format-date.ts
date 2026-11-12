// Fixed locale and time zone keep server and client output identical.
const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Colombo',
});

export function formatDate(value: string | Date): string {
  return DATE_FORMATTER.format(new Date(value));
}
