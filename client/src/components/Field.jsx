import { forwardRef, useId } from 'react';
import { charCount } from '../notes/constraints.js';
import { Icon } from './Icon.jsx';

/**
 * Labelled text input / textarea with hint, live character counter and inline
 * error. Fully controlled: the parent owns `value` and `error`.
 *
 * No native maxLength: pasting over the limit is shown as an error rather than
 * silently truncated, so nothing the user wrote is lost.
 */
export const Field = forwardRef(function Field(
  { label, value, onChange, error, hint, limit, multiline = false, readOnly = false, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `field-${autoId}`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const count = charCount(value);
  const near = limit && count > limit * 0.9;
  const over = limit && count > limit;

  const describedBy = [error && errorId, (hint || limit) && hintId].filter(Boolean).join(' ') || undefined;
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div className={['field', error && 'field--invalid', className].filter(Boolean).join(' ')}>
      <div className="field__top">
        <label className="field__label" htmlFor={fieldId}>
          {label}
        </label>
        {limit ? (
          <span className={['field__count', near && 'field__count--near', over && 'field__count--over'].filter(Boolean).join(' ')} aria-hidden="true">
            {count.toLocaleString('en-US')} / {limit.toLocaleString('en-US')}
          </span>
        ) : null}
      </div>
      <Control
        ref={ref}
        id={fieldId}
        className="field__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        {...(multiline ? {} : { type: 'text' })}
        {...rest}
      />
      {error ? (
        <p className="field__error" id={errorId}>
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
      {hint || limit ? (
        <p className={hint ? 'field__hint' : 'visually-hidden'} id={hintId}>
          {hint ? `${hint} ` : ''}
          {/* The visible counter is aria-hidden; screen readers get the limit here. */}
          {limit ? <span className={hint ? 'visually-hidden' : undefined}>Up to {limit.toLocaleString('en-US')} characters.</span> : null}
        </p>
      ) : null}
    </div>
  );
});
