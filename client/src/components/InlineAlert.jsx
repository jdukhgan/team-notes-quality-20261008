import { forwardRef } from 'react';
import { Icon } from './Icon.jsx';

const ICONS = { danger: 'alert', success: 'check', info: 'info' };

/**
 * Inline message block. Danger alerts use role="alert" so they are announced
 * as soon as they render; success/info use role="status" (polite).
 */
export const InlineAlert = forwardRef(function InlineAlert({ tone = 'info', title, children, actions, onDismiss, className }, ref) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={['alert', `alert--${tone}`, className].filter(Boolean).join(' ')}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon name={ICONS[tone]} className="alert__icon" />
      <div className="alert__content">
        {title ? <p className="alert__title">{title}</p> : null}
        {children ? <div className="alert__body">{children}</div> : null}
        {actions ? <div className="alert__actions">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="alert__dismiss" onClick={onDismiss} aria-label="Dismiss message">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
});
