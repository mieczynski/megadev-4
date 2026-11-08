import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// `runs/` is read-only (AGENTS.md): the committed night is only ever read, every other
// fixture is built in a temp dir.
let dir = '';

function night(name: string, lines: string): string {
  writeFileSync(join(dir, `${name}.jsonl`), lines);
  return name;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readNight on the committed night', () => {
  const result = readNight('runs', '2026-10-28');

  it('folds the night into 5 jobs and counts the 1 bad line', () => {
    expect(result.rows).toHaveLength(5);
    expect(result.badLines).toBe(1);
  });

  it('gives one row per job, in job order, with times verbatim', () => {
    expect(result.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'upstream 503',
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });

  it('keeps the error of a job that retried and then succeeded', () => {
    const refresh = result.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh?.lastStatus).toBe('ok');
    expect(refresh?.lastError).toBe('upstream 503');
  });
});

describe('readNight on built fixtures', () => {
  it('counts a line that does not parse and never throws', () => {
    const name = night(
      '2026-11-01',
      [
        '{"at":"2026-11-01T23:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
        '{"at":"2026-11-01T23:30:00+01:00","job":"lane/sy',
        'not json at all',
        '{"at":"2026-11-02T00:00:00+01:00","job":"lane/sync","status":"fail","owner":"rook","error":"boom"}',
        '',
      ].join('\n'),
    );

    const result = readNight(dir, name);

    expect(result.badLines).toBe(2);
    expect(result.rows).toEqual([
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 2,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-11-01T23:00:00+01:00',
        lastAt: '2026-11-02T00:00:00+01:00',
      },
    ]);
  });

  it('keeps a row whose owner is null', () => {
    const name = night(
      '2026-11-02',
      '{"at":"2026-11-02T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}\n',
    );

    const result = readNight(dir, name);

    expect(result.badLines).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.job).toBe('digest/render');
    expect(result.rows[0]?.owner).toBeNull();
  });

  it('reads an empty night as a real night with no rows', () => {
    const name = night('2026-11-03', '');
    expect(readNight(dir, name)).toEqual({ rows: [], badLines: 0 });
    const blank = night('2026-11-04', '\n\n');
    expect(readNight(dir, blank)).toEqual({ rows: [], badLines: 0 });
  });
});
