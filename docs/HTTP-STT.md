# HTTP speech-to-text contracts

[HTTP engine overview](HTTP-ENGINES.md) · [Speech synthesis contracts](HTTP-TTS.md)

A compatible transcription server can use any underlying model, but it must implement the selected adapter's complete input/output contract. Whisper and Qwen HTTP are the two recognition adapters. Browser-native recognition and browser-local Whisper/Qwen inference do not use these endpoints.

## Shared audio and result format

The host validates a complete **RIFF/WAVE, mono, 16,000 Hz, signed PCM16 little-endian** file: PCM format code 1, 16 bits per sample, 2-byte block alignment, 32,000 bytes/second, one nonempty even-sized data chunk, matching RIFF/chunk lengths. Browser capture is resampled/encoded before upload. Do not expect raw PCM, Opus archive pages or a microphone stream.

Each inference call returns HTTP 2xx with JSON:

~~~json
{ "text": "Recognized speech goes here." }
~~~

The adapters read only top-level `text`, trim it and ignore extra fields. Return a string; absent text becomes an empty result, not a schema-error report. There is no segment/timestamp/token-stream protocol and no `ok/value` envelope at the speech server. Non-2xx fails the request; the adapters report the status rather than consuming a provider-specific error body. A complete final response is required.

An optional nonblank recognition context is forwarded as `prompt`: at most 1,000 UTF-16 code units, no NUL, trimmed. It is a vocabulary/background hint, **not** a language allow-list or agent instruction. No automatic retry removes it. Accept the field even if your model does not use it, or return a clear failure; matching transport does not promise model support for hints.

## Whisper-compatible multipart

### Address, health and limits

Default full inference URL: `http://127.0.0.1:8080/inference` (host default override: `DSH_LIVE_VOICE_WHISPER_URL`). The full URL and health URL/path are configurable in Whisper connection settings. The health path defaults to `/health` and is resolved relative to the full inference URL, **not appended** to it.

Both inference and resolved health URLs must be unauthenticated **loopback HTTP**: `localhost`, `127.0.0.1` or IPv6 `::1`; no HTTPS, credentials, fragment, remote host or redirect. No API key is sent. The GET health check accepts any successful HTTP status; its body is not parsed. For example, `200` with `{ "status": "ok" }` (or `204` with no body) suffices.

Maximum input WAV size is **2,000,000 bytes**, including the header. Default per-request timeout is 30,000 ms; configurable range 100–300,000 ms. A non-2xx health status produces unsupported capability.

### Request

`POST` the configured full URL with `multipart/form-data` (the HTTP client generates the boundary):

| Part | Value |
| --- | --- |
| `file` | Binary WAV; filename `utterance.wav`, media type `audio/wav` |
| `response_format` | `json` |
| `language` | `pt` for configured values starting with lowercase `pt`; `en` for lowercase `en`; otherwise literal `auto` |
| `prompt` | Optional context; omitted when empty |

No `model`, `task`, timestamps or temperature field is sent. The server chooses its underlying model. A server that requires an OpenAI-style `model` part without a default needs a wrapper to accept this contract.

Example against the default **speech server** endpoint:

~~~sh
curl --fail-with-body http://127.0.0.1:8080/inference \
  -F 'file=@utterance.wav;type=audio/wav' \
  -F 'response_format=json' \
  -F 'language=auto' \
  -F 'prompt=Technical conversation about Git and TypeScript.'
~~~

Expected response: `{ "text": "Recognized speech goes here." }`. Omit the prompt part to match an empty context setting. The example file must meet the WAV requirements above.

## Qwen-compatible recognition

### Address, health and readiness

Default base URL: `http://127.0.0.1:8080/` (host default override: `DSH_LIVE_VOICE_QWEN_URL`). Qwen connection settings configure the base URL and timeout, shared with Qwen TTS. HTTP and HTTPS are allowed; redirects are rejected. No configurable Authorization/API-key header is supplied. Routes `health`, `v1/models/status` and `v1/audio/transcriptions` are resolved against the normalized trailing-slash base, preserving its path prefix.

**Every transcription first GETs `health` to choose its input encoding.** A generic server should return successful JSON without `service: "ominix-api"`, for example:

~~~json
{ "models": { "asr": true, "tts": false } }
~~~

The operation-specific ASR capability requires `models.asr === true`. The shared connection test requires both ASR and TTS; do not claim TTS readiness for a recognition-only server. Actual inference selects the wire format from the health `service` field; it does not itself enforce these readiness flags.

If health returns `{ "service": "ominix-api" }`, capability discovery also calls `GET v1/models/status` and requires `models.asr === "qwen3-asr"` for recognition:

~~~json
{ "models": { "asr": "qwen3-asr", "qwen3_tts": "customvoice" } }
~~~

The TTS field is only needed for TTS/shared readiness. Do not identify a server as `ominix-api` unless it also accepts the JSON/base64 format below and provides the status contract. A non-2xx health body is not parsed and therefore selects the generic multipart fallback during inference (capability still reports unsupported); return a truthful 2xx health JSON rather than relying on failure behavior.

Maximum input WAV size: **50,000,000 bytes**. Default timeout: 300,000 ms; configurable range 1,000–600,000 ms. Health and inference each use the configured request deadline. The limit refers to binary WAV, not its larger base64 JSON representation.

### Generic server request: multipart

`POST v1/audio/transcriptions` with `multipart/form-data`:

| Part | Value |
| --- | --- |
| `file` | Binary WAV; filename `utterance.wav`, media type `audio/wav` |
| `response_format` | `json` |
| `language` | Omitted for `auto`; otherwise mapping below |
| `prompt` | Optional nonblank recognition context |

Language mapping: case-insensitive `pt*` → `portuguese`, `en*` → `english`; other supplied values pass through. No STT `model` field is sent. This differs from Whisper's `pt/en/auto` values.

~~~sh
curl --fail-with-body http://127.0.0.1:8080/v1/audio/transcriptions \
  -F 'file=@utterance.wav;type=audio/wav' \
  -F 'response_format=json' \
  -F 'language=portuguese'
~~~

For automatic detection omit `language` altogether. Add a `prompt` form part only when using context.

### OminiX server request: JSON/base64

Same `POST v1/audio/transcriptions`, but with `Content-Type: application/json`:

~~~json
{
  "file": "<base64 of the complete WAV bytes>",
  "language": "portuguese",
  "response_format": "json",
  "prompt": "Technical conversation about Git and TypeScript."
}
~~~

`file` is plain base64, **not** a data URL, path, multipart field or public URL. The language mapping and optional prompt match the generic Qwen request. `language` is absent for `auto`; `prompt` is absent when empty. Both formats return the same top-level `{ "text": "…" }` JSON result.

### Recognition quality limitation

On the tested local OminiX deployment, automatic language detection sometimes returned only the beginning of an otherwise complete WAV. Explicit Portuguese plus an archive retry returned more text in paired tests, but can also misrecognize English technical terms. This is **not** a fixed issue, a universal Qwen behavior, or proof of VAD truncation. Protocol compatibility does not guarantee complete/accurate recognition; preserve server diagnostics and validate representative mixed-language audio without logging private content by default.

## Browser → DSH bridge (not the server you implement)

The browser uses DSH's authenticated same-origin connection; your speech server does **not** implement these paths.

### Transcription request/response

`POST /api/dsh-live-voice/whisper/transcribe` or `POST /api/dsh-live-voice/qwen/transcribe`:

~~~http
Content-Type: audio/wav
x-dlv-client-id: example-client-1
x-dlv-operation-id: example-operation-1
x-dlv-language: pt-BR
x-dlv-transcription-context: Technical%20conversation%20about%20Git.

<binary complete mono 16 kHz PCM16 WAV>
~~~

Client/operation IDs must each match `[a-zA-Z0-9_-]{1,128}`. The optional context header is `encodeURIComponent` text; malformed/oversized encoding is rejected (decoded limit 1,000 UTF-16 code units, encoded limit 9,000 characters). Context never replaces the WAV body. Missing language defaults to `auto` on the Whisper route and `pt-BR` on Qwen; the normal client explicitly sends its recognition-language setting. These `x-dlv-*` headers are bridge metadata, **not forwarded** as server authentication.

Success:

~~~json
{ "ok": true, "value": { "text": "Recognized speech goes here." } }
~~~

Failure:

~~~json
{ "ok": false, "error": { "code": "transcription-failed", "message": "Provider failure details", "details": {} } }
~~~

Routes return 400 for invalid IDs/content type/context; 413 for a Content-Length above the adapter limit; 499/`cancelled` for AbortError; 502/`transcription-failed` for upstream, WAV validation or other transcription failures. WAV size/shape is validated again after buffering, so an invalid/oversized body without a trustworthy Content-Length may fail with 502 rather than 413. Authentication failures belong to DSH and may occur before these handlers. Request.signal cancellation is propagated; it is not a guarantee the provider stopped all computation.

### Configuration and capability routes

| Method/path | Request body | Successful `value` |
| --- | --- | --- |
| `GET /api/dsh-live-voice/whisper/config` | None | Current `url`, `healthUrl`, `timeoutMs` |
| `PUT /api/dsh-live-voice/whisper/config` | Full JSON config below | Saved config |
| `POST /api/dsh-live-voice/whisper/test` | Full JSON candidate config | Capability for candidate, without saving or transcribing |
| `GET /api/dsh-live-voice/whisper/capabilities` | None | Capability for saved config |
| `GET /api/dsh-live-voice/qwen/config` | None | Current `baseUrl`, `timeoutMs` |
| `PUT /api/dsh-live-voice/qwen/config` | Full JSON config below | Saved config |
| `POST /api/dsh-live-voice/qwen/test` | Full JSON candidate config | Shared ASR+TTS capability, without saving or inference |
| `GET /api/dsh-live-voice/qwen/capabilities?kind=asr` | None | ASR-only capability; `tts` checks speech; missing/other kind checks both |

Whisper config example:

~~~json
{ "url": "http://127.0.0.1:8080/inference", "healthUrl": "/health", "timeoutMs": 30000 }
~~~

Qwen config example:

~~~json
{ "baseUrl": "http://127.0.0.1:8080/", "timeoutMs": 300000 }
~~~

JSON successes use `{ "ok": true, "value": ... }`. Example Whisper capability value: `{ "supported": true, "local": true, "streaming": false, "maxBytes": 2000000 }`. Qwen adds `location: "host"` and model readiness on success. Unavailable capabilities can still return HTTP 200/`ok: true` with `{ "supported": false, "reason": "…" }`: inspect `supported`, not just HTTP status. Invalid config returns 400/`invalid-config`; load/save failures return 500/`config-failed`. A saved configuration replacement aborts the previous adapter's active requests. Saving generic Live Voice preferences alone is not a provider-config update.

## Implementation references

- [Whisper host and WAV validation](../packages/live-voice/src/modules/recognition/engines/whisper/whisperRecognitionHost.ts)
- [Qwen host](../packages/live-voice/src/modules/core/qwen/QwenHttpHost.ts)
- [DSH routes](../packages/live-voice/src/app/server/apply.ts), [context encoding](../packages/live-voice/src/modules/recognition/transcriptionContext.ts) and [archive retry transport](../packages/live-voice/src/modules/recognition/recordingTranscriber.ts)
