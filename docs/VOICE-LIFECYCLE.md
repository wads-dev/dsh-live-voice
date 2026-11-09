# Voice Lifecycle and Turn-Taking Contract

This is the natural-language behavioral contract for conversation lifecycle and turn management. Code and tests should be reviewed against these rules.

## State scopes

### Persisted preferences

Engine, language, input/output device, Speakers/Headphones mode, delivery mode, delays, filters, independent microphone/shared-audio timestamps and voice-command enablement, and customized voice-command phrases survive conversations and reloads through the host-side `dsh-live-voice.settings` preferences. The explicit exception is microphone/shared source names and always-show-name intent, stored locally under `dsh-live-voice.identity` and never sent as host settings. Legacy whole-settings browser values and old host names are not migrated. Timestamp component formatting remains host-shared and always preserves hours/minutes.

### Interruption sources

Shared meeting recognition publishes activity to the committed voice coordinator, separately from microphone activity. Either active source blocks queued speech; both must become silent before an automatically interrupted playback can resume. During playback, microphone interruption is limited to Headphones mode; shared participants can interrupt either output mode after qualifying non-echo recognition. Automatically paused audio resumes at its retained playback position after `assistantSpeechDelaySeconds` of uninterrupted silence. Renewed speech cancels that recovery countdown; final recognition also closes activity when no explicit activity-end event arrives. Explicit pause, cancel, segment navigation, or disposal prevents stale automatic recovery. Raw level/activity alone does not confirm an interruption, to avoid a feedback loop from assistant playback. Final-only recognition can confirm too late to interrupt the same short utterance. Browser own-tab/audio exclusion hints and a repeated-transcript guard reduce feedback, but cannot separate arbitrary mixed system audio acoustically.

### Application continuity

An explicit choice to keep voice conversation mode active may follow the committed composer across a chat route change. Shared meeting screen/audio capture and its recording writer are application-owned and stay active across navigation until an explicit stop, browser track end, page exit, or plugin disposal. Its transcript destination follows the committed composer; recognition results whose speech began before composer replacement are discarded, and without a committed composer no composer is modified. This continuity does not authorize session-owned queues or draft state to leak into the new composer. Automatic-speech cursors and pending text descriptors are remembered separately per session in application memory, without retaining audio, engines, capture, or timers. On return, only that session's unfinished segment and unread queue resume. An interrupted segment restarts at its beginning because Browser speech does not provide portable seek. A first visit baselines existing history; new messages and appended text since an earlier visit remain eligible. Explicit manual pause stays paused; manual per-message/question reads are not resumed. The memory ends on page exit or plugin disposal, is never persisted, and does not authorize background playback.

### Per-session transient state

Recording-backed microphone conversation input is retained per chat in page memory during navigation. Composer detachment parks capture and its sample-based timer, drains captured utterances into the existing recognition queue without sealing the recording, and retains final results for that chat. Already queued/in-flight recognition continues; no detached composer is modified and no automatic delivery timer runs. Returning acquires hardware ownership before resuming the same recording and delivering retained results against the latest composer draft. Explicit Stop/End, page exit and plugin disposal cancel input and release parked resources. Native Browser recognition without recorder pause support retains its stop/restart behavior.

Soft mute, recognition activity, partial transcript ownership, pending delivery countdowns, silence timers, queued playback, paused playback, errors, abort controllers and resource ownership remain session-scoped. Navigation cancels live playback and checkpoints logical automatic-speech progress separately from parked microphone resources. Explicit Stop/End or disabling automatic speech discards pending speech instead of parking it. A new voice session must not inherit another chat's soft mute or transcript queue.

### Per-operation state

Permission requests, engine starts, transcription requests, synthesis requests, and audio preparation each have their own cancellation generation. Results from an obsolete generation must not modify the current composer or playback queue.

## Independent states

Capture, recognition, user speech activity, message delivery, agent generation, synthesis, and playback are related but distinct. Mute is not stop. Pause is not cancel. Stopping speech must not silently stop recognition. Opening or closing microphone conversation mode must not cancel playback, clear captions/history/accepted speech queues, or change manual pause state. Speaker-mode input enablement stays gated until playback completes; explicit Take microphone retains the teardown-before-capture handoff. Automatic assistant speech admits new messages while its toggle is enabled, even when microphone conversation mode is closed. Closing or opening input does not consume unread partial speech or alter playback offsets; the microphone remains closed after playback unless explicitly enabled. First-visit history and delayed historical backfill are baselined rather than spoken. Previously visited sessions preserve their cursors and accept known continuations/newer messages on return; updates outside the committed composer never play in the background or advance parked speech progress. Full End commands and lifecycle disposal release all voice resources.

## Global inactivity ending

The application composer bridge owns one inactivity clock across microphone, shared and participant sources, never one clock per source. By default, five minutes without nonempty recognized text ends voice resources, with a visual warning and available non-disruptive TTS one minute beforehand. Both durations are positive configurable minutes; warning lead time is at most half the total, with no absolute cap. Interim/final results and Continue listening reset the clock, including ignored or short text. Substantial matching warning echoes do not. No automatic mute stage exists.

Input activity or pending recognition at the deadline gets at most 30 seconds of grace. Accepted text cancels ending; work still pending beyond grace uses normal End cancellation. Preserve committed draft text and never submit it as part of inactivity cleanup. Delayed timer execution must grant a fresh full warning interval, not instantly end after suspension. End microphone input, playback, parked input and all meeting sources; request bounded Attendee disconnect and retain its uncertainty feedback. Keep an inactivity reason visible with explicit microphone restart. Other sources require their normal explicit start. Dispose the clock with the application.

## Failure isolation and recovery

Assistant speech, microphone transcription and shared-audio transcription are separate failure domains. A recognition failure must not cancel assistant speech or another capture source; a playback failure must not discard accepted transcript or the unread speech queue. Existing speaker echo gates and teardown safety barriers still apply.

Recoverable failures use at most three automatic retries with bounded exponential backoff. Permission denial, unsupported engines/formats and explicit cancellation require user action rather than an automatic loop. Retries must observe current mute/pause intent and must be invalidated by Stop, disposal and superseding operations. A failed teardown never authorizes overlapping replacement resources. Shared recognition recovery borrows the original live capture track and never silently prompts for a new display capture or substitutes the microphone.

Keep the failed speech segment and unread queue for a manual retry after automatic recovery is exhausted. Retrying a segment may repeat speech already heard; this is not sample-accurate continuation. Feedback identifies the affected source, retry attempt and available cause, and distinguishes automatic recovery from a stopped recovery requiring action. Never log audio or transcript content as recovery diagnostics.

## Turn-taking

- **Speakers:** playback gates microphone recognition so speaker output is not recognized. For HTTP and browser-local recording engines, suspend the capture AudioContext during playback and resume the same recording session afterward; the saved sample clock excludes the real playback gap. If safe suspension is unavailable, stop capture before playback and start a new capture only after playback teardown succeeds. Manual microphone interruption transfers ownership only after old playback teardown succeeds.
- **Headphones:** the microphone can remain open. Interruption requires qualifying transcript/activity rather than a single noise event.
- Spoken Send and Queue commands perform one delivery using their requested mode, without enabling, disabling, changing, or persisting the automatic-send preference. They cancel any pending countdown before that one-shot delivery.
- Automatic delivery starts only after final transcription and the configured quiet delay. New speech, edits, cancellation, or session replacement cancels a pending delivery.
- Automatic assistant playback waits for continuous silence and pending transcription/delivery work. Renewed speech restarts the delay. Manual per-message playback is not delayed. A confirmed playback pause releases speaker-gated microphone capture while input remains enabled, preserving Ignoring and the paused speech position. Resuming playback must safely suspend or stop microphone capture before any audio resumes; a failed gate leaves playback paused. A pause never reopens explicitly stopped or navigation-parked input.
- Sending a user message does not stop existing assistant playback unless the explicit interruption preference is enabled. Loaded history never counts as a new user turn.

## Lifecycle transitions

| Transition | Required result |
| --- | --- |
| Start input | Acquire current ownership; never inherit stale soft mute or transcript state |
| Ignoring (soft mute) | Discard dictation and pending question answers from that input only; keep capture, activity, and interruption active regardless of voice-command preference. Enabled commands remain available. Microphone and shared input have independent Ignore state |
| Resume | Clear only the current session's soft mute |
| Stop input / close mic mode | Cancel starts, capture, recognition, partial hypotheses, and delivery timers; preserve playback, pause state, captions, history, and accepted speech segments |
| Disable automatic assistant speech | Cancel current or paused playback and pending synthesis/segments, clear captions and close the speech bar; preserve input mode and resume speaker-gated input only if it remains enabled. Re-enabling never resumes the cancelled response; manual per-message playback remains available while automatic speech is off |
| End conversation | Stop input and playback, clear queues/timers/transient errors, release ownership |
| Switch chat | Checkpoint automatic speech and cancel playback; park recording-backed microphone input without cancelling accepted transcription requests. Retain results only for their originating chat. Returning resumes that recording and delivers its results after the hardware handoff; native Browser input still stops/restarts |
| Settings change | Except for explicit automatic-speech disable above, output/UI preferences preserve active playback, queue, and meeting capture; input preferences serialize only microphone/recognition replacement and restore input unless explicitly stopped. Current shared capture uses its start-time recognition settings until explicitly restarted |
| Composer unmount | Park eligible chat-owned microphone capture and delivery; do not interpret navigation as explicit Stop |
| Plugin dispose/pagehide | Invalidate pending work and release every active or parked resource |
| Late async result | Ignore it unless its session and operation generation are still current |

## Speech bar and approximate captions

Microphone and shared-input bars render the same `ConversationStatusBar`, with independent `VoiceCoordinator` input-policy instances. Shared capture remains application-owned; its policy does not create a second microphone or assistant player. Both leading icons toggle Listening / Ignoring; explicit composer source buttons stop capture. Exact commands, per-source timestamps, delivery modes, countdown/cancellation, and pending-transcription status follow the same policy. Preserve an accepted final’s expected-draft delivery intent while either source is busy, rearm after both are idle, and invalidate on manual edit, cancel, Stop, submit, navigation, or disposal. Idle/pending callbacks cannot create intent from another source’s draft.

The speech bar is separate from the recognition pill, with the same 52px pill geometry and shared buttons. It leaves the caption line empty until real segment text exists (never a “Speaking” placeholder), retains the audio-preparation progress indicator, and displays the active speech segment on one clipped line and owns playback pause/resume, next, stop and microphone takeover during speaker gating. Stop clears pending speech and closes the speech bar without ending voice conversation; pause preserves it. The recognition pill retains capture and delivery preferences. The automatic-speech toggle remains available in the composer between shared audio and microphone, even when there is no active playback; it is not duplicated in either bar.

All engine options remain configurable independently of runtime health. Configuration-time discovery is local; provider health checks run only on explicit test/use. Say and Qwen share audio prefetch; Browser prepares local utterances but cannot export synthesized audio for caching. The coordinator owns all segment gaps and admission; pause during synthesis holds a launch gate until resume, and Stop aborts it.

Browser shared recognition borrows the captured live audio track only after a protected overload probe; unsupported APIs never silently recognize the microphone instead. Capture owns track cleanup; reset/restart retain the same shared track.

Host-audio captions estimate character position from actual media currentTime/duration. Browser synthesis has no reliable duration, so its fallback estimates 14 characters/second adjusted by rate, starts only on the native start event and excludes paused time. Neither mode claims word alignment. Unknown duration keeps the full segment visible; cancelled/completed operations clear caption state. Session navigation retains the existing lifecycle semantics; this UI change does not implement the future global queue.

## Append-only dictation contract

Recognition is append-only at the end of the current composer. Only final recognized chunks are committed; provisional hypotheses affect recognition/activity status but never insert, replace, or remove composer text. Each final chunk appends after the latest published manual text, regardless of caret position. Appending must preserve the existing caret or selection (including its direction), keyboard focus, and composer scroll position; dictation must not move the caret to the appended text. Live Voice must not restore an older full-draft snapshot over a manual edit, even when React skips the exact echo of a previous voice write. Muting, cancellation, rejected short phrases, and voice-command recognition do not rewrite the composer. The explicit Clear command and ordinary user submission remain intentional exceptions; they are not dictation writes.

## Invariants

1. A new session never inherits soft mute.
2. Old recognition never writes into a new composer.
3. Cancelled or replaced playback never resumes itself.
4. Only the current owner may control shared hardware or host playback.
5. Failed teardown blocks unsafe replacement rather than overlapping resources.
6. End conversation leaves no capture, playback, countdown, queued transcript, or silence timer active.
7. Raw audio and transcript content are not logged by default.

These rules require regression tests where automation is possible and physical-device checks where browser permissions or hardware behavior cannot be simulated faithfully.
