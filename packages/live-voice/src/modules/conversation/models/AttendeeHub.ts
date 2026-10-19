import { randomBytes, timingSafeEqual } from 'node:crypto';
import { attendeeAudio, ATTENDEE_MAX_PARTICIPANTS } from './attendeeProtocol.js';
/** One explicit browser owner, bounded live-only queue; no audio persistence. */
export class AttendeeHub {
  session: any = null;
  open() {
    if (this.session) throw new Error('busy');
    const s = {
      owner: randomBytes(32).toString('hex'),
      ingest: randomBytes(32).toString('hex'),
      botId: '',
      events: [] as any[],
      sequence: 0,
      bytes: 0,
      names: new Map(),
      participants: new Set(),
      status: 'waiting',
      error: '',
      lastRead: Date.now(),
      socket: null as any,
    };
    this.session = s;
    return s;
  }
  owns(token: string, ingest = false) {
    const expected = this.session?.[ingest ? 'ingest' : 'owner'];
    return this.ownsControl(token, expected);
  }
  ownsControl(token: string, expected?: string) {
    return (
      typeof token === 'string' &&
      /^[a-f0-9]{64}$/.test(token) &&
      expected &&
      token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    );
  }
  ingest(value: any) {
    const s = this.session;
    if (!s) throw new Error('closed');
    if (s.error) throw new Error('closed');
    const a = attendeeAudio(value, s.botId || undefined);
    if (!s.botId) s.botId = a.botId;
    if (!s.participants.has(a.participantId) && s.participants.size >= ATTENDEE_MAX_PARTICIPANTS)
      throw new Error('participants-limit');
    s.participants.add(a.participantId);
    a.name = s.names.get(a.participantId);
    s.events.push({ sequence: ++s.sequence, ...a });
    s.bytes += a.chunk.length;
    // Fail closed instead of silently losing audio or retaining unbounded history.
    if (s.bytes > 2000000 || s.events.length > 1500 || Date.now() - s.lastRead > 15000)
      throw new Error('overloaded');
    s.status = 'receiving';
  }
  read(cursor: number) {
    const s = this.session;
    if (!s) throw new Error('closed');
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > s.sequence)
      throw new Error('invalid-cursor');
    if (s.events.length && cursor < s.events[0].sequence - 1) throw new Error('audio-gap');
    s.lastRead = Date.now();
    while (s.events.length && s.events[0].sequence <= cursor)
      s.bytes -= s.events.shift().chunk.length;
    const events = [];
    let batchBytes = 0;
    for (const event of s.events) {
      if (events.length >= 100 || (events.length && batchBytes + event.chunk.length > 128000))
        break;
      events.push(event);
      batchBytes += event.chunk.length;
    }
    return {
      status: s.status,
      error: s.error,
      botId: s.botId,
      participants: [...s.names].map(([id, name]) => ({ id, name })),
      events,
      hasMore: s.events.length > events.length,
      cursor: events.at(-1)?.sequence ?? cursor,
    };
  }
  fail(code: string) {
    if (!this.session) return;
    this.session.error = code;
    this.session.status = 'failed';
    this.session.socket?.close(1008, 'stream stopped');
  }
  close() {
    const s = this.session;
    this.session = null;
    s?.socket?.close(1000, 'receiver closed');
    if (s) {
      s.events.length = 0;
      s.names.clear();
      s.participants.clear();
    }
  }
}
