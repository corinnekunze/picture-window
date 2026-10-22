// Reading the "Approve batch" issue the review page opens.

/** "Approve batch 2026-11" -> "2026-11"; anything else -> null. */
export function parseApprovedBatch(issueTitle: string): string | null {
  return issueTitle.match(/^Approve batch (\d{4}-\d{2})\b/)?.[1] ?? null;
}

/** Photo IDs listed anywhere in the text, e.g. "reject:\nwmc-123\nwmc-456". */
export function parsePhotoIds(text: string): string[] {
  return [...new Set(text.match(/wmc-\d+/g) ?? [])];
}
