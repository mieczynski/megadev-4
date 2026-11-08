// The digest contract: what one night's run log becomes once it is read.
//
// This file is types only. The reader that produces these values lands in `src/digest/`
// under its own issue; the page, the JSON route, the board link and the route tests
// import from here and do not wait for it.

/** A job's outcome on one line of the log. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/**
 * One parsed line of `runs/<night>.jsonl`.
 *
 * `at` is the timestamp exactly as the log wrote it, offset included
 * (`2026-10-29T01:30:00+01:00`). Never converted to UTC — see docs/styleguide.md.
 * `owner` may be `null`: the line is kept, and the owner shows as `—`.
 * `error` is present only on lines that carry one.
 */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/**
 * One row of the digest: every line for a single job, folded together.
 *
 * - `owner`: the job's owner, or `null` when the log had none. Render as `—`, never blank,
 *   and never drop the row.
 * - `runs`: how many lines the night held for this job, bad lines excluded.
 * - `retries`: how many of those lines had status `'retry'`. The page marks 3 or more.
 * - `lastStatus`: the status of the job's last line of the night.
 * - `lastError`: the most recent `error` seen for the job, or `null` if it never errored.
 *   A job that retried and then succeeded still carries the error that made it retry —
 *   that is the point of the column.
 * - `firstAt` / `lastAt`: the `at` of the job's first and last line, verbatim with their
 *   offset. Strings, not `Date`: nothing here converts to UTC.
 */
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

/**
 * What one night reads as.
 *
 * - `rows`: one row per job. Order is the reader's to set (the plan asks the page for job
 *   order); the page and the JSON route serve the same array, so they cannot disagree.
 * - `badLines`: lines that did not parse. Counted, never thrown — the night still renders.
 *
 * The agreed reader signature, implemented in the reader issue:
 *
 *     readNight(runsDir: string, night: string): Night
 *
 * `night` is the date part of the file name, `YYYY-MM-DD`.
 *
 * `Night` has no "missing" state: an empty file is a real night, `{ rows: [], badLines: 0 }`,
 * and renders as "nothing ran". A night with no file at all is decided before the reader —
 * the route checks the nights on disk and answers 404.
 */
export type Night = {
  rows: DigestRow[];
  badLines: number;
};

/** The reader's signature as a type, so callers and tests can state what they expect. */
export type ReadNight = (runsDir: string, night: string) => Night;
