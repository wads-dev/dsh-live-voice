import React from 'react';

/** Interactive context panel, above its trigger and outside composer clipping. */
export function ContextPopover({
  label,
  trigger,
  children,
}: React.PropsWithChildren<{
  label: string;
  trigger: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}>) {
  const id = React.useId();
  const [anchor, setAnchor] = React.useState<HTMLButtonElement | null>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const close = (restoreFocus = false) => {
    if (restoreFocus) anchor?.focus();
    setAnchor(null);
  };
  React.useLayoutEffect(() => {
    const node = panel.current;
    if (!anchor || !node) return;
    node.showPopover?.();
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const bubble = node.getBoundingClientRect();
      node.style.left =
        Math.max(12, Math.min(rect.right - bubble.width, window.innerWidth - bubble.width - 12)) +
        'px';
      node.style.top = Math.max(12, rect.top - bubble.height - 8) + 'px';
    };
    position();
    node.querySelector<HTMLElement>('select, button, input, [tabindex]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!node.contains(event.target as Node) && !anchor.contains(event.target as Node)) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    const focus = (event: FocusEvent) => {
      if (!node.contains(event.target as Node) && !anchor.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('focusin', focus);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      node.hidePopover?.();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('focusin', focus);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [anchor]);
  return (
    <>
      {React.cloneElement(trigger, {
        'aria-haspopup': 'dialog',
        'aria-expanded': Boolean(anchor),
        'aria-controls': anchor ? id : undefined,
        onContextMenu: (event) => {
          event.preventDefault();
          setAnchor(event.currentTarget);
        },
        onKeyDown: (event) => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            setAnchor(event.currentTarget);
          } else trigger.props.onKeyDown?.(event);
        },
      })}
      {anchor && (
        <div
          ref={panel}
          id={id}
          popover="manual"
          role="dialog"
          aria-label={label}
          className="dlv-context-popover"
        >
          {children}
        </div>
      )}
    </>
  );
}
