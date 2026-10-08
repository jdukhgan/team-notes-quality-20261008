import { Icon } from './Icon.jsx';

export function EmptyState({ icon = 'note', title, children, action, tone = 'neutral' }) {
  return (
    <div className={`empty empty--${tone}`}>
      <span className="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__body">{children}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}
