export function getApiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { error?: { detail?: unknown } } | undefined)?.error?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
          return item.msg;
        }
        return '';
      })
      .filter(Boolean);

    if (messages.length) {
      return messages.join(' ');
    }
  }

  return fallback;
}
