import React from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { Hint, SettingsSubcard, IconButton } from '../../../shared/design-system/index.js';
import { DraftField } from '../../../shared/design-system/forms/DraftField.js';

function useAttendeeAction(a: any) {
  const [error, setError] = React.useState('');
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const invoke = (operation: () => any) => {
    setError('');
    try {
      Promise.resolve(operation()).catch(() => {
        if (alive.current) setError(a.failed());
      });
    } catch {
      if (alive.current) setError(a.failed());
    }
  };
  return { error, invoke };
}

/** Keyed by origin so neither credentials nor metadata can cross API origins. */
export function AttendeeConnectionSettings(props: any) {
  return <AttendeeConnectionForm key={props.settings.attendeeApiUrl} {...props} />;
}

function AttendeeConnectionForm({ client, settings, updateSettings }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const a = (copy as any).attendee;
  const s = React.useSyncExternalStore(client.subscribe, client.getSnapshot) as any;
  const [key, setKey] = React.useState('');
  const [originEditing, setOriginEditing] = React.useState(false);
  const originEditingRef = React.useRef(false);
  const [credential, setCredential] = React.useState<boolean | null>(null);
  const [credentialError, setCredentialError] = React.useState('');
  const [credentialBusy, setCredentialBusy] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const alive = React.useRef(true);
  const pending = React.useRef(false);
  const request = React.useRef(0);
  const credentialFailure = (error: any) => {
    const code = error?.message;
    return code === 'credential-missing'
      ? a.credentialMissing()
      : code === 'credential-storage-invalid'
        ? a.credentialInvalid()
        : a.credentialUnavailable();
  };
  const refreshCredential = async (preserveError = false) => {
    const revision = ++request.current;
    try {
      const value = await client.credentialMetadata(settings.attendeeApiUrl);
      if (alive.current && revision === request.current) {
        setCredential(value.hasSavedKey === true);
        if (!preserveError) setCredentialError('');
      }
    } catch (error) {
      if (alive.current && revision === request.current) {
        setCredential(null);
        setCredentialError(credentialFailure(error));
      }
    }
  };
  React.useEffect(() => {
    alive.current = true;
    void refreshCredential();
    return () => {
      alive.current = false;
      ++request.current;
    };
  }, [client]);
  const credentialAction = async (operation: () => Promise<any>, connecting = false) => {
    if (pending.current || originEditingRef.current || credential === null) return;
    pending.current = true;
    setCredentialBusy(true);
    setCredentialError('');
    try {
      await operation();
    } catch (error) {
      if (alive.current)
        setCredentialError(
          connecting && !String(error?.message).startsWith('credential-')
            ? a.failed()
            : credentialFailure(error),
        );
    } finally {
      if (alive.current) {
        if (connecting) setKey('');
        setConfirmRemove(false);
        await refreshCredential(true);
        if (alive.current) setCredentialBusy(false);
      }
      pending.current = false;
    }
  };
  const { error, invoke } = useAttendeeAction(a);
  const busy = s.active || s.starting;
  const unresolved = s.hasBotControl || s.joinUncertain;
  const nativeRecognition = settings.recognitionEngine === 'browser';
  return (
    <section className="dlv-attendee-connection">
      <Hint label={a.connection()}>{a.settingsHelp()}</Hint>
      <DraftField
        label={a.apiUrl()}
        value={settings.attendeeApiUrl}
        onInput={() => {
          originEditingRef.current = true;
          setOriginEditing(true);
          setKey('');
          setConfirmRemove(false);
        }}
        onBlur={(event) => {
          if (event.currentTarget.value.trim() === settings.attendeeApiUrl) {
            originEditingRef.current = false;
            setOriginEditing(false);
          }
        }}
        disabled={!updateSettings || busy || unresolved || credentialBusy}
        maxLength={256}
        onCommit={(value) => updateSettings?.({ attendeeApiUrl: value.trim() })}
      />
      <SettingsSubcard title={a.advanced()} open={false}>
        <DraftField
          label={a.ingressUrl()}
          value={settings.attendeeIngressUrl}
          disabled={!updateSettings || busy || unresolved || credentialBusy}
          maxLength={1024}
          onCommit={(value) => updateSettings?.({ attendeeIngressUrl: value.trim() })}
        />
        <DraftField
          label={a.botId()}
          value={settings.attendeeBotId}
          disabled={!updateSettings || busy || unresolved || credentialBusy}
          maxLength={128}
          onCommit={(value) => updateSettings?.({ attendeeBotId: value.trim() })}
        />
      </SettingsSubcard>
      <output role="status">
        {credential === null || originEditing
          ? a.credentialChecking()
          : credential
            ? a.credentialSaved()
            : a.credentialNotSaved()}
      </output>
      <Hint label={a.apiKey()}>{a.credentialHelp()}</Hint>
      {credentialError && <div role="alert">{credentialError}</div>}
      {!busy && !unresolved && (
        <>
          <label>
            {a.apiKey()}
            <input
              type="password"
              autoComplete="off"
              value={key}
              placeholder={credential && !originEditing ? a.credentialSaved() : undefined}
              disabled={credentialBusy || originEditing}
              onInput={(e) => setKey(e.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            disabled={
              credential === null ||
              originEditing ||
              credentialBusy ||
              (!key.trim() && !credential) ||
              nativeRecognition
            }
            onClick={() =>
              void credentialAction(
                () =>
                  client.start({
                    apiUrl: settings.attendeeApiUrl,
                    ingressUrl: settings.attendeeIngressUrl,
                    botId: settings.attendeeBotId,
                    ...(key.trim() ? { apiKey: key } : {}),
                    verify: true,
                  }),
                true,
              )
            }
          >
            {a.start()}
          </button>
        </>
      )}
      {credential && !originEditing && !confirmRemove && (
        <button
          type="button"
          disabled={credentialBusy}
          onClick={() => {
            if (!originEditingRef.current) setConfirmRemove(true);
          }}
        >
          {a.credentialRemove()}
        </button>
      )}
      {confirmRemove && !originEditing && (
        <div role="group" aria-label={a.credentialRemove()}>
          <div role="alert">{a.credentialRemoveWarning()}</div>
          <button
            type="button"
            disabled={credentialBusy}
            onClick={() =>
              void credentialAction(() => client.removeCredential(settings.attendeeApiUrl))
            }
          >
            {a.credentialRemoveConfirm()}
          </button>
          <button type="button" disabled={credentialBusy} onClick={() => setConfirmRemove(false)}>
            {a.credentialCancel()}
          </button>
        </div>
      )}
      <output role="status">
        {s.starting ? a.connecting() : s.active ? a.connected() : a.receiverInactive()}
      </output>
      {s.active && (
        <button type="button" onClick={() => invoke(() => client.stop())}>
          {a.stop()}
        </button>
      )}
      {nativeRecognition && <div role="alert">{a.recognitionRequired()}</div>}
      {s.tlsRequired && <div role="alert">{a.tlsNeeded()}</div>}
      {(s.error || error) && <div role="alert">{s.error || error}</div>}
      <AttendeeControlFeedback state={s} />
    </section>
  );
}

export function AttendeeSettings({ client, settings, updateSettings }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const a = (copy as any).attendee;
  const [connectionOpen, setConnectionOpen] = React.useState(false);
  return (
    <section className="dlv-attendee-controls">
      <DraftField
        label={a.defaultBotName()}
        value={settings.attendeeBotName}
        maxLength={80}
        onCommit={(value) => updateSettings({ attendeeBotName: value })}
      />
      <details
        className="dlv-settings-subcard"
        onToggle={(e) => setConnectionOpen(e.currentTarget.open)}
      >
        <summary>{a.connection()}</summary>
        {connectionOpen && client && (
          <AttendeeConnectionSettings
            client={client}
            settings={settings}
            updateSettings={updateSettings}
          />
        )}
      </details>
    </section>
  );
}

/** Native local dialog, separate from the quick popover; closing never disposes the client. */
export function AttendeeConnectionDialog({ client, settings, updateSettings, onClose }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const a = (copy as any).attendee;
  const dialog = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    node.querySelector<HTMLElement>('input:not(:disabled),button')?.focus();
    return () => {
      if (node.open) node.close();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="dlv-attendee-dialog dlv-settings"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h3 id={titleId}>{a.connection()}</h3>
        <IconButton icon="close" label={(commons as any).dismiss()} onClick={onClose} />
      </header>
      <AttendeeConnectionSettings
        client={client}
        settings={settings}
        updateSettings={updateSettings}
      />
    </dialog>,
    document.body,
  );
}

export function AttendeeBotStatus({ state }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const a = (copy as any).attendee;
  if (!state.botId || state.controlError) return null;
  const departure = state.leaveRequested;
  return (
    <output role="status">
      {state.leaving ? a.leaving() : departure ? a.departureRequested() : a.admissionUnknown()}
    </output>
  );
}

export function AttendeeControlFeedback({ state }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const a = (copy as any).attendee;
  const key =
    {
      'leave-failed': 'leaveFailed',
      'control-unavailable': 'controlUnavailable',
      'control-expired': 'controlExpired',
      'control-released': 'controlReleased',
      'control-unknown': 'controlUnknown',
    }[state.controlError] || 'controlUnknown';
  return state.controlError ? <div role="alert">{a[key]()}</div> : null;
}

/** Compact explicit join UI. No API key or receiver controls belong to the quick menu. */
export function AttendeeControls({ client, settings, onConfigure, draft, onDraftChange }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const a = (copy as any).attendee;
  const s = React.useSyncExternalStore(client.subscribe, client.getSnapshot) as any;
  const [localDraft, setLocalDraft] = React.useState({
    meetingUrl: '',
    botName: settings.attendeeBotName,
  });
  const { meetingUrl, botName } = draft || localDraft;
  const changeDraft = (patch) => {
    const next = { ...(draft || localDraft), ...patch };
    if (onDraftChange) onDraftChange(next);
    else setLocalDraft(next);
  };
  const [confirmRelease, setConfirmRelease] = React.useState(false);
  const { error, invoke } = useAttendeeAction(a);
  const unresolved = s.hasBotControl || s.joinUncertain;
  const nativeRecognition = settings.recognitionEngine === 'browser';
  const submitting = React.useRef(false);
  const canJoin =
    s.active &&
    meetingUrl.trim() &&
    botName.trim() &&
    !s.joining &&
    !s.tlsRequired &&
    !nativeRecognition;
  const submit = () => {
    if (!canJoin || submitting.current) return;
    submitting.current = true;
    invoke(async () => {
      try {
        await client.join(meetingUrl, botName);
      } finally {
        submitting.current = false;
      }
    });
  };
  return (
    <section className="dlv-attendee-controls dlv-attendee-quick" aria-label={a.title()}>
      {!s.botId && !s.joinUncertain && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            type="url"
            aria-label={a.meetingUrl()}
            placeholder={a.meetingUrl()}
            value={meetingUrl}
            maxLength={2048}
            disabled={s.joining}
            onInput={(e) => changeDraft({ meetingUrl: e.currentTarget.value })}
          />
          <div className="dlv-meeting-join-row">
            <input
              aria-label={a.botName()}
              placeholder={a.botName()}
              value={botName}
              maxLength={80}
              disabled={s.joining}
              onInput={(e) => changeDraft({ botName: e.currentTarget.value })}
            />
            <IconButton icon="settings" label={a.configureConnection()} onClick={onConfigure} />
            <IconButton
              type="submit"
              icon="send"
              label={s.joining ? a.joining() : a.join()}
              disabled={!canJoin}
            />
          </div>
        </form>
      )}
      {nativeRecognition && <div role="alert">{a.recognitionRequired()}</div>}
      {s.tlsRequired && <div role="alert">{a.tlsNeeded()}</div>}
      {s.joinUncertain && <div role="alert">{a.joinFailed()}</div>}
      <AttendeeBotStatus state={s} />
      {s.hasBotControl && s.botId && (
        <button type="button" disabled={s.leaving} onClick={() => invoke(() => client.leave())}>
          {s.leaving ? a.leaving() : a.leave()}
        </button>
      )}
      <AttendeeControlFeedback state={s} />
      {unresolved && !confirmRelease && (
        <button
          type="button"
          disabled={s.joining || s.leaving}
          onClick={() => setConfirmRelease(true)}
        >
          {a.releaseControl()}
        </button>
      )}
      {confirmRelease && (
        <div className="dlv-meeting-confirm" role="group" aria-label={a.releaseControl()}>
          <div role="alert">{a.releaseWarning()}</div>
          <button
            type="button"
            disabled={s.joining || s.leaving}
            onClick={() => {
              invoke(() => client.releaseControl());
              setConfirmRelease(false);
            }}
          >
            {a.confirmRelease()}
          </button>
          <button type="button" onClick={() => setConfirmRelease(false)}>
            {(commons as any).update.cancel()}
          </button>
        </div>
      )}
      {!!s.participants.length && (
        <SettingsSubcard title={a.participants()} open={false}>
          {s.participants.map((participant) => (
            <DraftField
              key={participant.source}
              label={participant.originalName || participant.name}
              value={participant.name}
              maxLength={80}
              onCommit={(value) => client.rename(participant.source, value)}
            />
          ))}
          <Hint label={a.participants()}>{a.aliasHelp()}</Hint>
        </SettingsSubcard>
      )}
      {(s.error || error) && <div role="alert">{s.error || error}</div>}
    </section>
  );
}
