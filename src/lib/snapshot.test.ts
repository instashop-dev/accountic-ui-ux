import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveSnapshot, listSnapshots, loadSnapshot, pruneSnapshots } from './snapshot';

// ── R2 stub ───────────────────────────────────────────────────────────────────

type StoredObject = { key: string; value: string };

function makeR2(initial: StoredObject[] = []): R2Bucket {
  const store = new Map(initial.map((o) => [o.key, o.value]));
  return {
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    get: vi.fn(async (key: string) => {
      const v = store.get(key);
      if (v === undefined) return null;
      return { text: async () => v };
    }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => {
      const objects = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({ key: k }));
      return { objects };
    }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
  } as unknown as R2Bucket;
}

const POST_ID = 'post-abc-123';

describe('saveSnapshot', () => {
  it('writes content to R2 under snapshots/{postId}/{timestamp}.mdx', async () => {
    const r2 = makeR2();
    const key = await saveSnapshot(r2, POST_ID, '# Hello');
    expect(key).toMatch(new RegExp(`^snapshots/${POST_ID}/`));
    expect(key).toMatch(/\.mdx$/);
    expect((r2.put as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('# Hello');
  });

  it('returns the R2 key', async () => {
    const r2 = makeR2();
    const key = await saveSnapshot(r2, POST_ID, 'content');
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });
});

describe('listSnapshots', () => {
  it('returns keys in descending order (most recent first)', async () => {
    const r2 = makeR2([
      { key: `snapshots/${POST_ID}/2026-01-01T00-00-00-000Z.mdx`, value: 'a' },
      { key: `snapshots/${POST_ID}/2026-03-01T00-00-00-000Z.mdx`, value: 'c' },
      { key: `snapshots/${POST_ID}/2026-02-01T00-00-00-000Z.mdx`, value: 'b' },
    ]);
    const keys = await listSnapshots(r2, POST_ID);
    expect(keys[0]).toContain('2026-03-01');
    expect(keys[1]).toContain('2026-02-01');
    expect(keys[2]).toContain('2026-01-01');
  });

  it('returns empty array when post has no snapshots', async () => {
    const r2 = makeR2();
    const keys = await listSnapshots(r2, POST_ID);
    expect(keys).toEqual([]);
  });
});

describe('loadSnapshot', () => {
  it('returns MDX content when key exists', async () => {
    const key = `snapshots/${POST_ID}/2026-05-01T00-00-00-000Z.mdx`;
    const r2 = makeR2([{ key, value: '# Article' }]);
    const content = await loadSnapshot(r2, key);
    expect(content).toBe('# Article');
  });

  it('returns null when key does not exist', async () => {
    const r2 = makeR2();
    const content = await loadSnapshot(r2, 'snapshots/missing/key.mdx');
    expect(content).toBeNull();
  });
});

describe('pruneSnapshots', () => {
  it('deletes oldest snapshots when count exceeds keepCount', async () => {
    const keys = [
      `snapshots/${POST_ID}/2026-07-01T00-00-00-000Z.mdx`,
      `snapshots/${POST_ID}/2026-06-01T00-00-00-000Z.mdx`,
      `snapshots/${POST_ID}/2026-05-01T00-00-00-000Z.mdx`,
      `snapshots/${POST_ID}/2026-04-01T00-00-00-000Z.mdx`,
      `snapshots/${POST_ID}/2026-03-01T00-00-00-000Z.mdx`,
      `snapshots/${POST_ID}/2026-02-01T00-00-00-000Z.mdx`,
      `snapshots/${POST_ID}/2026-01-01T00-00-00-000Z.mdx`,
    ];
    const r2 = makeR2(keys.map((k) => ({ key: k, value: 'x' })));
    await pruneSnapshots(r2, POST_ID, 5);
    const deleteMock = r2.delete as ReturnType<typeof vi.fn>;
    expect(deleteMock).toHaveBeenCalledTimes(2);
    const deleted = deleteMock.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(deleted).toContain(`snapshots/${POST_ID}/2026-02-01T00-00-00-000Z.mdx`);
    expect(deleted).toContain(`snapshots/${POST_ID}/2026-01-01T00-00-00-000Z.mdx`);
  });

  it('does not delete anything when count is at or below keepCount', async () => {
    const r2 = makeR2([
      { key: `snapshots/${POST_ID}/2026-05-01T00-00-00-000Z.mdx`, value: 'x' },
      { key: `snapshots/${POST_ID}/2026-04-01T00-00-00-000Z.mdx`, value: 'x' },
    ]);
    await pruneSnapshots(r2, POST_ID, 5);
    expect((r2.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
