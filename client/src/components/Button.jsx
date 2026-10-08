import { forwardRef } from 'react';
import { Icon } from './Icon.jsx';
import { Spinner } from './Spinner.jsx';

/**
 * Button with primary / secondary / ghost / danger variants.
 *
 * `disabled` and `pending` use aria-disabled instead of the native attribute so
 * the button keeps keyboard focus while locked (focus is not dropped to <body>
 * mid-request) and clicks are swallowed, which prevents duplicate submissions.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    icon,
    pending = false,
    pendingLabel,
    disabled = false,
    iconOnly = false,
    className,
    onClick,
    children,
    ...rest
  },
  ref,
) {
  const locked = disabled || pending;
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, iconOnly && 'btn--icon', className]
    .filter(Boolean)
    .join(' ');

  function handleClick(event) {
    if (locked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      aria-disabled={locked || undefined}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      onClick={handleClick}
      {...rest}
    >
      {pending ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {iconOnly ? children : <span className="btn__label">{pending && pendingLabel ? pendingLabel : children}</span>}
    </button>
  );
});
