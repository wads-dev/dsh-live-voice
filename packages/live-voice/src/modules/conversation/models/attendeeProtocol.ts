/** Bounded wire contract. Never log audio, names, tokens or meeting URLs. */
export const ATTENDEE_MAX_MESSAGE = 128000;
export const ATTENDEE_MAX_PARTICIPANTS = 16;
export type AttendeeAudio = {
  botId: string;
  participantId: string;
  name?: string;
  chunk: string;
  sampleRate: number;
  timestamp: number;
};
export function attendeeAudio(value: any, botId?: string): AttendeeAudio {
  const d = value?.data;
  if (
    value?.trigger !== 'realtime_audio.per_participant' ||
    typeof value.bot_id !== 'string' ||
    !/^bot_[a-zA-Z0-9]{1,100}$/.test(value.bot_id) ||
    (botId && value.bot_id !== botId) ||
    typeof d?.participant_uuid !== 'string' ||
    !d.participant_uuid.length ||
    d.participant_uuid.length > 256 ||
    /[\x00-\x1f]/.test(d.participant_uuid) ||
    ![8000, 16000].includes(d.sample_rate) ||
    !Number.isSafeInteger(d.timestamp_ms) ||
    d.timestamp_ms < 0 ||
    typeof d.chunk !== 'string' ||
    !d.chunk.length ||
    d.chunk.length > 90000 ||
    d.chunk.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(d.chunk)
  )
    throw new Error('invalid-audio');
  const bytes =
    (d.chunk.length / 4) * 3 - (d.chunk.endsWith('==') ? 2 : d.chunk.endsWith('=') ? 1 : 0);
  if (bytes % 2 || bytes > d.sample_rate * 2) throw new Error('invalid-audio');
  return {
    botId: value.bot_id,
    participantId: d.participant_uuid,
    chunk: d.chunk,
    sampleRate: d.sample_rate,
    timestamp: d.timestamp_ms,
  };
}
export function decodeAttendeePcm(chunk: string): Float32Array {
  const raw = atob(chunk),
    out = new Float32Array(raw.length / 2);
  if (raw.length % 2) throw new Error('invalid-pcm');
  for (let i = 0; i < out.length; i++) {
    const n = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
    out[i] = (n & 0x8000 ? n - 65536 : n) / 32768;
  }
  return out;
}
