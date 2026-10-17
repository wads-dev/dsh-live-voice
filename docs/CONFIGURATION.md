# Configuring DSH Live Voice & Conversation Flow

DSH Live Voice integrates directly into DeepSeek Harness settings under **DSH Settings → Live Voice**.

This guide covers all conversation modes, acoustic settings, silence thresholds, audio device routing, voice commands, and external engine configurations.

## Server-side preferences

All Live Voice preferences are loaded and saved on the DSH host, including engines, languages, devices, conversation mode, delays, silence detection, filters, voice commands, and editable spoken-context text. They are shared by browsers connecting to the same host and survive server restarts. The authenticated `GET`/`PUT` route at `/api/dsh-live-voice/settings` stores a generic JSON object in `~/.dsh/dsh-live-voice.settings.json`, using serialized, atomic writes with owner-only permissions (`0600`). Qwen and Whisper connection configurations remain in their existing host-side stores.

The browser supplies defaults and normalizes the fields it understands while retaining unknown fields. New engine defaults use the authenticated server’s `hostPlatform` metadata, not the browser’s operating system; saved valid choices are preserved. The server does not maintain a settings-field allowlist or normalize individual fields. A save merges supplied top-level keys with existing preferences; a nested object or array replaces that entire top-level value rather than being merged recursively. This lets future frontend settings fields continue to save without corresponding backend field changes.

Storage safety checks require a JSON object, a maximum JSON size of 64,000 bytes and nesting depth of 16, and reject dangerous prototype keys (`__proto__`, `constructor`, and `prototype`) at any depth. This is plugin-scoped preference storage only: settings cannot select arbitrary files or paths, modify DSH configuration, or edit YAML.

Legacy browser preferences are not imported or used. Without a server preferences file, the server returns an empty object and the browser applies defaults; configure them once again. No settings are written to browser storage, and release-check metadata is cached only in memory. A failed server load or save is reported instead of falling back to browser persistence. Reload after a load failure to retry. Device IDs are shared too, but a selected device must still exist and be usable on the current browser; microphone permission and browser language-pack installation remain browser-managed capabilities, not plugin preferences.

The running backend must first receive this generic storage implementation once. Install the updated plugin and, if the DSH plugin manager requires a restart, restart DSH before refreshing the browser. A frontend refresh cannot retrofit an older server that still filters or normalizes settings fields. Once the generic implementation is running, adding frontend-only settings fields does not require backend field changes or a restart just to persist them. New routes, providers, or other backend runtime features still require their updated backend code to be loaded.

While microphone or meeting transcription is acquiring, listening, or awaiting transcription results, Live Voice requests the browser’s native confirmation before closing, reloading (F5), or leaving the page. Cancelling leaves transcription running. The browser controls the message and requires prior user interaction; mobile app termination or forced closes may bypass it. No warning is requested for playback alone or idle voice mode. Preference persistence does not restore active microphone capture, meeting sharing, voice sessions, pending delivery, or playback after a page refresh (F5). Saved recordings have a separate recovery mechanism; saving settings is not recovery of live voice or session state.

---

## Browser-local models

**Whisper · Browser** and **Qwen · Browser** replace HTTP connection controls with model management. Confirm a download, monitor byte progress, cancel or retry, and load or remove the cached model. Preferences are host-shared, but models and runtime capabilities belong to the browser device/profile. Whisper supports explicitly selected WebGPU or WASM; Qwen requires WebGPU. No HTTP fallback or hidden model download occurs. See [Browser ASR](BROWSER-ASR.md) for model sizes, privacy, storage and compatibility. The new versioned runtime-asset routes require the updated backend to be loaded; generic preferences alone cannot provide those assets.

## Append-only dictation

Live Voice appends final recognized chunks to the end of the current message draft. Manual edits and existing composer text are preserved; caret position does not move dictation into an earlier part of the draft. Provisional recognition results no longer appear inside the composer or replace earlier text. A final chunk becomes visible when recognition completes. Cancelling or muting recognition leaves committed text intact. Only an explicit Clear command or normal message submission may intentionally clear the composer.

## 1. Acoustic Modes & Turn-Taking

How listening and speaking coordinate depends on whether you use speakers or headphones:

### Speakers — Gated Listening (Default)

When using speakers, microphone input is automatically gated while the assistant is speaking so the assistant never hears its own voice or transcribes its own output.

```mermaid
sequenceDiagram
    participant Interface
    actor You as User
    actor Assistant

    Note over Interface,Assistant: Waiting for you to speak…
    activate You
    You->>Assistant: Starts speaking
    Assistant-->>You: Listens to speech
    Note over Interface,Assistant: You pause / stop speaking
    opt Manual Send
        You->>Interface: Review transcribed draft
        Interface-->>You: Send when ready
    end
    opt Automatic Send
        Note over You,Assistant: Sends after silence countdown
    end
    deactivate You
    You->>Assistant: Message delivered
    Assistant-->>You: Response ready — waits for stable silence
    Assistant-->>You: Pauses listening
    activate Assistant
    Assistant->>You: Speaks response aloud
    deactivate Assistant
    Note over Interface,Assistant: Listening resumed — ready for next turn
```

- **Interrupting on speakers:** Click **Take microphone** or use the push-to-talk shortcut to take your turn immediately and pause the assistant.

### Headphones — Open Microphone

With headphones, the microphone remains open during playback:

- **Debounced interruption:** Recognized non-echo speech confirms an interruption; sustained activity pauses playback after the configured Assistant Response Delay. Noise alone does not confirm it. Shared meeting participants can also interrupt in Speakers mode.
- **Automatic recovery:** After the microphone and shared meeting audio remain silent for that delay, automatically paused audio resumes at its retained position. Renewed speech resets the countdown.
- **Manual control:** Manual Pause waits for Resume. Stop cancels playback and its queue; it does not end voice input.
- **Mirrored input bars:** Microphone and shared meeting audio use the same Listening / Ignoring, exact-command, timestamp, delivery-mode, countdown, and cancellation controls. Each source owns its Ignore state and bar preferences; shared controls do not mute the microphone or change its delivery/command choice. New shared capture starts Listening, independently of microphone Ignore.
- **Ignoring:** Discards that source’s dictation and pending question answers, but keeps capture and speech interruption active, even with voice commands disabled. Enabled configured commands still work. It is not hardware mute: stop capture using the source button in the composer (or an enabled End command). Review configured phrases before enabling commands for participant audio.
- **Shared delivery:** Accepted finals from either source can arm automatic Queue / Steer delivery. Both sources must be idle with no pending transcription before the countdown runs; a silent or discarded result from the other source does not lose the accepted final’s intent. A newer accepted final supersedes the other source’s deadline; edits, explicit cancel, Stop, submit, navigation, and disposal invalidate it. Assistant playback stays shared, not duplicated per input.

---

## 2. Conversation Settings

| Setting                                                    | Default     | Description                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sending Mode**                                           | `Manual`    | `Manual` (review before sending), `Automatic` (sends after silence countdown), or `Steer` (send directly to running agent).                                                                                                                                                      |
| **What does Enter do in your DSH when the agent is busy?** | `Queue`     | Report your existing DSH behavior (`Steer` or `Queue`). This changes only how Live Voice chooses normal submission versus Ctrl+Enter; it does not change DSH settings. Update this answer whenever you change that behavior in DSH. Queue preserves the previous plugin mapping. |
| **Auto-Send Delay**                                        | `4 seconds` | Silence countdown before automatically submitting your draft (configurable from 2 to 10 seconds).                                                                                                                                                                                |
| **Assistant Response Delay**                               | `1.5 seconds` | Continuous silence required after you stop speaking before automatic playback. Options: 600 ms, 1.5, 2, 3, 4 or 5 seconds. No zero-delay option; unsupported older values use the new default.                                                                                                                                                                        |
| **Automatic Assistant Speech**                             | `Enabled`   | Automatically reads new assistant responses aloud as they stream in.                                                                                                                                                                                                             |
| **Stop Speech on Send**                                    | `Disabled`  | Immediately stops current assistant playback whenever you submit a new message.                                                                                                                                                                                                  |
| **Hold-to-Talk (Push-to-Talk)**                            | `Enabled`   | Hold `Control` anywhere on the page to speak; release to transcribe and auto-send, or press `Escape` to cancel.                                                                                                                                                                  |
| **Hands-Free Structured Questions**                        | Automatic   | Narrates DSH structured questions, captures your spoken response, and submits it as a custom answer.                                                                                                                                                                             |

---

## 3. Speech Recognition (Input)

Configure your microphone and speech-to-text (STT) engine:

- **Recognition Engine:**
  - **Browser SpeechRecognition:** Uses the browser/system dictation engine.
  - **Qwen3 ASR — HTTP API:** Connects to a host-local Qwen3 model server.
  - **Whisper — HTTP API:** Connects to a host-local whisper.cpp server.
- **Input Device:** Explicitly select a microphone (USB mic, headset, or built-in).
- **Recognition Language:** Choose **Português (Brasil)**, **English (United States)**, or **Automatic — detect language** (available on Qwen3 and Whisper).
- **Local Processing:**
  - _Process recognition locally on this device:_ Ensures speech is not sent to external browser vendor cloud servers.
  - _Automatically install language pack:_ Allows the browser to download offline language packs on demand.
- **Silence and Paragraph Detection (VAD) Profiles:**
  - _Short (default):_ Transcribe after 400 ms; start a new paragraph after 2,000 ms.
  - _Natural:_ Transcribe after 1,000 ms; start a new paragraph after 3,000 ms.
  - _Long:_ Transcribe after 2,000 ms; start a new paragraph after 4,000 ms.
  - _Custom:_ Set two whole-millisecond values: 100–10,000 ms for transcription chunks and 100–30,000 ms for paragraphs. Each field saves on blur and survives switching profiles; invalid edits restore its saved value.
  - These profiles apply to Qwen and Whisper plugin-managed capture, not Browser SpeechRecognition. Chunk completion joins text with a space, not a newline. A paragraph inserts two newlines before the next recognized speech; enabled timestamps repeat only at the first block, a paragraph, or a source change. Silence is measured on the captured sample clock, independently of transcription backlog. The chunk pause is not total recognition latency or the separate automatic message-send countdown.
- **Maximum Utterance Limit:** Split continuous speech after 10 to 300 seconds (default: 60s) to keep transcription chunks manageable.

---

## 4. Speech Output (Speaking)

Configure how assistant messages are read aloud:

Engine selection never depends on provider health: all recognition and speaking options remain selectable so their configuration can be edited before a service is running. Loading/saving configuration uses the authenticated DSH preferences transport, but does not test the engine service. Use the explicit connection test or start recognition/playback for operational validation.

New host preferences default to macOS Say on a macOS DSH host and Browser speech elsewhere; saved choices are preserved. Speaking order is Say / Browser / Qwen on macOS and Browser / Qwen / Say elsewhere. Recognition order is Browser / Qwen / Whisper; Say does not recognize speech. Platform determines presentation/defaults, not engine availability.

- **Speech Engine:**
  - **Browser speech:** Plays audio through the browser device using local system voices.
  - **macOS `say`:** Host-local synthesis to temporary WAV, converted to compact AAC/M4A for browser playback; temporary files are removed after conversion.
  - **Qwen3 TTS:** Host-backed neural voice synthesis converted to compact AAC/M4A for browser playback.
- **Segment preparation and gap:** Say and Qwen share a bounded prefetch window of three future audio segments. Browser uses the same prepared-item lifecycle for local utterances, but Web Speech does not expose pre-synthesized audio or promise gapless playback. The configured segment gap (400 ms by default, zero allowed) still applies; native voice/browser latency may add to it. Pause during preparation prevents late audio from starting.
- **Output Device:** Route playback to specific speakers or headphones.
- **Speech Volume:** The slider in **Speech → Engine** saves playback volume from 0% (silent) to 100% (default). It affects Browser speech and browser playback of Say/Qwen audio, not microphone sensitivity or system volume. Say synthesizes an inaudible file on the host; volume is applied when that audio plays in your browser. Host-audio volume changes apply to active or paused playback; Browser speech changes apply from the next segment because native utterances cannot reliably change volume mid-speech. Prepared and replayed segments use the current volume without resynthesizing audio.
- **Speech Rate:** Adjust reading speed from 0.1x to 3.0x (1.0 is normal).
- **Code Block Filtering:**
  - Automatically filter out lengthy Markdown code blocks so the assistant doesn't recite syntax line by line.
  - Read code blocks up to a configured line count (e.g. 5 lines).
  - Replace larger code blocks with a custom spoken notice (e.g. _"Look at the code in our conversation"_).

---

## 5. Spoken Voice Commands

When voice commands are enabled, you can speak exact trigger phrases to control the conversation hands-free:

| Action                                                 | Default Trigger Phrases                    |
| ------------------------------------------------------ | ------------------------------------------ |
| **Send Message**                                       | `send`, `send message`                     |
| **Queue Message**                                      | `queue`, `queue message`                   |
| **End Conversation**                                   | `end`, `end conversation`                  |
| **Ignore Microphone Dictation (capture stays active)** | `mute`, `stop listening`                   |
| **Resume Microphone**                                  | `resume`, `start listening`                |
| **Stop Speech**                                        | `stop talking`, `stop speaking`, `shut up` |
| **Clear Input**                                        | `clear all`, `clear message`               |

_Phrases are configurable in Settings → Live Voice → Commands, supporting comma-separated alternatives._

---

## 6. External Host Engine Setup

### Optional transcription context

For **Whisper HTTP** and **Qwen HTTP**, Speech recognition → **Connection settings** includes a shared **Transcription context** field. It is empty by default and saves on blur (up to 1,000 characters). The English placeholder is an example, not a default or automatically submitted text:

> Native Brazilian Portuguese speaker who frequently uses technical terms in English.

Enter relevant background, names, or vocabulary. The text is sent with every new audio segment from the microphone or shared audio to the selected HTTP speech service. It is not agent conversation context and does not include chat history. Leave it empty to omit it entirely. Changing microphone settings replaces recognition; an already-running shared capture keeps its start-time settings until restarted.

The plugin’s authenticated WAV routes transport Unicode/multiline context in a bounded, percent-encoded `x-dlv-transcription-context` header. The host validates it and forwards it as the standard optional `prompt` multipart field, or `prompt` in OminiX JSON/base64 requests. A server that rejects or ignores that optional field will not gain context support from the plugin alone; errors are not retried without context. Context can bias recognition, but does not enforce a language allow-list, guarantee instruction following, or prevent translation. Native Browser and browser-local model engines do not use this HTTP setting.


### Qwen3 HTTP Service

When using Qwen3 ASR or TTS:

- Runs as an external local process (e.g. via Apple MLX, OminiX-API, or Python).
- Configured via base URL (default: `http://127.0.0.1:8080/`).
- Exposes standard OpenAI-compatible endpoints:
  - `GET /health`
  - `POST /v1/audio/transcriptions`
  - `POST /v1/audio/speech`
- Credentials and host settings are stored with owner-only permissions in `~/.dsh/dsh-live-voice-qwen.json`.

### Whisper HTTP Service

When using Whisper:

- Connects to `whisper.cpp` server or compatible loopback HTTP daemon.
- Configured via inference endpoint URL (default: `http://127.0.0.1:8080/inference`).
- Audio is validated as bounded 16 kHz mono PCM16 WAV and passed strictly through authenticated same-origin DSH routes.
- Configuration is stored with owner-only permissions in `~/.dsh/dsh-live-voice-whisper.json`.

---

## 7. Privacy & Local Architecture

- **No Remote Telemetry:** Transcripts and raw microphone audio are never logged or phoned home.
- **Strict Loopback:** External engine bridges only accept unauthenticated loopback addresses (`127.0.0.1`, `::1`, `localhost`), preventing external network leakage.
- **Browser vs. Host:** Speech processing runs on your own hardware. Keep in mind that the DeepSeek Harness language model itself may be remote depending on your DSH setup.
