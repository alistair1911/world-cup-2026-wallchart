export function usablePlayerStatName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (/^unknown$/i.test(trimmed) || /^player$/i.test(trimmed) || /^player\s+\d+$/i.test(trimmed)) {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function providerIdKeys(value: string) {
  const keys = new Set<string>();
  const segments = value
    .split(/[/:|\\-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of [value, segments.at(-1) ?? ""]) {
    const normalized = candidate
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (/^\d+$/.test(normalized)) {
      keys.add(normalized);
    }
  }

  return keys;
}

export function isPlaceholderPlayerStatName(value: string | null | undefined) {
  return usablePlayerStatName(value) === null;
}
