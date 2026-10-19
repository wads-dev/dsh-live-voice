import React from 'react';
import { Hint, Icon } from '../../live-voice/src/shared/design-system/index.js';
import { createRoot, type Root } from 'react-dom/client';
import { DebuggerPanel } from './DebuggerPanel.js';
import {
  namespace,
  registerDshLocales,
  useDebuggerLanguage,
  withDebuggerLanguage,
} from './i18n/index.js';
import { styles } from './styles.js';
import { syncDebuggerTheme } from './theme.js';
import { publishDeveloperExtension } from '../../live-voice/src/modules/core/developerExtension.js';
export const inject = ['locale'];
export function apply(ctx: any) {
  let enabled = false;
  let blocked = false;
  let popup: Window | null = null;
  let root: Root | null = null;
  let closedTimer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const t = registerDshLocales(ctx);
  const close = () => {
    if (closedTimer !== null) clearInterval(closedTimer);
    closedTimer = null;
    const oldRoot = root;
    const oldPopup = popup;
    root = null;
    popup = null;
    enabled = false;
    oldRoot?.unmount();
    if (oldPopup && !oldPopup.closed) oldPopup.close();
    notify();
  };
  function Host() {
    const { scoped: labels, current } = useDebuggerLanguage();
    React.useEffect(() => {
      if (popup && !popup.closed) popup.document.title = labels.commons.title;
    }, [labels.commons.title]);
    return (
      <DebuggerPanel
        copy={labels}
        locale={current.locale}
        target={window}
        onClose={() => queueMicrotask(close)}
      />
    );
  }
  // Open synchronously inside the user's click so browsers preserve popup permission.
  const open = () => {
    if (popup && !popup.closed) {
      popup.focus();
      return;
    }
    close();
    blocked = false;
    let candidate: Window | null = null;
    try {
      candidate = window.open(
        '',
        '',
        'popup=yes,width=720,height=850,resizable=yes,scrollbars=yes',
      );
      if (!candidate) {
        blocked = true;
        notify();
        return;
      }
      popup = candidate;
      const doc = candidate.document;
      doc.title = t('commons.title');
      doc.body.replaceChildren();
      doc.body.className = 'dlvd-window';
      syncDebuggerTheme(window, doc);
      const style = doc.createElement('style');
      style.textContent = styles;
      doc.head.appendChild(style);
      const container = doc.createElement('div');
      container.dataset.plugin = namespace;
      doc.body.appendChild(container);
      root = createRoot(container);
      root.render(<LocalizedHost />);
      enabled = true;
      closedTimer = setInterval(() => {
        if (popup?.closed) close();
        else if (popup) syncDebuggerTheme(window, popup.document);
      }, 250);
      notify();
    } catch {
      close();
      if (candidate && !candidate.closed) candidate.close();
      blocked = true;
      notify();
    }
  };
  function Settings() {
    const failed = React.useSyncExternalStore(subscribe, () => blocked);
    const { scoped: labels } = useDebuggerLanguage();
    return (
      <div className="dlv-diagnostics-launcher">
        <button type="button" className="dlv-diagnostics-button" onClick={open}>
          <Icon name="bug" />
          {labels.commons.diagnostics}
        </button>
        <Hint label={labels.commons.diagnostics}>{labels.commons.activate}</Hint>
        {failed && <p role="alert">{labels.commons.popupBlocked}</p>}
      </div>
    );
  }
  const LocalizedHost = withDebuggerLanguage(Host, ctx.locale);
  const LocalizedSettings = withDebuggerLanguage(Settings, ctx.locale);
  ctx.effect(
    () =>
      publishDeveloperExtension(window, {
        version: 1,
        label: () => t('commons.developer'),
        component: LocalizedSettings,
      }),
    namespace + ': Developer tab',
  );
  ctx.effect(() => {
    window.addEventListener('pagehide', close);
    return () => {
      window.removeEventListener('pagehide', close);
      close();
      listeners.clear();
    };
  }, namespace + ': separate window');
}
