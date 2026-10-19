// @ts-nocheck
import { connectAttendeeRelay } from './attendeeRelay.js';
import { createAttendeeCredentialStore, validateAttendeeKey } from './attendeeCredentials.js';
import { AttendeeHub } from '../../modules/conversation/models/AttendeeHub.js';
import { ATTENDEE_MAX_MESSAGE } from '../../modules/conversation/models/attendeeProtocol.js';
import {
  ATTENDEE_ROOT as ROOT,
  attendeeReceiverUrl,
  validateAttendeeApi,
  validateAttendeeIngress,
  attendeeApiRequest,
  attendeeParticipantNames,
} from './attendeeConnection.js';
/** Saved credentials stay host-only; live control leases retain their capture-time credential. */
export function registerAttendeeRoutes(
  ctx,
  loadWs = () => import('ws'),
  fetcher = (...args) => globalThis.fetch(...args),
  credentials = createAttendeeCredentialStore(),
) {
  const hub = new AttendeeHub();
  let disposed = false;
  let disposeUpgrade, server, timer, pollAbort, controlTimer;
  let control = null;
  const clear = () => {
    const s = hub.session;
    if (s && control?.owner === s.owner && !control.botId && s.botId) control.botId = s.botId;
    clearInterval(timer);
    pollAbort?.abort();
    pollAbort = null;
    hub.session?.relayAbort?.abort();
    if (hub.session) hub.session.api = null;
    hub.close();
  };
  const unresolved = (c) => c && (c.botId || c.joining || c.joinUncertain);
  const controlValue = () => ({
    hasBotControl: Boolean(control),
    botId: control?.botId || '',
    botState: control?.botState || '',
    joining: Boolean(control?.joining),
    joinUncertain: Boolean(control?.joinUncertain),
    leaving: Boolean(control?.leaving),
    controlExpiresAt: control
      ? Math.min(control.lastSeen + 300000, control.createdAt + 7200000)
      : 0,
    controlError: control?.error || null,
  });
  const release = () => {
    clear();
    clearInterval(controlTimer);
    const c = control;
    control = null;
    c?.abort.abort();
    if (c) c.api = null;
  };
  const expire = () => {
    if (control && Date.now() >= controlValue().controlExpiresAt) release();
  };
  const ownsControl = (owner) => {
    expire();
    return hub.ownsControl(owner, control?.owner);
  };
  const register = ctx.connection.fetch.register({
    path: ROOT,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const headers = { 'cache-control': 'no-store' };
      try {
        if (disposed) throw new Error('closed');
        if (request.method === 'GET') {
          const url = new URL(request.url);
          if (url.searchParams.get('action') === 'credential')
            return Response.json(
              {
                ok: true,
                value: await credentials.metadata(
                  validateAttendeeApi(url.searchParams.get('apiUrl')),
                ),
              },
              { headers },
            );
          if (url.searchParams.get('action') === 'capabilities')
            return Response.json(
              {
                ok: true,
                value: {
                  receiverUrl: attendeeReceiverUrl(ctx.webServer),
                  tlsRequired: !attendeeReceiverUrl(ctx.webServer),
                },
              },
              { headers },
            );
          const token = request.headers.get('x-dlv-attendee-owner');
          if (!ownsControl(token) || (url.searchParams.get('action') !== 'control' && !hub.session))
            return Response.json(
              { ok: false, error: { code: 'ownership' } },
              { status: 403, headers },
            );
          control.lastSeen = Date.now();
          if (!control.botId && hub.session?.botId) control.botId = hub.session.botId;
          if (url.searchParams.get('action') === 'control')
            return Response.json({ ok: true, value: controlValue() }, { headers });
          return Response.json(
            {
              ok: true,
              value: {
                ...hub.read(Number(url.searchParams.get('cursor') || 0)),
                ...controlValue(),
              },
            },
            { headers },
          );
        }
        const text = await request.text();
        if (text.length > 12000) throw new Error('invalid-request');
        const p = JSON.parse(text);
        if (p.action === 'credential-save' || p.action === 'credential-remove') {
          const origin = validateAttendeeApi(p.apiUrl);
          const value =
            p.action === 'credential-save'
              ? await credentials.save(origin, validateAttendeeKey(p.apiKey))
              : await credentials.remove(origin);
          return Response.json({ ok: true, value }, { headers });
        }
        if (['close', 'release'].includes(p.action)) {
          if (!ownsControl(p.owner))
            return Response.json(
              { ok: false, error: { code: 'ownership' } },
              { status: 403, headers },
            );
          if (!control.botId && hub.session?.botId) control.botId = hub.session.botId;
          if (p.action === 'release' || !unresolved(control)) release();
          else clear();
          return Response.json({ ok: true, value: controlValue() }, { headers });
        }
        if (['join', 'leave'].includes(p.action)) {
          if (!ownsControl(p.owner))
            return Response.json(
              { ok: false, error: { code: 'ownership' } },
              { status: 403, headers },
            );
          const c = control;
          c.lastSeen = Date.now();
          if (!c.botId && hub.session?.botId) c.botId = hub.session.botId;
          const s = hub.session;
          if (p.action === 'leave') {
            if (!c.botId) throw new Error('invalid-bot');
            if (c.leaving) throw new Error('busy');
            c.leaving = true;
            try {
              const result = await c.api('bots/' + encodeURIComponent(c.botId) + '/leave', {
                method: 'POST',
                body: '{}',
                signal: c.abort.signal,
              });
              if (control !== c) throw new Error('ownership');
              if (result?.state && /^[a-z_]{1,80}$/.test(result.state)) c.botState = result.state;
              c.error = null;
              clear();
              return Response.json(
                { ok: true, value: { ...controlValue(), leaving: false, leaveRequested: true } },
                { headers },
              );
            } catch (error) {
              if (control === c) c.error = 'leave-failed';
              throw error;
            } finally {
              c.leaving = false;
            }
          }
          if (!s || c.botId || c.joining || c.joinUncertain) throw new Error('busy');
          if (!s.ingestUrl) throw new Error('tls-required');
          const meeting = new URL(p.meetingUrl);
          if (
            meeting.protocol !== 'https:' ||
            meeting.hostname !== 'meet.google.com' ||
            meeting.port ||
            !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(meeting.pathname) ||
            meeting.username ||
            meeting.password
          )
            throw new Error('invalid-meeting');
          if (
            typeof p.botName !== 'string' ||
            !p.botName.trim() ||
            p.botName.length > 80 ||
            /[\x00-\x1f]/.test(p.botName)
          )
            throw new Error('invalid-bot');
          c.joining = true;
          try {
            // Never retry: a timed-out POST may already have created a real bot.
            const result = await c.api('bots', {
              method: 'POST',
              signal: c.abort.signal,
              body: JSON.stringify({
                meeting_url: meeting.origin + meeting.pathname,
                bot_name: p.botName.trim(),
                recording_settings: { format: 'none' },
                transcription_settings: { meeting_closed_captions: {} },
                websocket_settings: {
                  per_participant_audio: { url: s.ingestUrl, sample_rate: 16000 },
                },
              }),
            });
            if (
              !/^bot_[a-zA-Z0-9]{1,100}$/.test(result?.id) ||
              control !== c ||
              (c.botId && c.botId !== result.id)
            )
              throw new Error('join-uncertain');
            c.botId = result.id;
            c.botState = /^[a-z_]{1,80}$/.test(result.state || '') ? result.state : '';
            if (hub.session === s) {
              s.botId = c.botId;
              void s.refresh?.();
            }
            return Response.json(
              { ok: true, value: { ...controlValue(), joining: false } },
              { headers },
            );
          } catch {
            if (control === c) {
              c.joinUncertain = true;
              c.error = 'control-unknown';
            }
            throw new Error('join-uncertain');
          } finally {
            c.joining = false;
          }
        }
        expire();
        if (p.action !== 'open' || hub.session || control)
          throw new Error(hub.session || control ? 'busy' : 'invalid-request');
        if (!ctx.webServer?.registerUpgrade) throw new Error('web-unavailable');
        const api = validateAttendeeApi(p.apiUrl);
        const explicitKey = p.apiKey !== undefined && p.apiKey !== '';
        if (explicitKey) validateAttendeeKey(p.apiKey);
        if (p.botId && !/^bot_[a-zA-Z0-9]{1,100}$/.test(p.botId)) throw new Error('invalid-bot');
        const ingressValue = p.ingressUrl || attendeeReceiverUrl(ctx.webServer);
        const ingress = ingressValue ? validateAttendeeIngress(ingressValue) : null;
        // This origin must be routed to the DSH Web listener by a trusted TLS proxy.
        // Never start a second public listener or weaken TLS verification.
        // One Connect saves a typed key before verification, or reuses only this exact origin.
        const key = explicitKey ? validateAttendeeKey(p.apiKey) : await credentials.get(api);
        if (explicitKey) await credentials.save(api, key);
        if (disposed || hub.session || control) throw new Error(disposed ? 'closed' : 'busy');
        const s = hub.open();
        s.botId = p.botId || '';
        s.api = attendeeApiRequest(api, key, fetcher);
        control = {
          owner: s.owner,
          api: s.api,
          botId: s.botId,
          botState: '',
          createdAt: Date.now(),
          lastSeen: Date.now(),
          abort: new AbortController(),
        };
        controlTimer = setInterval(expire, 2000);
        controlTimer.unref?.();
        s.ingressUrl = ingress?.href || '';
        if (p.verify === true) {
          try {
            await s.api('bots?limit=1');
          } catch {
            if (hub.session === s) release();
            throw new Error('invalid-api');
          }
          if (hub.session !== s) throw new Error('closed');
        }
        try {
          if (!ingress && p.verify === true) {
            s.relayAbort = new AbortController();
            try {
              s.relayUrl = await connectAttendeeRelay(key, hub, s, loadWs, fetcher, s.relayAbort);
            } catch {
              throw new Error('relay-unavailable');
            }
            if (disposed || hub.session !== s) {
              s.relayAbort.abort();
              throw new Error('closed');
            }
          }
          if (ingress && !server) {
            const { WebSocketServer } = await loadWs();
            if (disposed || hub.session !== s) throw new Error('closed');
            server = new WebSocketServer({
              noServer: true,
              maxPayload: ATTENDEE_MAX_MESSAGE,
              perMessageDeflate: false,
            });
            try {
              disposeUpgrade = ctx.webServer.registerUpgrade({
                path: ROOT + '/ingest',
                handler: (req, socket, head) => {
                  const u = new URL(req.url, 'http://receiver');
                  if (
                    req.headers.origin ||
                    !hub.owns(u.searchParams.get('token'), true) ||
                    hub.session.socket
                  ) {
                    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
                    return;
                  }
                  const s = hub.session;
                  server.handleUpgrade(req, socket, head, (ws) => {
                    s.socket = ws;
                    ws.on('error', () => {
                      if (hub.session === s) hub.fail('connection');
                    });
                    ws.on('close', () => {
                      if (hub.session === s && !s.error) {
                        s.status = 'disconnected';
                      }
                    });
                    ws.on('message', (data, binary) => {
                      if (hub.session !== s) return;
                      try {
                        if (binary || s.error) throw new Error('invalid-audio');
                        hub.ingest(JSON.parse(data.toString()));
                      } catch (e) {
                        hub.fail(
                          ['overloaded', 'participants-limit'].includes(e.message)
                            ? e.message
                            : 'invalid-audio',
                        );
                      }
                    });
                  });
                },
              });
            } catch (error) {
              server.close();
              server = null;
              throw error;
            }
          }
        } catch (e) {
          // A cancelled import belongs only to its original lease. It must not
          // revoke a receiver opened while module loading was still pending.
          if (hub.session === s) release();
          throw e;
        }
        const refresh = async () => {
          if (hub.session !== s) return;
          if (Date.now() - s.lastRead > 15000) {
            clear();
            return;
          }
          if (!s.botId || s.error || pollAbort) return;
          pollAbort = new AbortController();
          const abort = pollAbort;
          const deadline = setTimeout(() => abort.abort(), 5000);
          try {
            const names = await attendeeParticipantNames(s.api, api, s.botId, abort.signal);
            if (hub.session !== s || abort.signal.aborted) return;
            s.names = names;
          } catch {
            if (hub.session === s) hub.fail('participants');
          } finally {
            clearTimeout(deadline);
            if (pollAbort === abort) pollAbort = null;
          }
        };
        s.refresh = refresh;
        timer = setInterval(() => void refresh(), 2000);
        timer.unref?.();
        ingress?.searchParams.set('token', s.ingest);
        s.ingestUrl = s.relayUrl || ingress?.href || '';
        return Response.json(
          {
            ok: true,
            value: {
              ...controlValue(),
              owner: s.owner,
              ingestUrl: s.ingestUrl,
              tlsRequired: !s.ingestUrl,
              botId: s.botId,
              hasSavedKey: true,
            },
          },
          { headers },
        );
      } catch (e) {
        const code =
          e?.code === 'ERR_MODULE_NOT_FOUND'
            ? 'dependency'
            : [
                  'ownership',
                  'busy',
                  'web-unavailable',
                  'invalid-api',
                  'credential-missing',
                  'credential-storage-invalid',
                  'credential-storage-unavailable',
                  'invalid-bot',
                  'tls-required',
                  'invalid-ingress',
                  'invalid-request',
                  'invalid-meeting',
                  'join-uncertain',
                  'relay-unavailable',
                ].includes(e.message)
              ? e.message
              : 'failed';
        return Response.json(
          { ok: false, error: { code } },
          { status: code === 'busy' && control ? 409 : 400, headers },
        );
      }
    },
  });
  ctx.effect(
    () => () => {
      disposed = true;
      release();
      disposeUpgrade?.();
      server?.close();
      return register();
    },
    'dsh-live-voice: remove Attendee receiver',
  );
}
