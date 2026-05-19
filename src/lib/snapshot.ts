// R2-backed MDX snapshot helpers for the content refresh system.
// Snapshots are stored under snapshots/{postId}/{isoTimestamp}.mdx

export async function saveSnapshot(
  r2: R2Bucket,
  postId: string,
  mdxContent: string,
): Promise<string> {
  const key = `snapshots/${postId}/${new Date().toISOString().replace(/[:.]/g, '-')}.mdx`;
  await r2.put(key, mdxContent, { httpMetadata: { contentType: 'text/plain' } });
  return key;
}

export async function listSnapshots(r2: R2Bucket, postId: string): Promise<string[]> {
  const prefix = `snapshots/${postId}/`;
  const result = await r2.list({ prefix });
  const keys = result.objects.map((o) => o.key);
  // Lexicographic descending gives most-recent-first for ISO timestamp keys
  keys.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys;
}

export async function loadSnapshot(r2: R2Bucket, key: string): Promise<string | null> {
  const obj = await r2.get(key);
  if (!obj) return null;
  return obj.text();
}

export async function pruneSnapshots(
  r2: R2Bucket,
  postId: string,
  keepCount = 5,
): Promise<void> {
  const keys = await listSnapshots(r2, postId);
  if (keys.length <= keepCount) return;
  const toDelete = keys.slice(keepCount);
  await Promise.all(toDelete.map((k) => r2.delete(k)));
}
