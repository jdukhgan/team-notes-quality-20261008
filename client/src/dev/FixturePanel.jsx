import { useEffect, useState } from 'react';

/**
 * Developer-only controls for the fixture adapter (shown with ?devtools=1).
 * Not part of the product UI.
 */
export function FixturePanel({ controls, scenario }) {
  const [options, setOptions] = useState(controls.get());
  useEffect(() => controls.subscribe(setOptions), [controls]);

  const toggle = (key) => (event) => controls.set({ [key]: event.target.checked });

  return (
    <details className="fixture-panel">
      <summary>Fixture controls</summary>
      <p className="fixture-panel__scenario">Scenario: {scenario}</p>
      <label>
        <input type="checkbox" checked={options.failNextSave} onChange={toggle('failNextSave')} /> Fail next save
      </label>
      <label>
        <input type="checkbox" checked={options.failNextArchive} onChange={toggle('failNextArchive')} /> Fail next archive/restore
      </label>
      <label>
        <input type="checkbox" checked={options.failNextList} onChange={toggle('failNextList')} /> Fail next list load
      </label>
      <label>
        <input type="checkbox" checked={options.missingNextSave} onChange={toggle('missingNextSave')} /> Next save: note missing (404)
      </label>
      <label>
        Latency {options.latency} ms
        <input
          type="range"
          min="0"
          max="3000"
          step="50"
          value={options.latency}
          onChange={(event) => controls.set({ latency: Number(event.target.value) })}
        />
      </label>
    </details>
  );
}
