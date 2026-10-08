const OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Segmented Active / Archived switch built on native radios, so arrow keys,
 * labels and form semantics work without extra scripting.
 */
export function StatusFilter({ value, onChange }) {
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">Show notes</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="segmented__option">
          <input
            type="radio"
            name="note-status"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
