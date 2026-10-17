# DSH Live Voice

Local-first speech-to-text (STT), text-to-speech (TTS), and meeting audio transcription plugin for DeepSeek Harness (DSH). Local speech processing does not make DSH or its AI provider fully offline.

## Installation

Tested with **DeepSeek Harness v0.2.1-rc.2**. The package manifest's `dshTestedVersion` field records the tested version.

Install the prebuilt package from npm; no source build is required. The Git repository contains source only.

```sh
npx dsh plugin add --profile web dsh-live-voice
```

Restart DSH, then open **DSH Settings → Live Voice** to configure recognition and speech engines.

## Requirements and configuration

- Microphone capture requires browser support, permission, and a secure context (HTTPS or localhost).
- Recognition and synthesis engines have separate language, platform, and model requirements. See the engine guide before selecting a setup.
- Meeting transcription uses **Qwen HTTP** or **Whisper HTTP** recognition. Shared-audio availability depends on the browser, system, and sharing surface; obtain appropriate participant consent.
- Capturing meeting audio and sharing assistant playback require separate setup. This is not a native Google Meet or Teams integration.
- The optional `dsh-live-voice-debugger` package is not required by the main plugin.

## Documentation

- [Project overview](https://github.com/victorwads/dsh-live-voice#readme) — canonical presentation, screenshots, and use cases.
- [Configuration and conversation flow](https://github.com/victorwads/dsh-live-voice/blob/main/docs/CONFIGURATION.md)
- [Speech recognition engine selection](https://github.com/victorwads/dsh-live-voice/blob/main/docs/CHOOSING-AN-ENGINE.md)
- [Architecture](https://github.com/victorwads/dsh-live-voice/blob/main/docs/ARCHITECTURE.md)
- [Release notes](https://github.com/victorwads/dsh-live-voice/blob/main/CHANGELOG.md)
- [Issue tracker](https://github.com/victorwads/dsh-live-voice/issues)

## License

[Apache-2.0](https://github.com/victorwads/dsh-live-voice/blob/main/LICENSE)
