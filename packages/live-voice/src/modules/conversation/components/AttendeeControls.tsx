import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { Hint, SettingsSubcard, PillButton } from '../../../shared/design-system/index.js';
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
  const credentialAction = async (operation: () => Promise<any>, saving = false) => {
    if (pending.current || originEditingRef.current || credential === null) return;
    pending.current = true;
    setCredentialBusy(true);
    setCredentialError('');
    try {
      await operation();
    } catch (error) {
      if (alive.current)
        setCredentialError(
          saving && !String(error?.message).startsWith('credential-')
            ? a.failed()
            : credentialFailure(error),
        );
    } finally {
      if (alive.current) {
        if (saving) setKey('');
        setConfirmRemove(false);
        await refreshCredential(true);
        if (alive.current) setCredentialBusy(false);
      }
      pending.current = false;
    }
  };
  const busy = s.starting;
  const unresolved = s.hasBotControl || s.joinUncertain;
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
      {
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
          <PillButton
            disabled={credential === null || originEditing || credentialBusy || !key.trim()}
            onClick={() =>
              void credentialAction(() => client.saveCredential(settings.attendeeApiUrl, key), true)
            }
          >
            {credential ? a.credentialReplace() : a.credentialSave()}
          </PillButton>
        </>
      }
      {credential && !originEditing && !confirmRemove && (
        <PillButton
          type="button"
          disabled={credentialBusy}
          onClick={() => {
            if (!originEditingRef.current) setConfirmRemove(true);
          }}
        >
          {a.credentialRemove()}
        </PillButton>
      )}
      {confirmRemove && !originEditing && (
        <div role="group" aria-label={a.credentialRemove()}>
          <div role="alert">{a.credentialRemoveWarning()}</div>
          <PillButton
            type="button"
            disabled={credentialBusy}
            onClick={() =>
              void credentialAction(() => client.removeCredential(settings.attendeeApiUrl))
            }
          >
            {a.credentialRemoveConfirm()}
          </PillButton>
          <PillButton
            type="button"
            disabled={credentialBusy}
            onClick={() => setConfirmRemove(false)}
          >
            {a.credentialCancel()}
          </PillButton>
        </div>
      )}
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
export function AttendeeControls({ client, settings, onDisconnect }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const a = (copy as any).attendee;
  const s = React.useSyncExternalStore(client.subscribe, client.getSnapshot) as any;
  const [meetingUrl, setMeetingUrl] = React.useState('');
  const { error, invoke } = useAttendeeAction(a);
  const hasMeeting = Boolean(
    s.active ||
    s.starting ||
    s.hasBotControl ||
    s.botId ||
    s.joining ||
    s.joinUncertain ||
    s.leaveRequested ||
    s.leaving,
  );
  const disconnecting = React.useRef(false);
  const disconnect = () => {
    if (disconnecting.current) return;
    disconnecting.current = true;
    onDisconnect?.();
    invoke(async () => {
      try {
        await client.disconnectMeeting();
      } finally {
        disconnecting.current = false;
      }
    });
  };
  const nativeRecognition = settings.recognitionEngine === 'browser';
  const submitting = React.useRef(false);
  const canJoin =
    meetingUrl.trim() && !s.starting && !s.joining && !s.tlsRequired && !nativeRecognition;
  const submit = () => {
    if (!canJoin || submitting.current) return;
    submitting.current = true;
    invoke(async () => {
      try {
        await client.connectMeeting(meetingUrl, settings.attendeeBotName, {
          apiUrl: settings.attendeeApiUrl,
          ingressUrl: settings.attendeeIngressUrl,
        });
      } finally {
        submitting.current = false;
      }
    });
  };
  return (
    <section className="dlv-attendee-controls dlv-attendee-quick" aria-label={a.title()}>
      {!hasMeeting && (
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
            onInput={(e) => setMeetingUrl(e.currentTarget.value)}
          />
          <PillButton type="submit" disabled={!canJoin}>
            {s.starting || s.joining ? a.connecting() : a.connectMeeting()}
          </PillButton>
        </form>
      )}
      {nativeRecognition && <div role="alert">{a.recognitionRequired()}</div>}
      {s.tlsRequired && <div role="alert">{a.tlsNeeded()}</div>}
      {s.joinUncertain && <div role="alert">{a.joinFailed()}</div>}
      {hasMeeting && <strong className="dlv-meeting-active-title">{a.title()}</strong>}
      <div className="dlv-meeting-active-summary">
        <AttendeeBotStatus state={s} />
        {hasMeeting && (
          <PillButton
            style={{ width: 'auto', height: 'auto', borderRadius: 8, minHeight: 34 }}
            onClick={disconnect}
          >
            {a.disconnectMeeting()}
          </PillButton>
        )}
      </div>
      {hasMeeting && <AttendeeControlFeedback state={s} />}
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
      {(s.error || error) && (
        <div role="alert">
          {s.error || error}{' '}
          {[a.credentialMissing(), a.credentialInvalid(), a.credentialUnavailable()].includes(
            s.error || error,
          ) && a.configureInSettings()}
        </div>
      )}
    </section>
  );
}
