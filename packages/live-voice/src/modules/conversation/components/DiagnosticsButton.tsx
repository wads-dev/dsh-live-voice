import React from 'react';
import { IconButton } from '../../../shared/design-system/index.js';
import { useLanguage } from '../../../app/client/i18n/index.js';
import {
  readDeveloperExtension,
  subscribeDeveloperExtension,
} from '../../core/developerExtension.js';
export function DiagnosticsButton({ controller }: { controller: any }) {
  const extension = React.useSyncExternalStore(
    subscribeDeveloperExtension,
    readDeveloperExtension,
    () => null,
  );
  const { scoped } = useLanguage((ctx) => ctx.debugger);
  const copy = scoped as any;
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [extension]);
  if (!extension?.open) return null;
  return (
    <span className="dlv-bar-diagnostics">
      <IconButton
        icon="bug"
        className="dlv-pill-button dlv-diagnostics-shortcut"
        label={copy.label()}
        onClick={() => {
          try {
            setFailed(
              extension.open!({
                recordingId:
                  controller.recordingId?.() ??
                  controller.recognition?.session?.writer?.session?.id,
              }) === false,
            );
          } catch {
            setFailed(true);
          }
        }}
      />
      {failed && (
        <span className="dlv-diagnostics-shortcut-error" role="alert">
          {copy.popupBlocked()}
        </span>
      )}
    </span>
  );
}
