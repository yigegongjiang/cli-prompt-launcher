export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

export function previewValue(value: unknown, maxLength: number): string {
  if (typeof value === "string") return truncate(value, maxLength);
  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return truncate(String(value), maxLength);
  }
}
