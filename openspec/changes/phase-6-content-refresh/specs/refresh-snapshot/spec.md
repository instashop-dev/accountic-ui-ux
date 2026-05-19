## ADDED Requirements

### Requirement: Snapshot library writes MDX to R2 before refresh
`src/lib/snapshot.ts` SHALL export a `saveSnapshot(r2: R2Bucket, postId: string, mdxContent: string): Promise<string>` function that writes `mdxContent` to R2 under the key `snapshots/{postId}/{iso_timestamp}.mdx` and returns the key.

#### Scenario: Snapshot is saved before overwrite
- **WHEN** the refresh worker calls `saveSnapshot` with the current MDX body before regeneration
- **THEN** the content is stored in R2 under `snapshots/{post_id}/{timestamp}.mdx` and the key is returned

### Requirement: Snapshot library lists snapshots for a post
`src/lib/snapshot.ts` SHALL export a `listSnapshots(r2: R2Bucket, postId: string): Promise<string[]>` function that returns all R2 keys under `snapshots/{postId}/` sorted by timestamp descending (most recent first).

#### Scenario: Post has multiple snapshots
- **WHEN** `listSnapshots` is called with a post_id that has 3 snapshots
- **THEN** the function returns 3 keys in descending timestamp order

#### Scenario: Post has no snapshots
- **WHEN** `listSnapshots` is called with a post_id that has no snapshots
- **THEN** the function returns an empty array

### Requirement: Snapshot library restores MDX from R2
`src/lib/snapshot.ts` SHALL export a `loadSnapshot(r2: R2Bucket, key: string): Promise<string | null>` function that reads and returns the MDX content of the given R2 key, or `null` if the key does not exist.

#### Scenario: Snapshot key exists
- **WHEN** `loadSnapshot` is called with a valid R2 key
- **THEN** the function returns the stored MDX string

#### Scenario: Snapshot key does not exist
- **WHEN** `loadSnapshot` is called with a key that has no corresponding R2 object
- **THEN** the function returns `null`

### Requirement: Snapshot library prunes old snapshots
`src/lib/snapshot.ts` SHALL export a `pruneSnapshots(r2: R2Bucket, postId: string, keepCount?: number): Promise<void>` function. After a successful refresh, the refresh worker SHALL call this with `keepCount = 5` to retain only the 5 most recent snapshots and delete the rest.

#### Scenario: More than keepCount snapshots exist
- **WHEN** 7 snapshots exist for a post and `pruneSnapshots` is called with `keepCount = 5`
- **THEN** the 2 oldest snapshots are deleted from R2
