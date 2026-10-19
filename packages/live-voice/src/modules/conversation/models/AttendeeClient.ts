// @ts-nocheck
import { ParticipantPcmMeter } from './ParticipantPcmMeter.js';
const ROOT = '/api/dsh-live-voice/attendee';
/** Explicit receiver lease. Audio is never fetched until the user starts it. */
export class AttendeeClient {
  constructor(meeting, createEngine, t, fetcher = (...args) => globalThis.fetch(...args)) {
    Object.assign(this, { meeting, createEngine, t, fetcher });
    this.rows = new Map();
    this.discovered = new Map();
    this.aliases = new Map();
    this.queues = new Map();
    this.queuedBytes = 0;
    this.generation = 0;
    this.controlRevision = 0;
    this.stopping = Promise.resolve();
    this.snapshot = {
      active: false,
      starting: false,
      error: null,
      ingestUrl: '',
      participants: [],
      botId: '',
      botState: '',
      leaveRequested: false,
      hasBotControl: false,
      leaving: false,
      controlExpiresAt: 0,
      controlError: null,
      joining: false,
      joinUncertain: false,
      tlsRequired: false,
      receiverUrl: '',
    };
    this.listeners = new Set();
  }
  getSnapshot = () => this.snapshot;
  subscribe = (f) => {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  };
  patch(value) {
    this.snapshot = { ...this.snapshot, ...value };
    for (const f of this.listeners) f();
  }
  async request(value, signal) {
    const r = await this.fetcher(ROOT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
      signal,
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error?.code || 'failed');
    return j.value;
  }
  async credentialMetadata(apiUrl) {
    const response = await this.fetcher(
      ROOT + '?action=credential&apiUrl=' + encodeURIComponent(apiUrl),
    );
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error?.code || 'failed');
    return { hasSavedKey: json.value.hasSavedKey === true };
  }
  async saveCredential(apiUrl, apiKey) {
    const value = await this.request({ action: 'credential-save', apiUrl, apiKey });
    return { hasSavedKey: value.hasSavedKey === true };
  }
  async removeCredential(apiUrl) {
    const value = await this.request({ action: 'credential-remove', apiUrl });
    return { hasSavedKey: value.hasSavedKey === true };
  }
  async capabilities() {
    if (this.snapshot.active || this.snapshot.starting) return;
    const generation = this.generation;
    const requestId = (this.capabilitiesRequest = (this.capabilitiesRequest || 0) + 1);
    try {
      const response = await this.fetcher(ROOT + '?action=capabilities');
      const json = await response.json();
      if (
        generation !== this.generation ||
        requestId !== this.capabilitiesRequest ||
        this.snapshot.active ||
        this.snapshot.starting
      )
        return;
      if (!response.ok || !json.ok) throw new Error('failed');
      this.patch({ receiverUrl: json.value.receiverUrl, tlsRequired: json.value.tlsRequired });
    } catch {
      if (
        generation === this.generation &&
        requestId === this.capabilitiesRequest &&
        !this.snapshot.active &&
        !this.snapshot.starting
      )
        this.patch({ error: this.t('failed') });
    }
  }
  publishParticipants() {
    const entries = new Map(this.discovered);
    for (const row of this.rows.values())
      entries.set(row.source, {
        source: row.source,
        originalName: row.originalName || row.name,
        blocks: row.blocks,
      });
    this.patch({
      participants: [...entries.values()].map((row) => ({
        ...row,
        name: this.aliases.get(row.source) || row.originalName,
      })),
    });
  }
  syncParticipant(row, originalName = row.originalName) {
    row.originalName = originalName;
    const alias = this.aliases.get(row.source);
    row.name = alias || originalName;
    this.meeting.transcript.setLabel(row.source, row.name);
    row.engine.sourceLabel = row.name;
    if (row.botId && row.participantId)
      row.engine.recordingParticipant = {
        provider: 'attendee',
        groupId: row.botId,
        participantId: row.participantId,
        originalName,
        ...(alias ? { alias } : {}),
      };
  }
  rename(source, value) {
    const alias = String(value)
      .replace(/[\x00-\x1f]/g, '')
      .trim()
      .slice(0, 80);
    if (alias) this.aliases.set(source, alias);
    else this.aliases.delete(source);
    const row = this.rows.get(source),
      discovered = this.discovered.get(source);
    const name = alias || row?.originalName || discovered?.originalName;
    if (name) {
      this.meeting.transcript.setLabel(source, name);
      if (row) this.syncParticipant(row);
    }
    this.publishParticipants();
  }
  applyControl(value) {
    ++this.controlRevision;
    this.patch({
      hasBotControl: Boolean(value.hasBotControl),
      botId: value.botId || this.snapshot.botId || '',
      botState: value.botState || this.snapshot.botState || '',
      joining: Boolean(value.joining),
      joinUncertain: Boolean(value.joinUncertain),
      leaving: Boolean(value.leaving),
      leaveRequested: Boolean(value.leaveRequested ?? this.snapshot.leaveRequested),
      controlExpiresAt: value.controlExpiresAt || 0,
      controlError: value.controlError || null,
    });
  }
  watchControl() {
    clearInterval(this.controlTimer);
    this.controlTimer = setInterval(() => void this.refreshControl(), 10000);
    this.controlTimer.unref?.();
  }
  async refreshControl() {
    const owner = this.owner;
    if (!owner || this.controlReading || this.disposed) return;
    this.controlReading = true;
    this.controlAbort = new AbortController();
    const revision = this.controlRevision;
    try {
      const r = await this.fetcher(ROOT + '?action=control', {
        headers: { 'x-dlv-attendee-owner': owner },
        signal: AbortSignal.any([this.controlAbort.signal, AbortSignal.timeout(8000)]),
      });
      const j = await r.json();
      if (owner !== this.owner || this.disposed) return;
      if (!r.ok || !j.ok) {
        if (r.status === 403) {
          this.owner = null;
          clearInterval(this.controlTimer);
          await this.stop();
          this.patch({
            hasBotControl: false,
            controlExpiresAt: 0,
            controlError: 'control-expired',
          });
          return;
        }
        throw Error('control-unavailable');
      }
      if (revision === this.controlRevision) this.applyControl(j.value);
    } catch {
      if (owner === this.owner && !this.disposed)
        this.patch({ controlError: 'control-unavailable' });
    } finally {
      this.controlReading = false;
    }
  }
  async releaseControl() {
    const owner = this.owner;
    this.commandAbort?.abort();
    this.controlAbort?.abort();
    await this.stop();
    if (!owner) {
      this.patch({
        joining: false,
        joinUncertain: false,
        leaving: false,
        controlError: 'control-released',
      });
      return;
    }
    if (owner !== this.owner) return;
    try {
      await this.request({ action: 'release', owner }, AbortSignal.timeout(8000));
      if (owner !== this.owner) return;
      this.owner = null;
      clearInterval(this.controlTimer);
      this.patch({
        hasBotControl: false,
        controlExpiresAt: 0,
        joining: false,
        joinUncertain: false,
        leaving: false,
        controlError: 'control-released',
      });
    } catch {
      if (owner === this.owner) this.patch({ controlError: 'control-unavailable' });
    }
  }
  dispose() {
    if (this.disposing) return this.disposing;
    this.disposed = true;
    this.controlAbort?.abort();
    this.commandAbort?.abort();
    clearInterval(this.controlTimer);
    this.disposing = (async () => {
      const owner = this.owner;
      const unresolved =
        this.snapshot.botId || this.snapshot.joinUncertain || this.snapshot.joining;
      await this.stop();
      if (owner)
        await this.request({ action: 'release', owner }, AbortSignal.timeout(3000)).catch(() => {});
      this.owner = null;
      this.patch({
        hasBotControl: false,
        controlExpiresAt: 0,
        joining: false,
        leaving: false,
        controlError: unresolved ? 'control-released' : null,
      });
    })();
    return this.disposing;
  }
  async join(meetingUrl, botName) {
    if (!this.owner || this.snapshot.joining || this.snapshot.joinUncertain || this.snapshot.botId)
      return;
    const owner = this.owner;
    ++this.controlRevision;
    this.patch({ joining: true, error: null, controlError: null });
    this.commandAbort = new AbortController();
    try {
      const result = await this.request(
        { action: 'join', owner: this.owner, meetingUrl, botName },
        AbortSignal.any([this.commandAbort.signal, AbortSignal.timeout(8000)]),
      );
      if (owner !== this.owner || this.disposed) return;
      this.applyControl({ ...result, hasBotControl: true, joining: false });
    } catch (e) {
      if (owner === this.owner && !this.disposed)
        this.patch({
          joining: false,
          controlError: 'control-unknown',
          joinUncertain: e.message === 'join-uncertain' || e.name === 'TimeoutError',
          error: this.t(
            e.message === 'tls-required'
              ? 'tlsNeeded'
              : e.message === 'invalid-meeting'
                ? 'invalidMeeting'
                : 'joinFailed',
          ),
        });
    }
  }
  async leave() {
    if (!this.owner || !this.snapshot.botId || this.snapshot.leaving) return;
    const owner = this.owner;
    ++this.controlRevision;
    this.patch({ leaving: true, controlError: null });
    this.commandAbort = new AbortController();
    try {
      const result = await this.request(
        { action: 'leave', owner },
        AbortSignal.any([this.commandAbort.signal, AbortSignal.timeout(8000)]),
      );
      if (owner !== this.owner || this.disposed) return;
      await this.stop();
      if (owner === this.owner && !this.disposed)
        this.applyControl({ ...result, hasBotControl: true, leaving: false });
    } catch {
      if (owner === this.owner && !this.disposed)
        this.patch({ leaving: false, controlError: 'leave-failed' });
    }
  }
  async start(config) {
    if (
      this.disposed ||
      this.snapshot.hasBotControl ||
      this.snapshot.joining ||
      this.snapshot.joinUncertain
    )
      return;
    const stopping = this.stop();
    const generation = ++this.generation;
    await stopping;
    if (generation !== this.generation) return;
    if (this.canStart && !this.canStart()) {
      this.patch({ error: this.t('failed') });
      return;
    }
    this.abort = new AbortController();
    this.patch({
      starting: true,
      error: null,
      botId: '',
      botState: '',
      leaveRequested: false,
      controlError: null,
    });
    try {
      const value = await this.request({ action: 'open', ...config }, this.abort.signal);
      if (generation !== this.generation) {
        const hasBot = value.botId || value.joinUncertain || value.joining;
        await this.request(
          { action: hasBot || this.disposed ? 'release' : 'close', owner: value.owner },
          AbortSignal.timeout(3000),
        );
        if (hasBot && !this.owner)
          this.patch({
            botId: value.botId || '',
            botState: value.botState || '',
            controlError: 'control-released',
          });
        return;
      }
      this.owner = value.owner;
      this.applyControl({ ...value, hasBotControl: true });
      this.watchControl();
      this.cursor = 0;
      this.patch({
        starting: false,
        active: true,
        ingestUrl: value.ingestUrl,
        tlsRequired: value.tlsRequired,
        botId: value.botId || '',
        joinUncertain: false,
      });
      void this.poll(generation);
    } catch (e) {
      if (generation === this.generation)
        this.patch({
          starting: false,
          error: this.t(
            {
              'relay-unavailable': 'relayUnavailable',
              'credential-missing': 'credentialMissing',
              'credential-storage-invalid': 'credentialInvalid',
              'credential-storage-unavailable': 'credentialUnavailable',
            }[e.message] || 'failed',
          ),
        });
    }
  }
  async poll(generation) {
    while (generation === this.generation) {
      try {
        const revision = this.controlRevision;
        const r = await this.fetcher(ROOT + '?cursor=' + this.cursor, {
          headers: { 'x-dlv-attendee-owner': this.owner },
          signal: this.abort.signal,
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error('failed');
        if (generation !== this.generation) return;
        if (j.value.hasBotControl !== undefined && revision === this.controlRevision)
          this.applyControl(j.value);
        if (j.value.botId) this.patch({ botId: j.value.botId });
        if (j.value.error || j.value.status === 'disconnected')
          throw new Error(j.value.error || 'disconnected');
        if (j.value.botId) this.patch({ botId: j.value.botId });
        if (Array.isArray(j.value.participants)) {
          this.discovered.clear();
          for (const participant of j.value.participants) {
            const source = 'attendee:' + j.value.botId + ':' + participant.id;
            this.discovered.set(source, { source, originalName: participant.name });
            const row = this.rows.get(source);
            if (row) this.syncParticipant(row, participant.name);
          }
          this.publishParticipants();
        }
        for (const event of j.value.events) {
          if (generation !== this.generation) return;
          this.enqueue(event, generation);
        }
        this.cursor = j.value.cursor;
        // Attendee omits all-zero frames. A transport idle boundary seals real PCM;
        // it does not synthesize a fake captured-silence timeline.
        for (const row of this.rows.values()) {
          if (!this.queues.has(row.source) && !row.finished && Date.now() - row.lastSeen > 1500) {
            row.finished = true;
            await row.engine.finish?.();
          }
        }
        await new Promise((resolve) => {
          this.wake = resolve;
          // Drain a full batch promptly; the normal 100 ms idle cadence must
          // not cap the aggregate packet rate of independent participants.
          this.timer = setTimeout(resolve, j.value.hasMore ? 0 : 100);
        });
      } catch (e) {
        if (generation === this.generation) {
          await this.stop();
          this.patch({ error: this.t('failed') });
        }
        return;
      }
    }
  }
  enqueue(event, generation) {
    const source = 'attendee:' + event.botId + ':' + event.participantId;
    if (!this.queues.has(source) && this.queues.size >= 16) throw new Error('participants-limit');
    this.queuedBytes += event.chunk.length;
    if (this.queuedBytes > 2000000) throw new Error('overloaded');
    const previous = this.queues.get(source) || Promise.resolve();
    const work = previous
      .then(async () => {
        if (generation === this.generation) await this.audio(event, generation);
      })
      .catch(async () => {
        if (generation === this.generation) {
          await this.stop();
          this.patch({ error: this.t('failed') });
        }
      })
      .finally(() => {
        if (generation !== this.generation) return;
        this.queuedBytes -= event.chunk.length;
        if (this.queues.get(source) === work) this.queues.delete(source);
      });
    this.queues.set(source, work);
  }
  async audio(event, generation) {
    if (this.canDeliver && !this.canDeliver()) throw new Error('no-composer');
    const source = 'attendee:' + event.botId + ':' + event.participantId;
    let row = this.rows.get(source);
    if (!row) {
      if (this.rows.size >= 16) throw new Error('participants-limit');
      const originalName =
        event.name ||
        this.discovered.get(source)?.originalName ||
        this.t('participant', { number: this.rows.size + 1 });
      const name = this.aliases.get(source) || originalName;
      const meter = new ParticipantPcmMeter(event.sampleRate),
        engine = this.createEngine(source, meter, name);
      row = {
        source,
        name,
        originalName,
        botId: event.botId,
        participantId: event.participantId,
        meter,
        engine,
        sampleRate: event.sampleRate,
        last: 0,
        lastSeen: Date.now(),
        blocks: 0,
        finished: false,
      };
      this.rows.set(source, row);
      this.syncParticipant(row);
      await this.meeting.start(source, undefined, { meter, engine });
      if (generation !== this.generation) return;
      if (!this.meeting.getSnapshot()[source]?.listening) throw new Error('recognition');
    }
    if (!row.finished && row.last && event.timestamp - row.last > 1500) {
      row.finished = true;
      await row.engine.finish?.();
    }
    if (event.name) this.syncParticipant(row, event.name);
    if (row.finished) {
      // A new capture must not abort the previous burst's accepted STT request.
      const deadline = Date.now() + 10000;
      while (this.meeting.getSnapshot()[source]?.pending) {
        if (generation !== this.generation) return;
        if (Date.now() > deadline) throw new Error('overloaded');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (generation !== this.generation) return;
      await this.meeting.start(source, undefined, { meter: row.meter, engine: row.engine });
      if (generation !== this.generation) return;
      row.finished = false;
      row.captureStarted = false;
    }
    if (!this.meeting.getSnapshot()[source]?.listening) throw new Error('recognition-stopped');
    if (event.sampleRate !== row.sampleRate) throw new Error('sample-rate');
    if (event.timestamp < row.last) throw new Error('audio-order');
    row.last = event.timestamp;
    row.lastSeen = Date.now();
    row.blocks++;
    const firstPacket = !row.captureStarted;
    if (firstPacket) {
      row.captureStarted = true;
      const recording = row.engine.session?.writer?.session;
      if (recording) row.captureOffset = event.timestamp - Date.parse(recording.startedAt);
      row.engine.attendeeTimestampOffset = row.captureOffset || 0;
    }
    row.meter.push(event.chunk);
    this.publishParticipants();
  }
  async stop() {
    ++this.generation;
    clearTimeout(this.timer);
    this.wake?.();
    this.abort?.abort();
    const owner = this.owner;
    const revision = this.controlRevision;
    const rows = [...this.rows.values()];
    for (const source of this.discovered.keys())
      if (!this.rows.has(source)) this.meeting.transcript.forget(source);
    this.rows.clear();
    this.discovered.clear();
    this.aliases.clear();
    this.queues.clear();
    this.queuedBytes = 0;
    this.patch({
      active: false,
      starting: false,
      ingestUrl: '',
      participants: [],
    });
    const releases = rows.map((row) => this.meeting.removeParticipant(row.source));
    if (owner)
      releases.push(
        this.request({ action: 'close', owner }, AbortSignal.timeout(3000))
          .then((value) => {
            if (this.owner !== owner || this.disposed) return;
            if (value.hasBotControl === undefined)
              value = {
                ...value,
                hasBotControl: Boolean(
                  this.snapshot.botId || this.snapshot.joining || this.snapshot.joinUncertain,
                ),
              };
            if (revision !== this.controlRevision) return;
            this.applyControl(value);
            if (!value.hasBotControl) {
              this.owner = null;
              clearInterval(this.controlTimer);
            }
          })
          .catch(() => {
            if (this.owner === owner) this.patch({ controlError: 'control-unavailable' });
          }),
      );
    const previous = this.stopping;
    this.stopping = Promise.all([previous, ...releases]).then(() => {});
    await this.stopping;
  }
}
