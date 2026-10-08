export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ '--spinner-size': `${size}px` }} aria-hidden="true" />;
}
