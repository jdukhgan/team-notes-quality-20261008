import { forwardRef, useRef, useImperativeHandle } from 'react';
import { Icon } from './Icon.jsx';
import { Spinner } from './Spinner.jsx';

/**
 * Controlled search box. Escape or the clear button empties it and keeps focus
 * in the input. `busy` shows an inline spinner while results refresh.
 */
export const SearchField = forwardRef(function SearchField(
  { value, onChange, busy = false, label = 'Search notes', placeholder = 'Search notes' },
  ref,
) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current);

  function clear() {
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className="search" role="search">
      <label className="visually-hidden" htmlFor="note-search">
        {label}
      </label>
      <Icon name="search" className="search__icon" />
      <input
        ref={inputRef}
        id="note-search"
        className="search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            clear();
          }
        }}
      />
      {busy ? <Spinner size={14} /> : null}
      {value ? (
        <button type="button" className="search__clear" onClick={clear} aria-label="Clear search">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
});
