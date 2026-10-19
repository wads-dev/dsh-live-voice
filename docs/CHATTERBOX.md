# Chatterbox reference voices

Use a voice recording as the reference for spoken assistant answers, while keeping the existing Live Voice playback, pause/resume, volume, segment preparation and client output routing. This is optional and does not change the default engine or imply that DSH's language model is offline.

## Select a voice

1. Start the separately installed Chatterbox MLX service on the DSH host at **127.0.0.1:7865**.
2. Open **Settings → Live Voice → Speech**, choose **Chatterbox**, and select a **Voice reference**.
3. Use **Refresh voices** after adding recordings to the service's voice directory. Only use voices you have authorization to reproduce.
4. Set the speech language to **pt-BR** and test the selected output. This deployment uses the Brazilian Portuguese fine-tune. Playback speed is the existing browser-player setting, not a new model pace control.

Voice IDs are persisted in the existing voice preference. Entering Chatterbox clears the previous provider's voice ID. Leaving it selects Qwen's default, a discovered Browser default (or empty), or Say's system default rather than forwarding an incompatible reference ID. Missing saved references stay visibly unrecognized until the user chooses another reference; catalog discovery never silently overwrites a preference.

## Host requirements

The current host-audio converter invokes `/usr/bin/afconvert`: this path requires macOS as well as a reachable compatible service. Merely selecting the engine on another OS does not prove synthesis/playback support. Models, runtimes and authorized references must be installed separately.

## Local service contract

The plugin is a thin client; Python, models, personal recordings and launchd configuration are **not bundled in the npm package**. The initial service implementation lives in this checkout's ignored local experiment directory and must remain installed for this host. It is not a portable one-command public installer.

The plugin uses these fixed loopback endpoints (no user-supplied URL or arbitrary file paths):

| Endpoint | Purpose |
| --- | --- |
| GET /v1/health | Phase/model; streaming=false |
| GET /v1/voices | voices array with 24-character lowercase-hex id and display name |
| POST /v1/jobs | JSON text and optional voice; returns 32-character lowercase-hex job id |
| GET /v1/jobs/:id | queued/generating/watermarking/done/error/cancelled |
| GET /v1/audio/:id | Complete PCM WAV |
| DELETE /v1/jobs/:id | Cancel/discard and release transient result |

Mutations require the X-Chatterbox-Client: dsh header; the service rejects browser Origin/Sec-Fetch requests to these host-only endpoints. This is a trusted single-user loopback boundary, **not authentication against other local processes**. Do not expose it through a public proxy. The separate lab UI retains its own origin/token protection.

DSH exposes authenticated same-origin routes under /api/dsh-live-voice/chatterbox for voices, capabilities and speech. The browser never calls loopback on the client device. Host WAV is converted with the existing host AAC/M4A transcoder and played by HostAudioSpeakingEngine; page-level speech ownership, preparation, cancellation and output routing remain unchanged.

## Concurrency, cancellation and latency

The local service accepts at most eight active/queued jobs with **one MLX worker**; it does not run simultaneous inference against shared model state. Queue overflow fails visibly rather than growing unbounded. A job may be split into bounded text pieces (up to 280 characters), then combined into a complete file. Current request limit: 12,000 text characters; bridge deadline: five minutes.

Cancellation removes queued work or discards an active result at safe boundaries. It does **not** forcibly interrupt a token/decoder GPU call or its bounded watermark subprocess. A cancelled item can briefly retain the worker while that call returns; the client never starts stale audio. A browser disconnect triggers cancellation through the DSH Request.signal, and bridge disposal aborts pending jobs.

No incremental audio streaming is implemented. Existing Live Voice segmentation/prefetch can prepare the next segment while the current segment plays, but that must not be described as streaming inside a single utterance. Synthesis, preparation and playback remain distinct states.

API audio is transient and deleted after bridge consumption/cancellation. Abandoned completed results are removed on later API access after ten minutes, and on metadata eviction; explicit lab results stay on disk. No raw text/audio is logged by the bridge. Reference recordings and conditioning stay local to the host. PerTh watermarking and peak-safe PCM encoding are retained by this deployment.

## This Mac's launchd installation

Label: **dev.wads.chatterbox**, installed per user under ~/Library/LaunchAgents. RunAtLoad and KeepAlive start it at login and restart failures. It points at this checkout's existing serve.sh and isolated environment; moving/deleting the checkout, cached models or reference dependencies breaks the service. A mounted external volume must be available. It keeps several GB of model memory allocated while idle.

Inspect:

    launchctl print gui/$(id -u)/dev.wads.chatterbox
    curl http://127.0.0.1:7865/v1/health

Stop (prevents KeepAlive from restarting it in the current login):

    launchctl bootout gui/$(id -u)/dev.wads.chatterbox

Start after bootout:

    launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/dev.wads.chatterbox.plist"

The launch definition is host-specific, not committed. Full local model provenance/conversion instructions remain beside the experiment. Chatterbox source and the selected PT-BR model card declare MIT; MLX Audio is separately licensed upstream. Review the actual model cards/dependencies before redistribution; this change does not distribute weights or personal voices. MLX/Metal requires a compatible Apple Silicon runtime; the UI does not infer support merely from the OS.

## Verification boundaries

Unit/DOM tests cover the adapter, voice selection, fixed endpoint validation, cancellation during admission, route cleanup and existing speech ownership/player behavior. A healthy loopback service alone does not prove authenticated DSH delivery or audible browser playback. Validate those separately on the deployment; physical microphone capture and remote-client audio-device routing are separate checks.
