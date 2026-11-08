import type { Night } from '../digest/types.js';

// One row per job, in the reader's order (already sorted by job — never re-sorted here).
// Retries of 3 or more and any `fail` get `.warn` (the layout's only emphasis class).
// Missing data (`owner`, `lastError`) renders as `—`, never blank, never dropped.
export function Digest({ night }: { night: Night }) {
  if (night.rows.length === 0) {
    return (
      <>
        <h1>digest</h1>
        <p class="mute">nothing ran</p>
        {night.badLines > 0 && (
          <p class="mute">{night.badLines} line(s) did not parse and were skipped.</p>
        )}
      </>
    );
  }

  return (
    <>
      <h1>digest</h1>
      <table>
        <thead>
          <tr>
            <th>job</th>
            <th>owner</th>
            <th>runs</th>
            <th>retries</th>
            <th>last status</th>
            <th>last error</th>
            <th>first</th>
            <th>last</th>
          </tr>
        </thead>
        <tbody>
          {night.rows.map((row) => {
            const warnRetries = row.retries >= 3;
            const warnStatus = row.lastStatus === 'fail';
            return (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td class={warnRetries ? 'warn' : undefined}>{row.retries}</td>
                <td class={warnStatus ? 'warn' : undefined}>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {night.badLines > 0 && (
        <p class="mute">{night.badLines} line(s) did not parse and were skipped.</p>
      )}
    </>
  );
}
