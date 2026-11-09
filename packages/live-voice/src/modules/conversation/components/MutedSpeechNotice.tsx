import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../shared/design-system/index.js';
import { useLanguage } from '../../../app/client/i18n/index.js';
export function MutedSpeechNotice({ source }: { source?: string }) {
  const { scoped } = useLanguage((ctx) => ctx.recognition);
  const copy = (scoped as any).mutedWarning;
  const target = typeof document === 'undefined' ? null : document.body;
  return target
    ? createPortal(
        <div className="dlv-muted-warning" role="alert" aria-live="assertive">
          <Icon name="micOff" className="dlv-muted-warning-icon" />
          <div className="dlv-muted-warning-content">
            <span className="dlv-muted-warning-origin">{copy.origin()}</span>
            <strong>{copy.title()}</strong>
            <span>{copy.body()}</span>
            {source && <span className="dlv-muted-warning-source">{source}</span>}
          </div>
        </div>,
        target,
      )
    : null;
}
