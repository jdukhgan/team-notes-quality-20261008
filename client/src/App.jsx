import { useState } from 'react';
import { useTheme } from './components/ThemeToggle.jsx';
import { FixturePanel } from './dev/FixturePanel.jsx';
import { createFixtureClient, SCENARIOS } from './notes/fixtureClient.js';
import { NotesScreen } from './notes/NotesScreen.jsx';

/**
 * Reference screen wired to the fixture adapter.
 *
 * URL parameters (fixture mode only):
 *   ?scenario=populated|empty|loading|list-error|save-error|archive-error|missing-note
 *   ?latency=<ms>     simulated request time (default 450)
 *   ?devtools=1       show the fixture control panel
 *   ?theme=light|dark force a theme (handled in index.html)
 *
 * Integration: pass the Builder's HTTP adapter as `api` instead (see
 * docs/ui-contract.md); NotesScreen does not change.
 */
export function App({ api: providedApi }) {
  const { theme, toggle } = useTheme();
  const [setup] = useState(() => {
    if (providedApi) return { api: providedApi, scenario: null };
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('scenario');
    const scenario = requested in SCENARIOS ? requested : 'populated';
    const latency = Number(params.get('latency'));
    const api = createFixtureClient({ scenario, ...(Number.isFinite(latency) && params.has('latency') ? { latency } : {}) });
    return { api, scenario, devtools: params.get('devtools') === '1' };
  });

  return (
    <>
      <NotesScreen api={setup.api} theme={theme} onToggleTheme={toggle} />
      {setup.devtools ? <FixturePanel controls={setup.api.controls} scenario={setup.scenario} /> : null}
    </>
  );
}
