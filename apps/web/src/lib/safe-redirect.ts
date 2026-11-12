// Browsers treat `\` like `/`, so `/\host` would also leave the origin.
export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return fallback;
  }

  return value;
}

export function withNext(path: string, nextPath: string, fallback = '/'): string {
  const safeNext = safeInternalPath(nextPath, fallback);

  if (safeNext === fallback) {
    return path;
  }

  return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(safeNext)}`;
}
