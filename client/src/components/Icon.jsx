// Small stroke icon set (24px grid, currentColor). Decorative by default;
// pass a `title` only when the icon is the sole label.

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4.2-4.2',
  close: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  archive: 'M4 7h16M5 7v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M3 4h18v3H3zM10 12h4',
  restore: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  back: 'M15 18l-6-6 6-6',
  alert: 'M12 8v5M12 16.5v.01M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  note: 'M6 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h5M8 13h8M8 17h5',
  info: 'M12 11v6M12 7.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
};

export function Icon({ name, size = 18, title, className }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
