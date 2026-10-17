# Changelog

All notable changes to DSH Live Voice are documented here. This English changelog is the canonical release history. New features, improvements, and fixes are distinguished according to what each release actually changes.

[Product overview](README.md) · [Visão geral em português](README.pt.md) · [简体中文概览](README.zh-CN.md)

## [0.6.2] - 2026-10-17

### Features

#### Live Voice

- Add optional transcription context in Connection settings for Whisper HTTP and Qwen HTTP. The shared field starts empty, with an English example placeholder, and forwards background or vocabulary as `prompt` with each audio segment. Server support varies; context is not a language restriction.

#### Live Voice Debugger

- Name starred recordings in the debugger so important problem sessions can be recognized later; names remain in the saved session and self-contained JSON export.
- Inspect assistant playback start, end, pause and resume alongside microphone speaker-gating requests and recording start/end events. Saved events retain wall-clock timestamps and captured-audio boundaries without recording assistant audio or inventing audio during capture gaps.
- Zoom the speech/silence timeline with a single two-handle range selector: drag either edge to resize, or drag the selected band to move the whole window without changing its duration. Support keyboard navigation and restore the full session with a compact, accessible icon button.
- Search segment transcripts with exact phrases and matching words ranked before approximate matches; an active search excludes segments without completed transcription.
- Show total stored audio and per-session audio size in decimal MB, measured from encoded audio payload rather than browser-wide quota or estimated PCM size. Database overhead and unsaved capture buffers are excluded.

### Improvements

#### Live Voice

- Use a 1.5-second default assistant response delay, with options of 600 ms, 1.5, 2, 3, 4 or 5 seconds. Remove zero-delay playback; unsupported older preferences normalize to the new default while supported saved values remain unchanged.
- Include at least 800 ms of recorded context before and after each transcription range, including maximum-length splits. Wait for the real post-roll while capture is active, clamp to available audio on finish, and preserve VAD/paragraph boundaries; overlapping words may repeat rather than being dropped. The safety floor is a code constant, not a new setting.
- Automatically retry failed Silero initialization or live detection up to twice, without switching to energy detection. Successful inference restores the retry budget for later failures in long sessions; stopping or replacing capture cancels recovery. Persistent failures still report an actionable error.

## [0.6.1] - 2026-10-15

### Fixes

- Keep automatic sending from stalling when continuous silent audio is saved: background recording writes no longer reset the countdown, while unfinished speech and capture finalization still block premature delivery.
- Avoid unused ONNX/protobuf install-script approvals that blocked updates: browser speech and VAD libraries are bundled with their runtime assets rather than installed as runtime dependencies in DSH profiles.
- Explain update installation blockers for build-script approval, unavailable npm versions or release-age delays, and incompatible DSH versions without bypassing security policies.

### Developer notes

- Debugger translations now use typed per-module, per-locale catalogs and the Wads React translation runtime. Use the debugger’s `i18n.config.json` and `src/i18n` contracts when adding copy; the former monolithic catalog has been removed.

## [0.6.0] - 2026-10-15

### Features

#### Live Voice

- ⭐⭐ **Release highlights:** Transcribe directly in the browser with downloadable multilingual Whisper models—including Small q4 (302 MB), Medium q4 (684 MB), and Large v3 Turbo q4 (762 MB), without requiring f16—or Qwen3-ASR via WebGPU, preserving the original spoken language instead of translating to English, with explicit model installation, progress, cancellation, storage management, and a selectable Whisper CPU fallback.
- ⭐ Introduce a new voice pipeline with recording-based chunking, VAD speech/silence markers, and independent segmentation for microphone and shared audio.
- Save recoverable audio sessions locally by default, retaining the latest microphone and meeting recording separately, with configurable retention, quality, detection sensitivity, and transcription margins.
- Configure separate silence pauses for transcription chunks and new paragraphs, using presets or custom timings.
- Customize keyboard shortcuts for Hold-to-Talk, microphone, meeting sharing, and automatic assistant speech in Conversation settings. Click to record or replace a shortcut, use modifiers alone or combined with another key, clear bindings, and detect duplicate assignments.
- Keep Diagnostics available even without the debugger installed, with an explicit, confirmed installation through the DSH plugin manager and clear guidance that recorded-session management requires the optional debugger.

#### Live Voice Debugger

- Inspect browser ASR models in a conditional Runtimes tab, with pinned model/runtime versions, execution provider, loading and transcription timings, bounded lifecycle events, and clearly scoped cache/buffer/page-heap figures without claiming model RAM or VRAM measurements.
- Browse recorded sessions, play speech or silence, and inspect their markers, transcriptions, and errors.
- Export a complete session for analysis or delete its audio and history.
- Star important recordings to protect them from automatic cleanup without counting against retention.

### Improvements

- Keep recording and detection settings compact with help tooltips and paired fields.
- Add a compact session timer and improve transcription status text.
- Ask for browser confirmation before closing or reloading a page while microphone or meeting transcription is active.
- Continue saving newly added settings across future frontend updates without requiring matching backend settings-field changes.

### Fixes

- Stop inserting line breaks between transcription chunks and repeating timestamps without a paragraph or source change.
- Fix lost speech endings during transcription backlog or assistant playback, and preserve captured audio independently of speech detection when recording is enabled.
- Keep the end of your recording when releasing Hold-to-Talk.
- Show an error if selected Silero voice detection cannot load, instead of silently switching detectors.

## [0.5.2] - 2026-10-12

### Features

- Set a saved speech playback volume from silent to full volume in the Speech engine settings, independently of microphone input, for Browser speech, macOS Say, and Qwen.
- Customize microphone and shared-audio source names in Live Voice Settings for new meeting transcript blocks. Keep Me / Them as defaults and preserve existing transcript text.

### Improvements

- Improve Browser speech voice selection with language groups, Natural voices first within each group, and a localized default label on the voice preselected when switching to Browser. Preserve manual choices when the voice list refreshes.
- Add Chinese (Mandarin), Spanish, and French to the recognition language selector without changing existing defaults or saved selections.

## [0.5.1] - 2026-10-11

### Features

- Recognize shared meeting audio with Browser SpeechRecognition when its external-audio-track API is verified. Preserve local-only/remote-processing preferences and report unsupported browsers without silently capturing microphone audio.

### Improvements

- Keep every recognition and speaking engine selectable for configuration without automatic provider health checks. Default new speech preferences to macOS Say on macOS hosts and Browser elsewhere; preserve saved choices and show Browser, Qwen, then Whisper recognition.
- Share prepared-segment playback across Browser, macOS Say, and Qwen. Prepare Browser utterances ahead without resuming an idle synthesizer; preserve the configured segment gap and native Web Speech latency limitations.
- Improve the settings layout with consistent expandable sections, clearer organization, compact help tooltips, and voice-command phrase chips. Keep diagnostics in a fixed footer and align the debugger with the DSH theme.
- Preserve timestamp and voice-command button preferences in the input bars across chat changes and page reloads, with independent settings for microphone and shared audio.

### Fixes

- Resume pending automatic speech when returning to a previously visited chat without replaying its history or skipping unread streaming text. Remember progress per session for the page lifetime, restart an interrupted segment from its beginning, and keep explicit cancellation separate from navigation.
- Make automatic assistant speech work with the microphone off. Keep new streaming segments in order without replaying history or discarding unread partial text when microphone mode starts.
- Stop current or paused speech and close the speech bar when automatic assistant speech is disabled. Clear pending segments without ending microphone input or resuming the cancelled response when speech is enabled again.
- Keep playback paused when synthesis finishes after a pause request instead of starting late audio.

### Developer notes

- Distribute compiled plugins through npm only; generated `packages/*/lib/` directories are no longer tracked in Git, even for releases. Build source checkouts before local linking. Release validation checks npm package contents instead of committed bundles.

## [0.5.0] - 2026-10-10

### Features

- Update Live Voice more easily with an explicit **Update now** action and exact-version confirmation in Settings. Use the current profile’s DSH plugin manager, preserve local/custom installations and bundle enablement, require voice capture/playback to be idle at confirmation, and report restart requirements or failures. Never install silently, approve package scripts, retry uncertain operations, reload the page, or restart DSH automatically.
- Extend the optional debugger’s expandable state tree with microphone/shared-audio projections and shared VAD status plus model/WebAssembly file sizes. Keep text hidden by default; do not present page-wide heap estimates as VAD RAM.
- Add experimental Silero browser voice detection for Whisper/Qwen microphone and shared audio, enabled by default where packaged assets are available. Preserve explicit energy selections as an opt-out and keep the volume meter unchanged. Installations without VAD assets use energy detection. Share a lazy WASM runtime while isolating each audio source’s recurrent state, resampling and segmentation. Ship versioned model/runtime assets with the plugin; no native VAD installation or external CDN is required. Report failures instead of silently falling back.

### Improvements

- Detect new GitHub releases sooner by reducing the update-check cache interval from 24 hours to 3 hours. Checks still run when Live Voice Settings opens, not on a background timer; failed attempts use the same interval.

### Fixes

- Reduce noise-triggered transcription with Silero speech detection instead of relying only on audio energy. Non-speech sounds such as vehicles, fans, and animals are less likely to trigger recognition and clutter the transcript; this is speech gating, not noise cancellation, and does not guarantee rejection of every background sound.
- Keep the speech bar, current playback, pause state, captions, and accepted segment queue intact when opening or closing microphone conversation mode, including manual per-turn playback. Speaker mode still defers capture to prevent echo; explicit microphone takeover, Stop speech, End commands, navigation, and disposal retain their cancellation behavior.
- Leave speech captions empty before the first text segment is available instead of showing “Speaking” as a placeholder. Audio preparation keeps its existing progress indicator.

### Developer notes

- Reserve committed generated runtime bundles for explicitly authorized npm release preparation. Ordinary development and pre-push validation checks source/build/tests without requiring committed bundles to match.

## [0.4.1] - 2026-10-09

### Release highlight — meeting reliability

Meeting mode in 0.4.0 shipped with too many bugs. I’m sorry for the frustration and interruptions this caused. This release focuses on making that experience more reliable, with fixes and improvements to shared-audio capture, transcription delivery, playback interruption and recovery, and continuity when switching chats or changing settings.

That work also benefits microphone mode: both inputs now share a consistent set of controls and coordination rules, bringing the same improvements to everyday voice conversations. Thank you for your patience while these issues were addressed.

### Improved

- Make composer voice controls easier to scan: group meeting audio, assistant speech, and microphone toggles into one rounded capsule with subtle dividers. Give each toggle distinct on/off icons and reduced icon opacity when off, while preserving existing start/stop behavior.
- Mirror microphone and shared-meeting input bars with the same Listening / Ignoring action, independent exact-command and timestamp toggles, and Manual / Queue / Steer delivery controls, countdown, and cancellation. Both use the same input coordinator policy; assistant playback remains a single shared resource.
- Extend translations to more interface text, including the Live Voice name, macOS voice guidance, and accessibility labels.
- Add a voice-name option for the macOS Say engine in Settings. Leave it empty to use the macOS default voice.

### Fixes

- The shared-audio bar’s leading icon now toggles Ignoring instead of ending sharing. Explicit source-stop buttons still release capture. Fresh shared capture does not inherit microphone Ignore state, and pending HTTP transcription shows Processing.
- Preserve accepted-source automatic-delivery intent while either input is speaking or transcribing, and rearm after both are idle without sending typed text alone or duplicating delivery. Manual edits, cancellation, Stop, navigation, and disposal invalidate the old deadline.
- Changing settings no longer interrupts active voice conversations, shared meeting capture, or playback. Explicit stops remain respected during reconfiguration.
- Shared meeting capture stays active when switching chats, and new transcription goes to the current chat.
- Switching chats no longer causes old answers to play automatically, including history loaded later.
- Automatically interrupted playback resumes from where it paused after a full quiet interval. Speaking again restarts the wait; manual pauses and stops remain respected.
- Confirmed meeting participant speech pauses or delays assistant playback in speaker and headphone modes. Echo safeguards reduce interference from the assistant's own audio, but mixed system audio cannot guarantee echo separation.
- Ignoring discards microphone dictation and spoken question answers without disabling capture, voice interruption, or recovery after silence, even with voice commands disabled.
- Fix an incorrect voice value passed to macOS Say (`-v`) when switching from Browser speech synthesis, causing macOS Say to use the wrong voice.
- Fix Browser recognition appearing disabled because another recognition engine is unavailable or in an error state. Browser support is still checked before capture.

### Developer notes

- Keep both plugin package versions aligned at 0.4.1.
- Add DOM regressions for recognition selection, local-processing settings, translations, and accessibility labels; rebuild both client bundles.
- Add regressions for macOS Say voice editing, clearing, and error reporting without silent browser fallback, plus current-engine and voice selection during replay.
- Include configured and active speech engines and the active host endpoint in read-only diagnostics without logging speech content.
- Update public documentation and contributor guidance, including Brazilian Portuguese and Simplified Chinese READMEs and clearer meeting, remote-access, and local-first guidance.
- Consolidate changes under 0.4.1 and reserve the Next section for upcoming 0.4.x updates.

## [0.4.0] - 2026-10-07

### Release Changes

Bring your AI assistant into the meeting: capture shared audio alongside your own voice, review the transcript, and send context with questions while the discussion continues. A new speech bar helps you follow spoken answers with approximate live captions, move between segments, and pause or resume playback. Answers start speaking sooner and Markdown is easier to listen to. This release also improves message delivery and microphone recovery, offers optional timestamps and a separately installable debugger, and adjusts conversation defaults. Shared meeting audio is not sent automatically. Both plugin packages are versioned together at 0.4.0; contributor build changes are listed separately below.

### Features

- ⭐⭐ **Meeting Mode** — bring your DSH agent into the conversation, not just the work you do after the meeting.
  - Capture your voice and the other participants’ shared audio during a call, keeping an editable transcript ready to send to the agent without having to retell the discussion.
  - When someone asks a question, send the relevant meeting context with a request such as “Help us answer this point.” The agent can combine that discussion with the project code, spreadsheet, or documents you have made available in DSH.
  - Let the agent answer aloud. When your meeting app is configured to share the agent’s playback audio, everyone can hear the response—making room for a conversation between you, the agent, and the other people on the call.
  - Use it for code reviews, project discussions, or working through a spreadsheet together in Google Meet, Teams, or another meeting app, wherever your browser and operating system support audio sharing. Meeting audio capture and sharing the agent’s voice back into the call require separate sharing setup; this is not a built-in meeting-app integration.
  - Stay in control of what reaches the agent: review and edit the transcript, distinguish your contributions from the shared conversation with `Me:`/`Them:`, and optionally include timestamps. Start or stop either audio source independently; shared meeting audio does not send itself or execute voice commands.
- Normalize Markdown for speech using the Marked parser: remove visual formatting, announce links and images without reading full URLs, shorten file paths with line references, read task lists and table headers/rows, and abbreviate long identifiers. Feed the same normalized text to playback and live captions, preserving the existing code-block line limit.
- ⭐ **Dedicated Speech Bar with Live Captions** — a new 52px bar above recognition controls.
  - Show approximate captions on one clipped line, using host audio timing or a pause-aware native-synthesis estimate; captions are not word-aligned.
  - Place previous/next controls on opposite sides of the text, with pause/resume, stop, and a current/total segment counter. Keep microphone takeover in the recognition bar.
  - Show smoothly scrolling captions with an approximate moving highlight. Display the thin progress line only during indeterminate audio loading, reserving its space during playback to avoid layout shifts and respecting reduced-motion preferences.
  - Split startup speech items at sentence punctuation or colons, never commas, while preparing subsequent audio in parallel.
  - Keep the bar visible between segments and retain message-grouped history and prepared audio until playback finishes or is stopped.
- Add Live Voice Debugger as a separate, optional package in the same repository. Installing it contributes a Developer tab inside Live Voice Settings; the main plugin works without the debugger and does not bundle its interface.
- Open the read-only inspector in a separate browser window, with independently scrolling state and event panes, queue inspection, module filtering, event pause/resume and clearing, and selectable 1–20 Hz refresh (10 Hz by default). Keep diagnostic history bounded and text content hidden unless explicitly enabled.
- Add fake-adapter and DOM regressions for state transitions, segmentation, optional activation, popup handling, event controls, and refresh frequency.

### Configuration Changes

- Default the assistant response delay to zero and offer only no delay or 1–4 seconds. Preserve supported saved values and reset unsupported values to zero.

- Disable Control hold-to-talk by default; keep it available as an opt-in and preserve saved preferences.
- Offer automatic-send delays of 600 ms, 800 ms, and 1–6 seconds with localized duration labels. Keep 4 seconds as the default and reset unsupported saved delays to that default.

### Build and Release Checks

- Keep a single repository-root changelog, linked from the package README, instead of maintaining a duplicate release history inside the package.

- Reorganize the repository as a pnpm workspace with two complete plugin packages under `packages/live-voice` and `packages/live-voice-debugger`, each with separate source, tests, manifests and runtime bundles. Update builds, local-link paths, CI and publication paths for the monorepo.

- Keep the main and debugger package versions aligned. Reject mismatches during builds, CI and the publication workflow. The debugger is a public package. The manual OIDC publication workflow supports both packages or either package individually; no publication is triggered by a push.

### Bug Fixes

- Unify voice-bar layout: speech/live captions first, shared-audio recognition second, microphone last, with a uniform 2px gap. Move the listening/ignoring toggle to the left without duplicating it, keep queue position only in the speech bar, and make the automatic-speech toggle always available in the composer between shared audio and microphone. Stabilize waveform animation across status updates.
- Fix voice delivery being queued when DSH uses Steer for normal Enter. Use an unmodified Enter gesture for steering and Ctrl+Enter for the opposite mode instead of assuming the public submit action follows the busy-Enter preference.
- Fix manual turn playback reading only the closing assistant message. Read all visible assistant responses in the selected turn in step order, including intermediate messages, while excluding user messages, hidden reasoning, and other turns.
- Recover from `OverconstrainedError` when opening a selected microphone: clear and persist only the input-device selection, then retry once with the system default. Preserve unrelated preferences, permission errors, cancellation, and newer device selections.
- Fix Steer and Queue delivery for either DSH busy-Enter policy. Add a persisted, translated question asking what Enter currently does in the user’s DSH; the answer controls Live Voice’s normal-versus-Ctrl+Enter mapping without changing DSH settings. Keep Queue as the compatibility default and apply changes at delivery time to automatic sends, spoken commands, and hold-to-talk. Expose this non-sensitive enum in the debugger’s existing settings snapshot without enabling text-content inspection. Add normalization, mounted settings, composer gesture, and debugger regressions.
- Preserve the composer caret, forward/backward selection, focus, and scroll position when appending final dictation. Restore selection after DSH rebuilds editor nodes and notify its selection bridge; explicit Clear remains a separate action.
- Keep spoken Send and Queue commands as one-shot delivery actions. They no longer enable automatic sending, change its mode, or persist a different sending preference. Manual sending remains manual after a spoken command; existing automatic modes remain unchanged.
- Add regressions for spoken delivery in Manual, Queue, and Steer modes, including unchanged preferences, no settings writes, and subsequent dictation behavior.

## [0.3.2] - 2026-10-06

### Release Changes

Voice control feels more immediate: the new default Short profile sends captured speech for recognition after 500 ms of silence, reducing the wait before transcription and voice-command execution. Maintainer feedback reports a noticeably more responsive experience in daily use. This reduces the segmentation delay, not model inference time, and does not claim improved recognition accuracy. Natural, Long, and Custom remain available for longer pauses. All Live Voice preferences now live on the DSH server instead of in browser storage, so browsers connecting to the same host load the same saved configuration. Legacy browser preferences are intentionally not migrated; configure them once again after updating.

### Changes

- Adjust silence-detection profiles to Short (500 ms, now the default), Natural (1000 ms), and Long (2000 ms).
- Add a persisted Custom silence profile with whole-millisecond input from 100 to 10,000 ms for Qwen and Whisper capture, translated into every supported interface language.
- Move every Live Voice preference to authenticated server-side persistence, including engines, languages, device selections, conversation policy, silence timing, response/send delays, filters, voice commands, and editable spoken-context text.
- Save normalized settings atomically with owner-only file permissions and serialize partial updates to preserve unrelated preferences during concurrent saves.
- Remove browser-storage reads and writes from the plugin; keep release-check metadata in memory only.
- Add translated server load/save errors in all six interface languages, with no browser-storage fallback.
- Add regression coverage for persistence across host-store recreation and independent clients, concurrent updates, file permissions, invalid requests, corrupted storage, and ignored legacy browser preferences.

### Bug Fixes

- Make dictation append-only: append final recognized chunks at the end of the current composer and keep provisional hypotheses out of its text. Existing text and manual edits are preserved; explicit Clear and normal submission remain separate actions.
- Accept manual composer updates when React skips the exact echo of an earlier voice write, preventing later chunks from restoring stale draft snapshots. Muting, cancellation, commands, and rejected short phrases no longer perform unnecessary whole-draft writes.
- Add mounted regressions for skipped voice echoes, manual replacement, delayed publications, and append-only final chunks; document the append-only lifecycle contract.
- Preserve spaces, commas, line breaks, and unfinished entries while editing voice commands and other settings. Normalize and save text only when the field loses focus, not on every keystroke.
- Centralize text inputs, textareas, and numeric inputs on one shared draft-field component. Parent updates and delayed server responses no longer overwrite an active edit; invalid numeric drafts restore the saved value on blur.
- Apply the same blur-only saving behavior to Qwen and Whisper connection fields, and allow empty voice-command fields without restoring fallback phrases.
- Add regressions for raw typing, comma-separated commands, blur-only commits, late parent updates, empty text, numeric validation, and restored defaults.

### Upgrade Notes

- Legacy browser preferences are not imported. The first load without saved server preferences uses defaults; configure Live Voice once again. Qwen and Whisper connection settings already stored on the host remain unchanged.
- Restart the DSH server after updating to load the new settings route, then refresh the browser. Refreshing the page alone is not sufficient.
- Device selections are shared too, but the selected device must exist and be usable in the current browser. Microphone permissions and browser language-pack installations remain browser-managed capabilities.

**Full Changelog:** https://github.com/victorwads/dsh-live-voice/compare/v0.3.1...v0.3.2

## [0.3.1] - 2026-10-03

### Release Changes

This release simplifies the Settings interface, supports larger Qwen recognition uploads, and confirms compatibility with the current tested DSH release.

### Changes

- Group the primary speech, recognition, and conversation settings into collapsed General sections, with icons on tabs and subsection headings.
- Start silence-detection settings collapsed and keep recognition capability status visible outside the General section.
- Add the General section label to every supported interface language and update accessibility and mounted-component regression coverage.

### Documentation

- Split agent guidance and architecture documentation by application, domain module, and shared design-system boundaries.

### Bug Fixes

- Increase the default Qwen recognition audio-upload limit from 2 MB to 50 MB and add regression coverage for uploads larger than 2 MB.
- Derive the installed-version badge and newer-release test fixture from package metadata instead of hard-coded plugin versions.

### Compatibility

- Confirm tested compatibility with DeepSeek Harness **0.2.0-rc.2** and correct the tested-version release link.

**Full Changelog:** https://github.com/victorwads/dsh-live-voice/compare/v0.3.0...v0.3.1

## [0.3.0] - 2026-09-24

### Release Changes

This release adds multilingual DSH-native localization, voice-aware agent context, smoother host-audio playback, and a modular foundation for future development.

### Features

- Translate the plugin interface into English, Portuguese (Brazil), Spanish, French, Hindi, and Chinese through the DSH locale service. Interface language remains independent of recognition language, synthesis language, and user-defined voice commands.
- Add a configurable, session-scoped Live Voice context for agent responses. During an active voice conversation with automatic spoken responses enabled, the agent receives editable guidance that its user-facing response will be spoken aloud.
- Add an English Live Voice context editor and Restore default action to Speaking settings; interface labels and help remain localized.
- Standardize host speech as compact AAC/M4A played in the browser: macOS `say` and Qwen synthesize internally to WAV, the DSH host transcodes it before transport, and up to three upcoming segments are synthesized ahead to reduce gaps.
- Add a configurable pause between consecutive spoken segments, with a 400 ms default for more natural pacing.
- Add a Next speech control that skips only the current spoken segment, immediately starts the next queued segment, and keeps queued and incoming streaming speech intact.

### Bug Fixes

- Preserve spaces and in-progress edits in text settings until the field loses focus, then normalize and save the value.
- Make automatic Steer delivery use DSH's Ctrl/Cmd+Enter accelerated composer gesture instead of the public normal-submit action, so messages are sent to the running agent rather than silently added to its queue. Add a lifecycle regression for the gesture.
- Deduplicate voice-context synchronization so the PUT request fires only when the payload actually changes, instead of on every coordinator state update.
- Prevent automatic assistant speech in speaker mode from overtaking the user's turn. Playback now waits for all pending backend transcriptions to finish and for the automatic-send countdown and delivery attempt to complete, avoiding canceled recognition, discarded transcripts, and interrupted automatic delivery.
- Consume visible assistant history when restarting voice conversation so previous responses and text streamed while voice mode was off are not replayed.

### Changes

- Migrate React UI components to TSX and organize the implementation into application composition roots, domain modules, and a reusable design system.
- Add a Preview.js component workspace with synthetic voice-bar and Settings scenarios for isolated UI development.
- Change the project license and package metadata from GPL-3.0-only to Apache-2.0.

### Documentation

- Add dedicated configuration, engine-selection, architecture, review, and voice-lifecycle guides.
- Update the quick-start command to install the plugin into the DSH web profile.

**Full Changelog:** https://github.com/victorwads/dsh-live-voice/compare/v0.2.3...v0.3.0

## [0.2.3] - 2026-09-21

### Release Changes

This release makes plugin updates and tested-version information visible in Settings and clarifies the recognition-engine roadmap.

### Features

- Add an update notification in Live Voice settings when a newer GitHub release is available. The check runs at most once every 24 hours and the action opens the matching release.
- Show the installed Live Voice version and the tested DSH version in the settings header.
- Show Browser WebGPU Inference, sherpa-onnx Streaming, NVIDIA Parakeet, and Voxtral Realtime as disabled upcoming recognition engines.

### Changes

- Rename recognition-engine options to describe the API they use: Browser SpeechRecognition, Qwen3 ASR HTTP API, and Whisper HTTP API.
- Show the expected HTTP URL or transcription route for the selected recognition engine.

### Bug Fixes

- Avoid repeated GitHub requests when the release API is unavailable by caching failed checks for the same 24-hour interval.
- Handle release tags with a leading `v` and prerelease identifiers correctly when deciding whether an update is newer.
- Ignore unexpected release URLs and fall back to the repository releases page.

### Documentation

- Improve README clarity and remove duplicated content.

**Full Changelog:** https://github.com/victorwads/dsh-live-voice/compare/v0.2.2...v0.2.3

## [0.2.2] - 2026-09-19

### Features

- Add an optional global hold-Control push-to-talk gesture that works while a composer is mounted even when regular voice mode is off. Releasing Control flushes queued transcription, waits the configured automatic-send delay, queues the completed draft once, and closes capture; Escape cancels the gesture.

### Changes

- Increase the maximum continuous-speech transcription chunk from 20 to 60 seconds by default for Whisper HTTP and Qwen HTTP recognition. Add a Speech recognition setting that lets users configure the limit from 10 to 300 seconds; uninterrupted speech is split and sent for transcription only after the selected duration.

### Bug Fixes

- Serialize Whisper HTTP and Qwen HTTP transcription segments through a per-session FIFO queue, preserving capture order while the microphone continues recording.
- Defer the automatic-send countdown while transcription segments are queued or a request is active.
- Discard queued segments and abort the active request when recognition stops, and clear the coordinator’s pending-transcription count.
- Add regression tests for serialized requests, ordered results, cancellation of queued work, and automatic-send gating until the transcription queue drains.

### Compatibility

- Record that the latest DSH version tested with this plugin is **0.1.6-alpha.2**.

## [0.2.1] - 2026-09-19

### Documentation

- Reframe the README around the local-first, hands-free experience, including continuous conversations, spoken structured questions, voice commands, and behavior across chat navigation.
- Expand package and README discovery keywords for hands-free voice, conversational AI, spoken prompts, Qwen3 speech engines, and Apple Silicon.

### Changes

- Update existing development dependencies.

### Bug Fixes

- Persist microphone enabled or muted state as a global preference and propagate settings changes to every active voice controller. New controllers now inherit the saved microphone state, and capability information is refreshed after synchronized settings changes.
- Keep microphone, conversation, and Speak controls available when DSH omits the legacy `uiSession.pendingInteractions` store. Structured-question voice handling remains inactive when that optional store is unavailable.
- Add regression coverage for global microphone-state normalization and for mounting voice controls without the legacy pending-interaction store.

## [0.2.0] - Unreleased

### Release Changes

This release expands conversation control, audio routing, speech filtering, and settings organization.

### Features

- Add hands-free DSH structured questions in voice conversation mode: narrate each prompt, capture the next spoken response as a custom answer, submit it automatically, and keep the Live Voice status bar visible over the question panel.
- Add audio input and output device preferences.
- Add a three-state delivery mode for manual review, queued delivery, and immediate steering.
- Add configurable speech-input filtering, including minimum-word filtering for final recognition results.
- Add configurable speech-output filtering to omit code blocks from spoken responses.
- Add exact voice commands for ending a conversation, muting or resuming listening, stopping speech, clearing input, and sending or queuing recognized text. Commands support multiple comma-separated phrases and normalize punctuation, case, and accents only while matching.
- Add a remaining-speech segment count to the automatic speech control; it remains expanded while speech is queued.
- Use the same newline-only segmentation and queue for automatic streaming speech and manual Speak actions.
- Add tabbed Live Voice settings to organize speech, conversation, commands, and advanced options.

### Changes

- Improve the Live Voice controls and settings interface for delivery, device, filtering, command, microphone-input, and speech-queue states.
- Expand coordinator, settings, component, and filter test coverage.
- Update compiled client and server bundles for the new functionality.
- Include this changelog in the published package.

### Bug Fixes

- Keep voice conversation mode active across chat navigation. When the current composer is replaced, the newly mounted chat automatically resumes voice mode; only an explicit End voice conversation action disables it. Composer drafts remain isolated per conversation, while internal controller disposal and hardware handoffs no longer count as user-requested conversation termination.
- Add lifecycle regression coverage for switching chats while voice mode is active and for preserving an explicit end across subsequent chats.
- Require at least one recognized word before headphone-mode microphone activity may pause assistant speech; audio activity alone no longer pauses playback.
- Debounce headphone-mode interruptions to reduce false pauses from short recognition events.
- Automatically resume speech when an interruption candidate ends without becoming valid user speech.
- Preserve manual pause behavior separately from automatic interruption handling.

## [0.1.0] - 2026-09-15

### Bug Fixes

- Reliably reset browser speech recognition after it ends or encounters an error.
- Allow a custom HTTP or HTTPS base URL for the host-local Qwen3 speech service.

## [0.0.2] - 2026-09-15

### Features

- Add host-local Apple MLX support for Qwen3-ASR and Qwen3-TTS.
- Add Qwen TTS voice selection in Live Voice settings.
- Expand Live Voice controls and their integration coverage.
- Add continuous integration, a pre-push hook, formatting configuration, and distribution-artifact validation.

### Changes

- Update the conversation coordinator, microphone, recognition, synthesis, Whisper, and native macOS `say` integrations for the new engines and controls.
- Include compiled client and server bundles in the published distribution.

## [0.0.1-alpha.1] - 2026-09-15

### Features

- First functional release of the DSH Live Voice plugin.
- Coordinate microphone capture, speech recognition, assistant-message delivery, and speech playback.
- Add voice typing in the DSH composer and continuous voice conversations.
- Support browser SpeechRecognition and authenticated loopback whisper.cpp HTTP recognition.
- Support browser speech synthesis and native macOS `say` output.
- Add Live Voice controls, Whisper settings, build and browser-preview scripts, and an initial test suite.

[0.3.0]: https://github.com/victorwads/dsh-live-voice/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/victorwads/dsh-live-voice/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/victorwads/dsh-live-voice/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/victorwads/dsh-live-voice/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/victorwads/dsh-live-voice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/victorwads/dsh-live-voice/compare/v0.0.2...v0.1.0
[0.0.2]: https://github.com/victorwads/dsh-live-voice/compare/v0.0.1-alpha.1...v0.0.2
[0.0.1-alpha.1]: https://github.com/victorwads/dsh-live-voice/tree/v0.0.1-alpha.1
