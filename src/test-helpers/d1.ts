/**
 * Lightweight D1Database adapter backed by node:sqlite (Node 22+).
 * Used only in Vitest unit/integration tests — never imported by production code.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function normaliseSql(sql: string): string {
  // SQLite does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS;
  // strip that guard so migrations apply cleanly in tests.
  return sql
    .replace(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS/gi, 'ALTER TABLE $1 ADD COLUMN')
    .trim();
}

export function createTestDb(migrationFiles?: string[]): D1Database {
  const raw = new DatabaseSync(':memory:');

  const defaultMigrations = [
    'migrations/001_init.sql',
    'migrations/002_pipeline.sql',
    'migrations/003_phase3_hardening.sql',
    'migrations/004_humanizer.sql',
  ];

  for (const file of migrationFiles ?? defaultMigrations) {
    const sql = normaliseSql(readFileSync(resolve(file), 'utf-8'));
    // Split on statement boundaries, run each non-empty statement
    for (const stmt of splitStatements(sql)) {
      try {
        raw.exec(stmt);
      } catch {
        // Some ALTER TABLE statements fail silently when column already exists
      }
    }
  }

  return wrapD1(raw);
}

export function applyFixtures(db: D1Database, fixturePath = 'migrations/005_test-fixtures.sql'): void {
  const d1 = db as D1Wrapper;
  const sql = normaliseSql(readFileSync(resolve(fixturePath), 'utf-8'));
  for (const stmt of splitStatements(sql)) {
    try {
      d1._raw.exec(stmt);
    } catch {
      // ignore duplicate fixtures
    }
  }
}

function splitStatements(sql: string): string[] {
  // Strip -- comments but preserve content inside single-quoted SQL strings.
  // The alternation captures string literals first; unmatched -- sequences are comments.
  const stripped = sql.replace(/('(?:''|[^'])*')|--[^\n]*/g, (_, str: string | undefined) => str ?? '');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

interface D1Wrapper extends D1Database {
  _raw: DatabaseSync;
}

function wrapD1(raw: DatabaseSync): D1Database {
  const wrapper: D1Wrapper = {
    _raw: raw,

    prepare(sql: string) {
      let boundParams: unknown[] = [];

      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params;
          return stmt;
        },
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          try {
            const prepared = raw.prepare(sql);
            const row = prepared.get(...boundParams) as T | undefined;
            return row ?? null;
          } catch {
            return null;
          }
        },
        async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
          try {
            const prepared = raw.prepare(sql);
            const rows = prepared.all(...boundParams) as T[];
            return { results: rows };
          } catch {
            return { results: [] };
          }
        },
        async run(): Promise<{ success: boolean; meta: object }> {
          try {
            const prepared = raw.prepare(sql);
            prepared.run(...boundParams);
            return { success: true, meta: {} };
          } catch (e) {
            throw e;
          }
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },

    async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
      const results: D1Result[] = [];
      for (const stmt of statements) {
        const result = await (stmt as unknown as { run(): Promise<D1Result> }).run();
        results.push(result);
      }
      return results;
    },

    async exec(query: string): Promise<D1ExecResult> {
      raw.exec(query);
      return { count: 0, duration: 0 };
    },

    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
  };

  return wrapper;
}
