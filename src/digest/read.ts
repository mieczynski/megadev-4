import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && STATUSES.includes(value as RunStatus);
}

// The edge: one line of JSONL in, a typed RunLine out. Anything else is a bad line.
function parseLine(line: string): RunLine {
  const raw: unknown = JSON.parse(line);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('line is not an object');
  }
  const row = raw as Record<string, unknown>;
  if (typeof row['at'] !== 'string' || typeof row['job'] !== 'string') {
    throw new TypeError('line is missing `at` or `job`');
  }
  if (!isRunStatus(row['status'])) throw new TypeError('line has no known `status`');
  if (!(typeof row['owner'] === 'string' || row['owner'] === null)) {
    throw new TypeError('line has no `owner`');
  }
  const parsed: RunLine = {
    at: row['at'],
    job: row['job'],
    status: row['status'],
    owner: row['owner'],
  };
  if (row['error'] !== undefined) {
    if (typeof row['error'] !== 'string') throw new TypeError('`error` is not a string');
    parsed.error = row['error'];
  }
  return parsed;
}

/**
 * Read `runsDir/<night>.jsonl` into one row per job.
 *
 * A line that does not parse is counted in `badLines`, never thrown: the night still renders.
 * A missing file is not this function's business (see types.ts) — the error propagates and the
 * route answers 404. Times are carried verbatim, offset included; nothing here builds a `Date`.
 */
export const readNight: ReadNight = (runsDir: string, night: string): Night => {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');

  // Insertion order is file order, so the rows keep the night's first/last line per job.
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;

    let parsed: RunLine;
    try {
      parsed = parseLine(line);
    } catch {
      badLines += 1;
      continue;
    }

    const row = byJob.get(parsed.job);
    if (row === undefined) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }

    row.owner = parsed.owner;
    row.runs += 1;
    if (parsed.status === 'retry') row.retries += 1;
    row.lastStatus = parsed.status;
    // The most recent error the job saw, kept even once it succeeds: a line without an
    // `error` leaves the column alone.
    if (parsed.error !== undefined) row.lastError = parsed.error;
    row.lastAt = parsed.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};
