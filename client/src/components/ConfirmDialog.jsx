import { useEffect, useId, useRef } from 'react';
import { Button } from './Button.jsx';

/**
 * Modal confirmation on native <dialog>: focus is trapped, Escape cancels and
 * focus returns to the opener. The safe action (cancel) receives initial focus.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 className="dialog__title" id={titleId}>
        {title}
      </h2>
      <div className="dialog__body" id={bodyId}>
        {children}
      </div>
      <div className="dialog__actions">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
