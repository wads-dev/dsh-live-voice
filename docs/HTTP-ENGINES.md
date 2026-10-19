# Compatible HTTP speech servers

Connect an existing speech server, or implement a small adapter, using the actual request/response contracts Live Voice sends. Compatibility is **per adapter and operation**, not per model name: a server need not run Whisper or Qwen internally, but it must accept the selected adapter's routes, fields, audio format and readiness checks.

- [Text-to-speech (TTS)](HTTP-TTS.md): Qwen speech requests and the Chatterbox voice/job/audio protocol.
- [Speech-to-text (STT)](HTTP-STT.md): Whisper multipart, Qwen multipart and OminiX JSON/base64 transcription.

## Which side do you implement?
~~~text
browser capture/player → authenticated DSH bridge → speech server
~~~

The speech server runs on, or is reachable **from the DSH host**, not necessarily from the browser. A phone browser never calls its own loopback for these engines. The two layers have different payloads:

| Layer | Routes | Success response |
| --- | --- | --- |
| Your speech server | For example `POST /inference`, `POST /v1/audio/speech` or `POST /v1/jobs` | Provider JSON or binary WAV, as specified in the linked contracts |
| DSH's existing bridge | `/api/dsh-live-voice/whisper/*`, `/api/dsh-live-voice/qwen/*`, `/api/dsh-live-voice/chatterbox/*` | JSON `{ "ok": true, "value": ... }` or binary AAC/M4A for speech |

**Do not wrap your server's transcription result in the DSH envelope.** The server returns `{ "text": "recognized words" }`; the bridge adds `ok/value`. Do not implement DSH browser authentication or settings endpoints in a speech server.

## Adapter selection and constraints

| Adapter | Configure | Contract |
| --- | --- | --- |
| Whisper HTTP recognition | Speech recognition → Whisper connection settings: full inference URL, health URL/path, timeout | Configurable inference path, multipart WAV; unauthenticated loopback HTTP only |
| Qwen HTTP recognition / speech | Qwen connection settings: base URL and timeout (shared by STT and TTS) | Fixed relative `health` and `v1/…` paths; HTTP/HTTPS; readiness reports ASR and/or TTS |
| Chatterbox speech | Start a compatible service at `http://127.0.0.1:7865`; select Speech → Chatterbox and a reference voice | Fixed origin and job protocol, no arbitrary URL/model/path selection; current adapter restricts language to Portuguese |

Whisper and Qwen configuration is host-persisted; saving it does not start capture or synthesis. Qwen does not add an API-key/Authorization header, and Whisper explicitly rejects authenticated URLs. Chatterbox's fixed client header is **not authentication** against other local processes. Keep local services private; if a different network or authenticated provider is required, use a properly secured host-side adapter rather than exposing these endpoints publicly. Redirects are rejected.

## Common implementation checklist

1. Implement the matching health/readiness and optional catalog endpoints, not just inference.
2. Accept the exact content type and field names below. Extra OpenAI-style requirements such as a mandatory STT `model` field are **not** supplied by these adapters.
3. Return a successful HTTP status only for a usable final result; return non-2xx on failure. STT reads only top-level `text`; it does not consume segments, SSE or partial tokens.
4. TTS must return a complete, decodable PCM WAV. The bridge currently converts it using macOS `/usr/bin/afconvert` and sends AAC/M4A to the browser. A compatible server alone does not remove that host-platform requirement.
5. Handle request cancellation and bound inference/queue work. Client abort prevents stale playback/delivery but does not prove immediate server/GPU preemption.
6. Validate with a known short WAV/text, then explicit Settings tests and real capture/playback. Matching a protocol does not guarantee recognition quality, model languages, device routing or latency.

These contracts cover the HTTP speech-engine adapters, not Attendee meeting transport, browser-native/WebGPU/WASM inference, model downloads or general DSH settings/RPC APIs. [Chatterbox deployment notes](CHATTERBOX.md) describe the separately installed local experiment; no model weights, reference recordings or third-party server are bundled by these guides.
