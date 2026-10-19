# HTTP text-to-speech contracts

[HTTP engine overview](HTTP-ENGINES.md) · [Recognition contracts](HTTP-STT.md)

Implement the **host → speech server** contracts below. Browser → DSH routes are listed separately at the end. All output is complete-file synthesis, not incremental streaming. Live Voice segmentation/prefetch can prepare the next utterance but does not turn one HTTP response into a streaming protocol.

## Qwen-compatible speech

### Address and readiness

Default base URL: `http://127.0.0.1:8080/`, configurable in Qwen connection settings (or host default `DSH_LIVE_VOICE_QWEN_URL`). Relative routes are appended to the normalized base path. HTTP and HTTPS are accepted; redirects are not. No Authorization header or configurable API key is added.

The capability check uses `GET health`. For a generic compatible server, return a successful status and:

~~~json
{ "models": { "tts": true, "asr": true } }
~~~

For speech-only use, `tts: true` suffices for the TTS-specific check; the shared connection test checks both ASR and TTS. Do not report `asr: true` unless you implement recognition too.

If health returns `{ "service": "ominix-api" }`, readiness instead also calls `GET v1/models/status` and expects:

~~~json
{ "models": { "qwen3_tts": "customvoice", "asr": "qwen3-asr" } }
~~~

Only the requested operation must be ready for its operation-specific check. These model-status names select the existing adapter behavior, not a requirement that another compatible server run those exact internals.

### Synthesis request

`POST v1/audio/speech` with `Content-Type: application/json`:

~~~json
{
  "model": "qwen3-tts",
  "input": "Hello from the assistant.",
  "voice": "aiden",
  "language": "english",
  "response_format": "wav"
}
~~~

| Field | What Live Voice sends |
| --- | --- |
| `model` | Always `qwen3-tts` |
| `input` | Nonblank text, at most 100,000 JavaScript UTF-16 code units, without NUL |
| `voice` | One of the fixed IDs below; default `aiden` |
| `language` | `pt*` → `portuguese`, `en*` → `english` (case-insensitive prefixes); `auto`/unspecified TTS language resolves to `portuguese`; other supplied values pass through |
| `response_format` | Always `wav` |

Supported voice IDs are `aiden`, `ryan`, `uncle_fu`, `dylan`, `eric`, `vivian`, `serena`, `ono_anna` and `sohee`. There is no provider voice-catalog request. A compatible server must accept the selected ID or return a clear error; arbitrary voice IDs are rejected by the bridge.

### Synthesis response

Return HTTP 2xx with **binary, complete PCM WAV**, conventionally `Content-Type: audio/wav`. No JSON/base64, URL, SSE or MP3. The Qwen host validates successful status and a byte length of 44–50,000,000; the WAV still must be decodable by the host transcoder (length validation alone is not format validation). Output sample rate is not forced to the STT 16 kHz format. Qwen synthesis does not perform a health request itself; readiness checks happen separately.

Non-2xx makes synthesis fail; this adapter reports the HTTP status rather than parsing a provider error body. Default request timeout is 300,000 ms; configurable range 1,000–600,000 ms. The upstream payload contains no `speed` or `rate`: playback rate/volume/output device are browser-player controls.

Example against a compatible **speech server**, using non-sensitive test text:

~~~sh
curl --fail-with-body http://127.0.0.1:8080/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-tts","input":"Hello.","voice":"aiden","language":"english","response_format":"wav"}' \
  --output qwen-test.wav
~~~

## Chatterbox-compatible jobs and reference voices

### Address, language and trust boundary

Fixed origin: `http://127.0.0.1:7865` **on the DSH host**. There is no configurable origin. Redirects are rejected. The current bridge accepts omitted `lang`, `pt` or `pt-BR` (case-insensitive); it rejects other languages before creating a job. The upstream job contains text/voice, not a language/model or a reference-file path. Select the correct Portuguese model on the server.

Mutating requests include `X-Chatterbox-Client: dsh`. This is a local-client marker, **not a secret** or authentication mechanism. A compatible private server should validate it; the local deployment additionally rejects browser Origin/Sec-Fetch requests. Use only authorized reference voices. See [setup and platform limits](CHATTERBOX.md).

### Required endpoints

| Method and path | Request | Successful response the bridge consumes |
| --- | --- | --- |
| `GET /v1/health` | No body | JSON `phase`; `error` means unsupported |
| `GET /v1/voices` | No body; 5-second deadline | JSON `voices` array, at most 1,000 entries |
| `POST /v1/jobs` | JSON text and optional voice; mutation header | JSON with `id`: exactly 32 lowercase hex characters |
| `GET /v1/jobs/:id` | No body | JSON `phase`; polled approximately every 150 ms |
| `GET /v1/audio/:id` | No body, after `done` | Binary complete WAV, exact `Content-Type: audio/wav` |
| `DELETE /v1/jobs/:id` | No body; mutation header | Success status recommended; body is not consumed |

Health example (additional informational fields are optional):

~~~json
{ "phase": "ready", "model": "pt-br", "streaming": false }
~~~

The bridge currently treats any health phase except `error` as supported; that is not a guarantee the model is already loaded. Health has a 5-second deadline. Opening voice settings calls only the catalog, not health or synthesis.

Catalog example:

~~~json
{ "voices": [{ "id": "bbbbbbbbbbbbbbbbbbbbbbbb", "name": "Authorized reference" }] }
~~~

Each selectable ID is exactly **24 lowercase hex** characters. Display name is a string at most 200 UTF-16 code units. Invalid entries are filtered; malformed/oversized arrays fail. IDs identify server-owned references, never caller-supplied filesystem paths. An empty voice uses the server default; missing saved IDs are not silently replaced during discovery.

Admission request:

~~~http
POST /v1/jobs
Content-Type: application/json
X-Chatterbox-Client: dsh
~~~

~~~json
{ "text": "Olá, esta é uma frase de teste.", "voice": "bbbbbbbbbbbbbbbbbbbbbbbb" }
~~~

Text must be nonblank, at most 12,000 UTF-16 code units, without NUL. `voice` is optional; it is omitted for the server default. Return HTTP 2xx, for example:

~~~json
{ "id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
~~~

Status while pending:

~~~json
{ "phase": "generating" }
~~~

Use `queued`, `generating` or `watermarking` while pending; `done` permits download. Terminal failures are `{ "phase": "error", "message": "Synthesis failed" }` or `{ "phase": "cancelled" }`. The client continues polling other nonterminal phases until cancellation/deadline; do not return a success phase without an available audio file. Non-2xx JSON errors may use `{ "error": "Queue is full" }`; no fixed status code is required by the client.

Audio must have the RIFF signature, be a decodable complete PCM WAV, and stay within 64 MiB (67,108,864 bytes); the host transcoder also requires at least a complete WAV header. Return exactly `audio/wav`, without a charset suffix, because the current adapter compares that header literally. Do not return JSON, base64, an audio URL or a chunk stream.

The bridge calls DELETE after **both successful consumption and failure/cancellation**, with a 3-second cleanup timeout. Make deletion idempotent; cancel pending work, discard late output and release transient audio. Cleanup failures do not override the main result. Admission has its own 10-second timeout so a job ID can still be obtained and cancelled when the caller disconnects meanwhile; the overall synthesis deadline is five minutes. Cancellation cannot guarantee immediate GPU preemption.

The local service currently serializes inference with bounded admission, but queue size, text splitting and watermark implementation are server deployment policy, not fields in this protocol. Another compatible server must still bound its resources and honor cancellation/cleanup. No server installer or reference audio is shipped with the plugin.

## Browser → DSH bridge (not the server you implement)

All these endpoints use DSH's existing authenticated same-origin connection carrier:

| Method and path | Payload | Success |
| --- | --- | --- |
| `GET /api/dsh-live-voice/qwen/capabilities?kind=tts` | None | `{ "ok": true, "value": { "supported": true, "local": true, "location": "host", "streaming": false, "models": { "tts": true } } }` (capability can instead report unsupported) |
| `POST /api/dsh-live-voice/qwen/speech` | JSON `{ "text": "Hello.", "lang": "en-US", "voice": "aiden", "rate": 1 }` | Binary AAC/M4A, `audio/mp4` |
| `GET /api/dsh-live-voice/chatterbox/voices` | None | `{ "ok": true, "value": [{ "id": "bbbbbbbbbbbbbbbbbbbbbbbb", "name": "Authorized reference" }] }` |
| `GET /api/dsh-live-voice/chatterbox/capabilities` | None | `{ "ok": true, "value": { "supported": true, "local": true, "location": "host", "pause": true, "resume": true } }` |
| `POST /api/dsh-live-voice/chatterbox/speech` | JSON `{ "text": "Olá.", "lang": "pt-BR", "voice": "bbbbbbbbbbbbbbbbbbbbbbbb", "rate": 1 }` | Binary AAC/M4A, `audio/mp4` |

Speech success is **binary**, not an `ok/value` envelope. Both routes return `Cache-Control: no-store`. The browser sends `rate`, but these Qwen/Chatterbox host routes do not forward it to inference. Chatterbox's client sends neutral synthesis rate 1; actual playback speed, volume and pause/resume stay browser-owned. Omit `voice` for the provider default (an empty Chatterbox voice is also allowed).

Chatterbox rejects malformed JSON with 400 `invalid-request` and JSON text bodies over 64,000 encoded bytes with 413. Other speech failures are JSON `{ "ok": false, "error": { "code": "chatterbox-unavailable", "message": "…" } }` with 502, or 499/`cancelled` when Request.signal is aborted. Qwen speech failures use 502/`synthesis-failed` or 499/`cancelled`. Qwen's shared configuration/test routes are described in [STT configuration](HTTP-STT.md#browser--dsh-bridge-not-the-server-you-implement).

The existing macOS Say engine also has DSH `GET /api/dsh-live-voice/say/capabilities` and `POST /api/dsh-live-voice/say/speech` (JSON text/voice/rate → AAC/M4A). It invokes native host synthesis rather than an external HTTP speech server, so it is not a third compatible-server protocol. Browser speech likewise has no provider HTTP contract.

## Implementation references

- [Qwen host](../packages/live-voice/src/modules/core/qwen/QwenHttpHost.ts)
- [Chatterbox host](../packages/live-voice/src/modules/speak/engines/chatterbox/ChatterboxHttpHost.ts) and [DSH routes](../packages/live-voice/src/app/server/chatterboxRoutes.ts)
- [Qwen/Say DSH routes](../packages/live-voice/src/app/server/apply.ts) and [host audio conversion](../packages/live-voice/src/modules/speak/engines/audio/M4aAacTranscoder.ts)
