import type { LiveVoiceTranslation } from './base.js';

const en: LiveVoiceTranslation = {
  'dsh-live-voice.commons.connection.contactingHost': 'Contacting DSH host…',
  'dsh-live-voice.commons.connection.endpoint': 'Endpoint URL',
  'dsh-live-voice.commons.connection.healthEndpoint': 'Health URL or path',
  'dsh-live-voice.commons.connection.reload': 'Reload saved settings',
  'dsh-live-voice.commons.connection.test': 'Test connection',
  'dsh-live-voice.commons.connection.timeout': 'Request timeout (ms)',
  'dsh-live-voice.commons.connection.title': 'Connection settings',
  'dsh-live-voice.commons.connection.unsaved': 'Unsaved changes',
  'dsh-live-voice.commons.controls.title': 'Voice controls',
  'dsh-live-voice.commons.conversation.end': 'End voice conversation',
  'dsh-live-voice.commons.conversation.idle': 'Conversation idle',
  'dsh-live-voice.commons.conversation.start': 'Start voice conversation',
  'dsh-live-voice.commons.delivery.queueBadge': 'QUEUE',
  'dsh-live-voice.commons.device.numberedLabel': '{device} {number}',
  'dsh-live-voice.commons.dismiss': 'Dismiss',
  'dsh-live-voice.commons.dismissError': 'Dismiss voice error',
  'dsh-live-voice.commons.engine.failure': '{engine}: {reason}',
  'dsh-live-voice.commons.input.ignoring': 'ignoring',
  'dsh-live-voice.commons.input.ignoringBadge': 'IGNORING',
  'dsh-live-voice.commons.input.listening': 'listening',
  'dsh-live-voice.commons.input.listeningBadge': 'LISTENING',
  'dsh-live-voice.commons.manual': 'manual',
  'dsh-live-voice.commons.milliseconds': '{milliseconds} ms',
  'dsh-live-voice.commons.off': 'off',
  'dsh-live-voice.commons.on': 'on',
  'dsh-live-voice.commons.pluginName': 'Live Voice',
  'dsh-live-voice.commons.queue': 'queue',
  'dsh-live-voice.commons.repository.starLabel': 'Star Us on GitHub',
  'dsh-live-voice.commons.repository.starLink': 'Star DSH Live Voice on GitHub',
  'dsh-live-voice.commons.second': '1 second',
  'dsh-live-voice.commons.seconds': '{seconds} seconds',
  'dsh-live-voice.commons.send': 'SEND',
  'dsh-live-voice.commons.status.ready': 'Voice ready',
  'dsh-live-voice.commons.systemDefault': 'System default',
  'dsh-live-voice.commons.toggle.offBadge': 'OFF',
  'dsh-live-voice.commons.unknownLanguage': 'unknown language',
  'dsh-live-voice.commons.update.busy': 'Stop voice capture and playback before updating.',
  'dsh-live-voice.commons.update.cancel': 'Cancel',
  'dsh-live-voice.commons.update.confirm':
    'Install Live Voice {version} in this DSH profile? Download requires network access. Restart DSH afterward when requested; nothing restarts automatically.',
  'dsh-live-voice.commons.update.current':
    'This version is already installed. Restart DSH to use it.',
  'dsh-live-voice.commons.update.delayed':
    'The requested version is not available to this profile yet. It may still be publishing or be delayed by pnpm minimumReleaseAge. Wait, then check the DSH plugin manager; no security policy was bypassed.',
  'dsh-live-voice.commons.update.done':
    'Live Voice {version} installed. Reload the page when ready.',
  'dsh-live-voice.commons.update.failed':
    'Update failed. The release may not be published on npm yet. Check the DSH plugin manager.',
  'dsh-live-voice.commons.update.incompatible':
    'This release is incompatible with the running DSH version. Check the DSH plugin manager and use a compatible DSH/plugin version; no compatibility exemption was granted.',
  'dsh-live-voice.commons.update.installing': 'Updating…',
  'dsh-live-voice.commons.update.label': 'Update available',
  'dsh-live-voice.commons.update.link': 'Update available: {version}. Open release',
  'dsh-live-voice.commons.update.local':
    'This is a local, Git or custom installation. Update it using its original installation method.',
  'dsh-live-voice.commons.update.now': 'Update now',
  'dsh-live-voice.commons.update.restart':
    'Live Voice {version} installed. Restart DSH when ready, then reload this page.',
  'dsh-live-voice.commons.update.scripts':
    'Package scripts need approval. Review them in the DSH plugin manager; no scripts were approved here.',
  'dsh-live-voice.commons.update.unavailable':
    'Updates are unavailable for this profile or DSH version. Use the DSH plugin manager.',
  'dsh-live-voice.commons.update.uncertain':
    'The installation result is unknown. Check the DSH plugin manager before trying again.',
  'dsh-live-voice.commons.update.version': 'Update available: {version}',
  'dsh-live-voice.commons.version.compatibility': 'Compatible with DSH v{version}',
  'dsh-live-voice.commons.version.compatibilityLink':
    'Compatible with DSH v{version}. Open release',
  'dsh-live-voice.commons.version.label': 'DSH Live Voice v{version}',
  'dsh-live-voice.commons.version.link': 'DSH Live Voice v{version}. Open releases',
  'dsh-live-voice.commons.version.title': 'Version information',
  'dsh-live-voice.debugger.applied':
    'Debugger {version} installed and applied by DSH. Waiting for diagnostics to register in this page. If it remains unavailable, check the DSH plugin manager; nothing reloads automatically.',
  'dsh-live-voice.debugger.busy':
    'Stop voice capture, transcription and playback before installing.',
  'dsh-live-voice.debugger.close': 'Close',
  'dsh-live-voice.debugger.confirm':
    'Install dsh-live-voice-debugger {version} and enable it in this DSH profile? This downloads from the package registry and requires network access. Restart DSH only if the manager requests it. Nothing restarts or reloads automatically. Do not change this dependency through another manager or CLI during installation.',
  'dsh-live-voice.debugger.description':
    'Diagnostics and recorded-session management require the optional dsh-live-voice-debugger plugin. It lets you inspect runtime state and queues, browse saved recordings, play audio, review transcription results and errors, export sessions and delete finished recordings. Live Voice and recording work without it.',
  'dsh-live-voice.debugger.failed':
    'Installation failed or was cancelled. Check the DSH plugin manager before continuing; installation will not be retried here.',
  'dsh-live-voice.debugger.installNow': 'Install now',
  'dsh-live-voice.debugger.installed':
    'The debugger is already installed but is not available in this page. Check enablement and load errors in the DSH plugin manager. Restart DSH only if requested; this dialog will not reinstall it.',
  'dsh-live-voice.debugger.installing': 'Checking or installing debugger…',
  'dsh-live-voice.debugger.label': 'Diagnostics',
  'dsh-live-voice.debugger.local':
    'A local, Git or custom debugger dependency already exists. Manage it with its original installation method; it will not be replaced here.',
  'dsh-live-voice.debugger.ready':
    'Diagnostics are ready. Close this dialog and click Diagnostics to open the debugger.',
  'dsh-live-voice.debugger.restart':
    'Debugger {version} installed. The DSH manager requires a restart. Restart DSH when ready, then reload this page. Nothing restarts automatically.',
  'dsh-live-voice.debugger.scripts':
    'Package scripts need approval. Review them in the DSH plugin manager; no scripts were approved and installation will not be retried here.',
  'dsh-live-voice.debugger.title': 'Diagnostics and recorded sessions',
  'dsh-live-voice.debugger.unavailable':
    'Installation is unavailable for this profile or DSH version. Use the DSH plugin manager.',
  'dsh-live-voice.debugger.uncertain':
    'The installation result is unknown. Check the DSH plugin manager before continuing; installation will not be retried here.',
  'dsh-live-voice.meeting.actions': 'Meeting actions',
  'dsh-live-voice.meeting.attendee.admissionUnknown': 'Meeting admission is not confirmed.',
  'dsh-live-voice.meeting.attendee.advanced': 'Advanced connection',
  'dsh-live-voice.meeting.attendee.aliasHelp':
    'Aliases apply only to this connection and future transcript text. They do not rename people in the meeting.',
  'dsh-live-voice.meeting.attendee.apiKey': "API key",
  'dsh-live-voice.meeting.attendee.apiUrl': 'Local Attendee API URL',
  'dsh-live-voice.meeting.attendee.automaticReceiver': 'Receiver detected by DSH',
  'dsh-live-voice.meeting.attendee.botId': 'Bot ID (optional; first bot is bound)',
  'dsh-live-voice.meeting.attendee.botName': 'Bot name in the meeting',
  'dsh-live-voice.meeting.attendee.configureConnection': 'Configure Attendee connection',
  'dsh-live-voice.meeting.attendee.confirmRelease': 'Discard control without leaving',
  'dsh-live-voice.meeting.attendee.connected': 'Connected to Attendee',
  'dsh-live-voice.meeting.attendee.connecting': 'Opening receiver…',
  'dsh-live-voice.meeting.attendee.connection': 'Connection settings',
  'dsh-live-voice.meeting.attendee.controlExpired':
    'Bot control expired. The bot may still be in the meeting; check Attendee.',
  'dsh-live-voice.meeting.attendee.controlReleased':
    'Control discarded, not a request to leave. Check the bot in Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnavailable':
    'Bot control is unavailable. The meeting state is unknown; check Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnknown':
    'Bot state is unknown. Check Attendee before creating another bot.',
  'dsh-live-voice.meeting.attendee.copy': 'Copy',
  'dsh-live-voice.meeting.attendee.credentialCancel': "Cancel",
  'dsh-live-voice.meeting.attendee.credentialChecking': "Checking saved API key",
  'dsh-live-voice.meeting.attendee.credentialHelp': "Connect saves a typed key for this API origin and reuses it next time. The host stores it as plaintext in a 0600 file, not OS-encrypted storage. It is shared by authenticated browsers using this host and never returned to the browser. Removing it does not end an existing bot lease.",
  'dsh-live-voice.meeting.attendee.credentialInvalid': "Saved-key storage is invalid. Repair or remove the host credential file before retrying.",
  'dsh-live-voice.meeting.attendee.credentialMissing': "No API key is configured for this API origin. Enter it once and Connect.",
  'dsh-live-voice.meeting.attendee.credentialNotSaved': "API key not configured on this host",
  'dsh-live-voice.meeting.attendee.credentialRemove': "Remove saved API key",
  'dsh-live-voice.meeting.attendee.credentialRemoveConfirm': "Remove saved key",
  'dsh-live-voice.meeting.attendee.credentialRemoveWarning': "Remove this origin’s saved key? Existing reception and bot control keep their current credential; this does not request departure.",
  'dsh-live-voice.meeting.attendee.credentialSaved': "API key configured on this host",
  'dsh-live-voice.meeting.attendee.credentialUnavailable': "Saved-key storage is unavailable. Check host permissions and try again.",
  'dsh-live-voice.meeting.attendee.currentBot': 'Last known bot',
  'dsh-live-voice.meeting.attendee.defaultBotName': 'Default bot name',
  'dsh-live-voice.meeting.attendee.departureRequested':
    'Departure requested; removal from the meeting is not confirmed.',
  'dsh-live-voice.meeting.attendee.failed':
    'Receiver stopped. Check TLS, API credentials, participants, stream limits and recognition engine, then reconnect.',
  'dsh-live-voice.meeting.attendee.help':
    'Connect to your local Attendee service, paste a meeting link, choose a bot name and request entry. Participants appear here and have independent audio bars. Requires HTTP or browser-local STT, not native browser recognition. The API key is not saved. Recording follows your recording settings.',
  'dsh-live-voice.meeting.attendee.ingressUrl': 'Trusted WSS receiver URL',
  'dsh-live-voice.meeting.attendee.invalidMeeting': 'Enter a valid Google Meet link.',
  'dsh-live-voice.meeting.attendee.join': 'Join meeting',
  'dsh-live-voice.meeting.attendee.joinFailed':
    'The join result may be unknown. Check Attendee before reconnecting or creating another bot.',
  'dsh-live-voice.meeting.attendee.joinHelp':
    'Creates a bot with your chosen name and audio destination. The meeting organizer may need to admit it. Disconnecting DSH does not remove the bot; use Leave meeting.',
  'dsh-live-voice.meeting.attendee.joining': 'Requesting entry…',
  'dsh-live-voice.meeting.attendee.leave': 'Leave meeting',
  'dsh-live-voice.meeting.attendee.leaveFailed':
    'Could not confirm the request to leave. The bot may remain; retry Leave meeting or check Attendee.',
  'dsh-live-voice.meeting.attendee.leaving': 'Requesting departure…',
  'dsh-live-voice.meeting.attendee.meetingUrl': 'Google Meet link',
  'dsh-live-voice.meeting.attendee.noParticipants': 'Waiting for participants to be detected',
  'dsh-live-voice.meeting.attendee.participant': 'Participant {number}',
  'dsh-live-voice.meeting.attendee.participants': 'Meeting participants',
  'dsh-live-voice.meeting.attendee.receiverInactive': 'Audio receiver disconnected',
  'dsh-live-voice.meeting.attendee.receiverUrl': 'Receiver URL (secret)',
  'dsh-live-voice.meeting.attendee.recognitionRequired':
    'Choose Whisper HTTP, Qwen HTTP or a browser-local STT model in Settings before connecting.',
  'dsh-live-voice.meeting.attendee.relayUnavailable':
    'The Compose audio bridge is unavailable. Start Attendee with the DSH audio override, then connect again.',
  'dsh-live-voice.meeting.attendee.releaseControl': 'Discard bot control…',
  'dsh-live-voice.meeting.attendee.releaseWarning':
    'Discarding control does not remove the bot from the meeting. You will lose the Leave action here. Continue only after checking Attendee.',
  'dsh-live-voice.meeting.attendee.settingsHelp':
    "Configure the local API origin here. Enter the project API key once and Connect; later connections reuse the key saved on the host for that origin. Use the composer to join a meeting.",
  'dsh-live-voice.meeting.attendee.start': 'Connect to Attendee',
  'dsh-live-voice.meeting.attendee.stop': 'Disconnect from Attendee',
  'dsh-live-voice.meeting.attendee.title': 'Audio by participant (Attendee · experimental)',
  'dsh-live-voice.meeting.attendee.tlsNeeded':
    'DSH has no trusted WSS receiver yet. Configure HTTPS or a trusted WSS proxy under advanced connection settings before joining.',
  'dsh-live-voice.meeting.attendee.waiting':
    'Receiver open; configure a new bot with the URL below.',
  'dsh-live-voice.meeting.browserLocalUnavailable':
    'Local browser recognition is unavailable for this language. Install its language pack or explicitly turn off local-only processing in Settings to permit browser-service recognition.',
  'dsh-live-voice.meeting.browserSharedUnsupported':
    'This browser cannot safely recognize shared audio. Choose Qwen or Whisper HTTP for shared audio.',
  'dsh-live-voice.meeting.failed': 'Recognition failed.',
  'dsh-live-voice.meeting.help':
    'Independent sources; transcripts stay in the composer until you send them manually.',
  'dsh-live-voice.meeting.inactive': 'Inactive',
  'dsh-live-voice.meeting.joinMeet': 'Join Google Meet · experimental',
  'dsh-live-voice.meeting.listening': 'Listening',
  'dsh-live-voice.meeting.microphone': 'Microphone',
  'dsh-live-voice.meeting.noAudio': 'No audio was shared. Enable audio in the sharing dialog.',
  'dsh-live-voice.meeting.processing': 'Transcribing…',
  'dsh-live-voice.meeting.shareTab': 'Share audio from a tab',
  'dsh-live-voice.meeting.shared': 'Shared audio',
  'dsh-live-voice.meeting.start': 'Start source',
  'dsh-live-voice.meeting.startShared': 'Start audio sharing',
  'dsh-live-voice.meeting.starting': 'Starting…',
  'dsh-live-voice.meeting.stop': 'Stop source',
  'dsh-live-voice.meeting.stopShared': 'Stop audio sharing',
  'dsh-live-voice.meeting.timestamps': 'Transcript timestamps',
  'dsh-live-voice.meeting.timestampsBadge': 'Timestamp',
  'dsh-live-voice.meeting.title': 'Meeting mode',
  'dsh-live-voice.meeting.unavailable': 'Recognition is unavailable.',
  'dsh-live-voice.recognition.autoSend.countdownHelp':
    'Countdown starts after a final recognized phrase. New speech or edits cancel it.',
  'dsh-live-voice.recognition.browser.autoInstallPack':
    'Automatically install this browser language pack when needed',
  'dsh-live-voice.recognition.browser.help':
    'Uses the browser SpeechRecognition API. This is the default option.',
  'dsh-live-voice.recognition.browser.label': 'Browser SpeechRecognition · Default option',
  'dsh-live-voice.recognition.browser.localProcessing':
    'Process recognition locally on this device',
  'dsh-live-voice.recognition.browser.microphoneHelp':
    'Browser SpeechRecognition may use the browser or system default microphone instead of this selection.',
  'dsh-live-voice.recognition.browser.remoteServiceWarning':
    'Browser-service recognition is enabled. The browser may send microphone audio to its recognition service.',
  'dsh-live-voice.recognition.commands.addPhrase': 'Add phrase…',
  'dsh-live-voice.recognition.commands.clear': 'Clear composer',
  'dsh-live-voice.recognition.commands.enabled': 'Enable exact voice commands',
  'dsh-live-voice.recognition.commands.end': 'End conversation',
  'dsh-live-voice.recognition.commands.mute': 'Mute composer input',
  'dsh-live-voice.recognition.commands.queue': 'Put in queue',
  'dsh-live-voice.recognition.commands.removePhrase': 'Remove phrase',
  'dsh-live-voice.recognition.commands.resume': 'Resume composer input',
  'dsh-live-voice.recognition.commands.send': 'Send to running agent',
  'dsh-live-voice.recognition.commands.stopSpeech': 'Stop assistant speech',
  'dsh-live-voice.recognition.commands.title': 'Voice commands',
  'dsh-live-voice.recognition.context.hint':
    'Optional background and vocabulary sent as prompt to the selected HTTP speech service, together with each audio segment. Saved on blur. Support depends on the server; this does not restrict languages or guarantee instruction following. Leave empty to send no context.',
  'dsh-live-voice.recognition.context.label': 'Transcription context',
  'dsh-live-voice.recognition.context.placeholder':
    'Native Brazilian Portuguese speaker who frequently uses technical terms in English.',
  'dsh-live-voice.recognition.dictation.cancel': 'Cancel dictation',
  'dsh-live-voice.recognition.engine.label': 'Recognition engine',
  'dsh-live-voice.recognition.headphoneMode.help':
    'The microphone stays open during playback. Recognized non-echo speech can pause playback after the configured delay; it resumes after microphone and shared meeting audio stay silent for that delay. Manual Pause requires Resume.',
  'dsh-live-voice.recognition.headphoneMode.label': 'Headphones — open microphone',
  'dsh-live-voice.recognition.holdToTalk.enabled': 'Hold to talk',
  'dsh-live-voice.recognition.holdToTalk.help':
    'While a composer is open, hold the configured shortcut anywhere on the page to capture speech. Release it to flush queued transcription, wait the configured send delay, queue the message, and close voice capture. Press Escape while holding to cancel.',
  'dsh-live-voice.recognition.language.automatic': 'Automatic — detect language',
  'dsh-live-voice.recognition.language.label': 'Recognition language',
  'dsh-live-voice.recognition.language.options.chinese': 'Chinese (Mandarin)',
  'dsh-live-voice.recognition.language.options.french': 'French',
  'dsh-live-voice.recognition.language.options.spanish': 'Spanish',
  'dsh-live-voice.recognition.local.cancel': 'Cancel',
  'dsh-live-voice.recognition.local.confirm': 'Confirm',
  'dsh-live-voice.recognition.local.confirmDownload':
    'Download {model}? Approximately {size} will be stored in this browser.',
  'dsh-live-voice.recognition.local.confirmRemove':
    'Remove {model} from this browser? Recordings are preserved.',
  'dsh-live-voice.recognition.local.confirmTitle': 'Confirm model storage change',
  'dsh-live-voice.recognition.local.device': 'Runtime',
  'dsh-live-voice.recognition.local.deviceHelp':
    'WebGPU requires a working GPU adapter. Whisper offers an explicit slower WebAssembly CPU option; Qwen requires WebGPU. No automatic runtime or HTTP fallback.',
  'dsh-live-voice.recognition.local.download': 'Download model',
  'dsh-live-voice.recognition.local.error.cancelled':
    'Operation cancelled. Download or load the model when you are ready.',
  'dsh-live-voice.recognition.local.error.download_failed':
    'Model download failed. Check your connection to Hugging Face and try again.',
  'dsh-live-voice.recognition.local.error.f16_unavailable':
    'This model requires WebGPU with shader-f16 support. Choose another Whisper model or a compatible browser/device.',
  'dsh-live-voice.recognition.local.error.failed':
    'The model operation failed. Check browser storage and load the model again.',
  'dsh-live-voice.recognition.local.error.gpu_unavailable':
    'WebGPU is unavailable. Use a browser with a working GPU adapter, or explicitly select Whisper with WebAssembly CPU.',
  'dsh-live-voice.recognition.local.error.inference_failed':
    'Transcription failed. Load the model again, then retry with a shorter audio clip.',
  'dsh-live-voice.recognition.local.error.invalid_audio':
    'This audio cannot be transcribed. Record a new audio clip and try again.',
  'dsh-live-voice.recognition.local.error.invalid_model':
    'This model is not supported. Select a model from the list.',
  'dsh-live-voice.recognition.local.error.model_busy':
    'The model is busy. Wait for the current operation to finish and try again.',
  'dsh-live-voice.recognition.local.error.model_missing':
    'Model files are missing or were evicted. Download the model again.',
  'dsh-live-voice.recognition.local.error.runtime_outdated':
    'The browser loaded an older speech runtime than these settings. Reload this page to load the updated worker. If it persists, reload the updated Live Voice backend in DSH; you do not need to download the model again.',
  'dsh-live-voice.recognition.local.error.runtime_unavailable':
    'The model runtime is unavailable. Refresh the page, check browser support, and load the model again.',
  'dsh-live-voice.recognition.local.error.storage_full':
    'Browser storage is full. Free space or remove unused models, then try again.',
  'dsh-live-voice.recognition.local.error.storage_unavailable':
    'Browser storage is unavailable. Allow site storage in a regular browser profile and try again.',
  'dsh-live-voice.recognition.local.help': 'About browser models',
  'dsh-live-voice.recognition.local.load': 'Load model',
  'dsh-live-voice.recognition.local.model': 'Model',
  'dsh-live-voice.recognition.local.modelCard': 'Model details',
  'dsh-live-voice.recognition.local.phase.absent':
    'Download your first model to begin local transcription.',
  'dsh-live-voice.recognition.local.phase.checking': 'Checking model files…',
  'dsh-live-voice.recognition.local.phase.downloaded':
    'Model downloaded. Load it to begin transcription.',
  'dsh-live-voice.recognition.local.phase.downloading': 'Downloading model…',
  'dsh-live-voice.recognition.local.phase.error':
    'The model needs attention. Follow the error guidance and try again.',
  'dsh-live-voice.recognition.local.phase.loading': 'Loading model…',
  'dsh-live-voice.recognition.local.phase.ready': 'Model ready for local transcription.',
  'dsh-live-voice.recognition.local.privacy':
    'Model downloads contact Hugging Face. Speech is processed on this browser, not sent to an HTTP transcription service. The app still requires DSH.',
  'dsh-live-voice.recognition.local.progress': 'Model download progress',
  'dsh-live-voice.recognition.local.qwenLabel': 'Qwen · Browser',
  'dsh-live-voice.recognition.local.recommended': 'recommended',
  'dsh-live-voice.recognition.local.reload': 'Load again',
  'dsh-live-voice.recognition.local.remove': 'Remove model',
  'dsh-live-voice.recognition.local.space': 'Available browser storage: {size}',
  'dsh-live-voice.recognition.local.storageHelp':
    'Models are stored in this browser profile; caches may be evicted. Disk estimates exclude runtime assets and GPU/RAM overhead. Remove affects model files, not recorded sessions.',
  'dsh-live-voice.recognition.local.title': 'Browser models',
  'dsh-live-voice.recognition.local.whisperLabel': 'Whisper · Browser (recommended)',
  'dsh-live-voice.recognition.manualSend.help':
    'Recognized text stays in the composer until you use the normal DSH Send control.',
  'dsh-live-voice.recognition.maxUtterance.help':
    'If speech never pauses, start a new transcription chunk after this duration. Default: 60 seconds.',
  'dsh-live-voice.recognition.maxUtterance.label': 'Maximum continuous speech (seconds)',
  'dsh-live-voice.recognition.microphone.checking': 'Checking microphone availability',
  'dsh-live-voice.recognition.microphone.device': 'Input device',
  'dsh-live-voice.recognition.microphone.failure': 'Microphone: {reason}',
  'dsh-live-voice.recognition.microphone.ignore': 'Ignore composer input',
  'dsh-live-voice.recognition.microphone.inputStatus':
    'Audio input: {state}. Ignoring discards dictation, not capture: speech interruption stays active; configured voice commands still work when enabled. Stop capture with the source button in the composer.',
  'dsh-live-voice.recognition.microphone.label': 'Microphone',
  'dsh-live-voice.recognition.microphone.permissionHelp':
    'Microphone permission will be requested only when you start dictation or a voice conversation.',
  'dsh-live-voice.recognition.microphone.resume': 'Resume listening',
  'dsh-live-voice.recognition.microphone.starting': 'Starting microphone',
  'dsh-live-voice.recognition.microphone.takeControl': 'Take microphone',
  'dsh-live-voice.recognition.minimumWords.enabled': 'Ignore short final transcription chunks',
  'dsh-live-voice.recognition.minimumWords.help':
    'Final chunks with fewer words are ignored before they reach the composer or automatic delivery.',
  'dsh-live-voice.recognition.minimumWords.label': 'Minimum words per final chunk',
  'dsh-live-voice.recognition.mode.label': 'Listening mode',
  'dsh-live-voice.recognition.planned.parakeet': 'NVIDIA Parakeet — Soon',
  'dsh-live-voice.recognition.planned.sherpa': 'sherpa-onnx Streaming — Soon',
  'dsh-live-voice.recognition.planned.vote': 'Coming Soon — vote on repo issues',
  'dsh-live-voice.recognition.planned.voxtral': 'Voxtral Realtime — Soon',
  'dsh-live-voice.recognition.planned.webGpu': 'Browser WebGPU Inference — Soon',
  'dsh-live-voice.recognition.presets.custom.description':
    'Choose independent chunk and paragraph pauses.',
  'dsh-live-voice.recognition.presets.custom.label': 'Custom',
  'dsh-live-voice.recognition.presets.long.description': 'Wait through longer thinking pauses.',
  'dsh-live-voice.recognition.presets.long.label': 'Long',
  'dsh-live-voice.recognition.presets.natural.description': 'Allow normal pauses between phrases.',
  'dsh-live-voice.recognition.presets.natural.label': 'Natural',
  'dsh-live-voice.recognition.presets.short.description': 'Transcribe quickly after a short pause.',
  'dsh-live-voice.recognition.presets.short.label': 'Short',
  'dsh-live-voice.recognition.providerSettings.help':
    'Provider settings change with the selected recognition engine.',
  'dsh-live-voice.recognition.qwen.captureHelp':
    'Audio is segmented into complete WAV utterances and sent through authenticated DSH to the host-local Qwen3 ASR model.',
  'dsh-live-voice.recognition.qwen.connectionSuccess':
    'Connection successful. Both Qwen ASR and TTS are loaded. Unsaved edits have not been applied.',
  'dsh-live-voice.recognition.qwen.endpointHelp':
    'HTTP API at the configured DSH host URL (default: http://127.0.0.1:8080/inference). Audio uses the authenticated DSH host transcription route.',
  'dsh-live-voice.recognition.qwen.hostHelp':
    'Host-wide settings for the Qwen3 ASR + TTS server. Enter any HTTP or HTTPS base URL reachable from the DSH host. The browser accesses it through authenticated DSH routes.',
  'dsh-live-voice.recognition.qwen.label': 'Qwen3 ASR · HTTP API',
  'dsh-live-voice.recognition.silenceDetection.chunkPause':
    'Before transcribing: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.customHelp':
    'Enter a whole number from 100 to 10,000 ms. Saved when you leave the field. Short pauses may split speech; recognition adds its own latency.',
  'dsh-live-voice.recognition.silenceDetection.customLabel': 'Chunk pause (milliseconds)',
  'dsh-live-voice.recognition.silenceDetection.customParagraphHelp':
    'Silence before a new paragraph in dictated text (100–30,000 ms, whole numbers). Saved when you leave the field; independent of the chunk pause and message delivery.',
  'dsh-live-voice.recognition.silenceDetection.customParagraphLabel':
    'Paragraph pause (milliseconds)',
  'dsh-live-voice.recognition.silenceDetection.detector.energy': 'Audio energy',
  'dsh-live-voice.recognition.silenceDetection.detector.label': 'Voice detector',
  'dsh-live-voice.recognition.silenceDetection.detector.silero': 'Silero — experimental (default)',
  'dsh-live-voice.recognition.silenceDetection.duration':
    'Before transcribing: {milliseconds} ms · New paragraph: {paragraphMilliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.help':
    'Controls how long a pause must last before captured speech is sent for recognition.',
  'dsh-live-voice.recognition.silenceDetection.label': 'Silence detection and paragraphs',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.help':
    'Minimum detected speech before accepting a range (50–2,000 ms). Shorter sounds are ignored.',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.label':
    'Minimum speech (milliseconds)',
  'dsh-live-voice.recognition.silenceDetection.paragraphPause': 'New paragraph: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.pauseLabel': 'Chunk and paragraph pauses',
  'dsh-live-voice.recognition.silenceDetection.threshold.help':
    'Voice activity threshold (0.05–0.95). Lower values detect quieter speech but may accept more noise.',
  'dsh-live-voice.recognition.silenceDetection.threshold.label': 'Voice activity threshold',
  'dsh-live-voice.recognition.silenceDetection.title': 'Silence detection and paragraph settings',
  'dsh-live-voice.recognition.silero.error.failed':
    'Silero voice detection failed. Select Audio energy in settings or retry capture.',
  'dsh-live-voice.recognition.silero.error.overloaded':
    'Silero voice detection is overloaded. Restart capture or select Audio energy in settings.',
  'dsh-live-voice.recognition.silero.error.unavailable':
    'Silero voice detection is unavailable. Select Audio energy in settings or retry capture.',
  'dsh-live-voice.recognition.speakerMode.help':
    'Playback releases the microphone to reduce speaker feedback. Take microphone interrupts manually; recognized non-echo participants in shared meeting audio can pause playback and it resumes after stable silence.',
  'dsh-live-voice.recognition.speakerMode.label': 'Speakers — gated listening',
  'dsh-live-voice.recognition.status.answer': 'Recognizing answer',
  'dsh-live-voice.recognition.status.awaitingAnswer': 'Listening for your answer',
  'dsh-live-voice.recognition.status.listening': 'Listening',
  'dsh-live-voice.recognition.status.listeningProcessing': 'Listening and transcribing',
  'dsh-live-voice.recognition.status.processing': 'Transcribing',
  'dsh-live-voice.recognition.status.unavailable': 'Speech recognition unavailable',
  'dsh-live-voice.recognition.status.waiting': 'Waiting',
  'dsh-live-voice.recognition.status.waitingCommand': 'Waiting for command',
  'dsh-live-voice.recognition.voiceCommands.help':
    'Separate phrases with commas. Matching ignores capitalization, accents, punctuation, and extra spaces. The entire final chunk must match.',
  'dsh-live-voice.recognition.whisper.captureHelp':
    'Audio is segmented into complete WAV utterances, sent through authenticated DSH, and processed by loopback whisper.cpp HTTP.',
  'dsh-live-voice.recognition.whisper.connectionSuccess':
    'Connection successful. Health endpoint responded; transcription was not tested. Unsaved edits have not been applied.',
  'dsh-live-voice.recognition.whisper.endpointHelp':
    'HTTP API at the configured base URL (default: http://127.0.0.1:8080/). Compatible with POST /v1/audio/transcriptions.',
  'dsh-live-voice.recognition.whisper.healthFailed': 'Whisper health check failed.',
  'dsh-live-voice.recognition.whisper.label': 'Whisper · HTTP API',
  'dsh-live-voice.recognition.whisper.requestFailed': 'Whisper settings request failed.',
  'dsh-live-voice.recognition.whisper.restartRequired':
    'Whisper settings routes are not loaded. A normal DSH server restart is required to load updated plugin routes; refreshing this page alone is not enough.',
  'dsh-live-voice.recognition.whisper.save': 'Save Whisper settings',
  'dsh-live-voice.recognition.whisper.saved':
    'Saved on the DSH host. Active host transcription requests were cancelled.',
  'dsh-live-voice.recognition.whisper.signInRequired': 'Sign in to DSH to manage Whisper settings.',
  'dsh-live-voice.recording.bitrate.help':
    'Target compressed audio bitrate. Higher values use more local storage.',
  'dsh-live-voice.recording.bitrate.label': 'Recording bitrate',
  'dsh-live-voice.recording.bitrate.option': '{bitrate} kbps',
  'dsh-live-voice.recording.browserUnsupported':
    'Browser recognition does not support recoverable recordings or transcription of saved audio ranges. Choose Qwen or Whisper HTTP.',
  'dsh-live-voice.recording.durabilityWarning':
    'Local storage can fill or be cleared; recovery is not guaranteed. If saving fails, capture stops to avoid silent data loss.',
  'dsh-live-voice.recording.enabled.help':
    'On by default. Turn off to opt out of saving recoverable audio locally while capturing.',
  'dsh-live-voice.recording.enabled.label': 'Save recoverable recordings',
  'dsh-live-voice.recording.error.failed':
    'Recording could not be saved. Capture stopped to avoid silent data loss.',
  'dsh-live-voice.recording.keepPrevious.help':
    "Keep 1–100 ordinary captures per source type; Attendee keeps N meeting groups, newest by capture activity, with every participant and burst while that group is retained. Active writers, pending writes and stars protect the whole meeting group without consuming an ordinary slot. Silence between bursts does not mean the call ended or reserve its place: a newer meeting may expire an older quiet group. Legacy microphone/shared recordings keep N captures per type. Browser quota or storage eviction can still limit availability.",
  'dsh-live-voice.recording.keepPrevious.label': 'Retained recordings per source type',
  'dsh-live-voice.recording.managementHelp':
    'Managing saved sessions—browsing, playback, reviewing transcripts, export and deletion—requires the optional dsh-live-voice-debugger plugin. Use Diagnostics below to install it. Recording itself does not require the debugger.',
  'dsh-live-voice.recording.paddingHelp':
    'Include 0–2,000 ms before and after detected speech when transcribing a saved audio range.',
  'dsh-live-voice.recording.postRoll.label': 'Audio after speech (milliseconds)',
  'dsh-live-voice.recording.preRoll.label': 'Audio before speech (milliseconds)',
  'dsh-live-voice.recording.privacyWarning':
    'Audio, including silence and background sound, is stored locally in this browser profile and site, using lossy compression. Obtain consent before recording others. Turning this off does not delete saved recordings.',
  'dsh-live-voice.recording.status.saved': 'Audio saved through {time}',
  'dsh-live-voice.recording.title': 'Recoverable recordings',
  'dsh-live-voice.settings.autoSend.cancel': 'Cancel automatic send',
  'dsh-live-voice.settings.autoSend.countdown': 'Sending in {remaining}',
  'dsh-live-voice.settings.autoSend.delay': 'Send after silence',
  'dsh-live-voice.settings.close': 'Close voice settings',
  'dsh-live-voice.settings.delivery.dshEnterHelp':
    'Live Voice uses your answer to choose the correct action for Steer and Queue. This does not change DSH settings; match your current DSH configuration and update this answer if it changes.',
  'dsh-live-voice.settings.delivery.dshEnterQuestion':
    'In your DSH, what does Enter do when the agent is busy?',
  'dsh-live-voice.settings.delivery.dshEnterQueue': 'Puts the message in the queue',
  'dsh-live-voice.settings.delivery.dshEnterSteer': 'Sends the message as steer',
  'dsh-live-voice.settings.delivery.label': 'Sending mode',
  'dsh-live-voice.settings.delivery.manualLabel': 'Off — review and send manually',
  'dsh-live-voice.settings.delivery.queueLabel': 'Queue — automatically add after silence',
  'dsh-live-voice.settings.delivery.status': 'Automatic delivery: {mode}',
  'dsh-live-voice.settings.delivery.steerDescription': 'send to the running agent',
  'dsh-live-voice.settings.delivery.steerLabel': 'Steer — automatically send to the running agent',
  'dsh-live-voice.settings.delivery.toggle': 'Automatic delivery mode',
  'dsh-live-voice.settings.engine.refresh': 'Refresh available engines',
  'dsh-live-voice.settings.filters.title': 'Filtering',
  'dsh-live-voice.settings.general.title': 'General',
  'dsh-live-voice.settings.layout.delivery': 'Message delivery',
  'dsh-live-voice.settings.layout.diagnostics': 'Diagnostics',
  'dsh-live-voice.settings.layout.listening': 'Listening & interruptions',
  'dsh-live-voice.settings.layout.playback': 'Playback & output',
  'dsh-live-voice.settings.layout.shortcut': 'Shortcuts',
  'dsh-live-voice.settings.layout.transcription': 'Transcription',
  'dsh-live-voice.settings.layout.voice': 'Voice & engine',
  'dsh-live-voice.settings.persistence.loadError':
    'Could not load Live Voice settings from the server. Reload to try again.',
  'dsh-live-voice.settings.persistence.saveError':
    'Could not save Live Voice settings on the server. Please try again.',
  'dsh-live-voice.settings.shortcuts.assistantSpeech': 'Toggle automatic assistant speech',
  'dsh-live-voice.settings.shortcuts.clear': 'Clear',
  'dsh-live-voice.settings.shortcuts.conflict':
    'This shortcut is already assigned to another action.',
  'dsh-live-voice.settings.shortcuts.edit': 'Click to replace',
  'dsh-live-voice.settings.shortcuts.help':
    'Click a shortcut, press the new keys together, then release to save. Ctrl, Shift, Alt and Command work alone or in combinations, with or without a letter. Escape cancels; Tab leaves the field. Browser or system shortcuts may take priority.',
  'dsh-live-voice.settings.shortcuts.meeting': 'Toggle meeting sharing',
  'dsh-live-voice.settings.shortcuts.microphone': 'Toggle microphone',
  'dsh-live-voice.settings.shortcuts.record': 'Click to set',
  'dsh-live-voice.settings.shortcuts.recording':
    'Press a shortcut… Release to save. Escape cancels.',
  'dsh-live-voice.settings.sourceNames.help':
    'When both sources capture, these names label new transcript blocks, not individual participants. Saved on blur; blank restores Me / Them. Maximum 80 characters. Existing text is unchanged.',
  'dsh-live-voice.settings.sourceNames.microphone': 'Microphone source name',
  'dsh-live-voice.settings.sourceNames.shared': 'Shared-audio source name',
  'dsh-live-voice.settings.sourceNames.title': 'Meeting source names',
  'dsh-live-voice.settings.tabs.conversation': 'Conversation',
  'dsh-live-voice.settings.tabs.recognition': 'Speech recognition',
  'dsh-live-voice.settings.tabs.speak': 'Speech',
  'dsh-live-voice.settings.title': 'Live Voice settings',
  'dsh-live-voice.settings.whisper.hostHelp':
    'Host-wide settings. Only unauthenticated loopback HTTP URLs (localhost, 127.0.0.1, [::1]) are allowed. Loopback means the DSH host, not this browser. All health checks and audio requests run through the authenticated backend.',
  'dsh-live-voice.speak.agentContext.enabled': 'Enable agent voice context',
  'dsh-live-voice.speak.agentContext.enabledHelp':
    'When enabled, the context below tells the agent that its responses will be spoken aloud.',
  'dsh-live-voice.speak.agentContext.help':
    'This English instruction is sent to the agent only during an active voice conversation with automatic assistant speech enabled.',
  'dsh-live-voice.speak.agentContext.label': 'Agent voice context',
  'dsh-live-voice.speak.agentContext.restore': 'Restore default',
  'dsh-live-voice.speak.autoPlayback.disable': 'Disable automatic assistant speech',
  'dsh-live-voice.speak.autoPlayback.enable': 'Enable automatic assistant speech',
  'dsh-live-voice.speak.autoPlayback.enabled': 'Automatically speak new assistant messages',
  'dsh-live-voice.speak.autoPlayback.help':
    'New assistant messages are spoken automatically, even with the microphone off. Playback waits while you are speaking.',
  'dsh-live-voice.speak.autoPlayback.label': 'Automatic assistant speech',
  'dsh-live-voice.speak.autoPlayback.nextMode':
    'Next mode: {mode}. Right-click to choose an audio device.',
  'dsh-live-voice.speak.autoPlayback.remainingOne':
    'Automatic assistant speech: {state} — {count} speech segment remaining',
  'dsh-live-voice.speak.autoPlayback.remainingOther':
    'Automatic assistant speech: {state} — {count} speech segments remaining',
  'dsh-live-voice.speak.autoPlayback.status': 'Automatic assistant speech: {state}',
  'dsh-live-voice.speak.browser.automaticVoice': 'Automatic local voice',
  'dsh-live-voice.speak.browser.defaultVoice': 'default',
  'dsh-live-voice.speak.browser.label': 'Browser speech · device audio',
  'dsh-live-voice.speak.browser.name': 'Browser speech',
  'dsh-live-voice.speak.browser.outputHelp':
    'Browser speech synthesis may ignore the selected output device; this browser API normally follows the system default.',
  'dsh-live-voice.speak.browser.voice': 'Local browser voice',
  'dsh-live-voice.speak.captions.approximate': 'Approximate speech captions',
  'dsh-live-voice.speak.captions.loading': 'Preparing speech audio',
  'dsh-live-voice.speak.captions.position': 'Speech segment {index} of {total}',
  'dsh-live-voice.speak.captions.progress': 'Approximate speech progress',
  'dsh-live-voice.speak.captions.title': 'Speech and live captions',
  'dsh-live-voice.speak.engine.label': 'Speech engine',
  'dsh-live-voice.speak.engine.playbackHelp':
    'Qwen and macOS say synthesize on the DSH host; compact AAC/M4A audio plays in this browser. Browser speech synthesizes and plays on this device.',
  'dsh-live-voice.speak.filters.code.enabled': 'Filter Markdown code blocks before speaking',
  'dsh-live-voice.speak.filters.code.maxLines': 'Read code blocks up to this many lines',
  'dsh-live-voice.speak.filters.code.notice': 'Look at the code in our conversation',
  'dsh-live-voice.speak.filters.code.replacement': 'Replacement phrase for larger code blocks',
  'dsh-live-voice.speak.interruption.disabledHelp':
    'Sending another message does not stop the assistant audio you are already hearing.',
  'dsh-live-voice.speak.interruption.enabled': 'Stop assistant speech when I send a message',
  'dsh-live-voice.speak.interruption.enabledHelp':
    'Sending or steering a new user message stops current or paused assistant speech.',
  'dsh-live-voice.speak.macos.label': 'macOS say · host audio',
  'dsh-live-voice.speak.macos.name': 'macOS say',
  'dsh-live-voice.speak.macos.voice': 'macOS say voice',
  'dsh-live-voice.speak.macos.voiceHelp':
    'Enter the exact voice name used by say -v. Leave empty to use the macOS default voice. List host voices in Terminal with say -v "?".',
  'dsh-live-voice.speak.output.checking': 'Checking speech output…',
  'dsh-live-voice.speak.output.device': 'Output device',
  'dsh-live-voice.speak.output.fallbackName': 'Audio output',
  'dsh-live-voice.speak.output.stopTest': 'Stop speech test',
  'dsh-live-voice.speak.output.test': 'Test selected speech output',
  'dsh-live-voice.speak.output.testPhrase':
    'DSH Live Voice. The selected speech output is working.',
  'dsh-live-voice.speak.output.testing': 'Testing speech…',
  'dsh-live-voice.speak.playback.message': 'Speak message',
  'dsh-live-voice.speak.playback.next': 'Skip to next speech segment',
  'dsh-live-voice.speak.playback.pause': 'Pause speech',
  'dsh-live-voice.speak.playback.previous': 'Previous speech segment',
  'dsh-live-voice.speak.playback.resume': 'Resume speech',
  'dsh-live-voice.speak.playback.stop': 'Stop speaking',
  'dsh-live-voice.speak.playback.stopAll': 'Stop all speech',
  'dsh-live-voice.speak.qwen.connection': 'Qwen server connection',
  'dsh-live-voice.speak.qwen.endpoint': 'Qwen API base URL',
  'dsh-live-voice.speak.qwen.healthFailed': 'Qwen health check failed.',
  'dsh-live-voice.speak.qwen.label': 'Qwen3 TTS · local MLX server',
  'dsh-live-voice.speak.qwen.name': 'Qwen3 local',
  'dsh-live-voice.speak.qwen.requestFailed': 'Qwen settings request failed.',
  'dsh-live-voice.speak.qwen.restartRequired':
    'Qwen settings routes are not loaded. A normal DSH server restart is required to load updated plugin routes; refreshing this page alone is not enough.',
  'dsh-live-voice.speak.qwen.save': 'Save Qwen settings',
  'dsh-live-voice.speak.qwen.saved': 'Saved on the DSH host. Active Qwen requests were cancelled.',
  'dsh-live-voice.speak.qwen.signInRequired': 'Sign in to DSH to manage Qwen settings.',
  'dsh-live-voice.speak.qwen.test': 'Test Qwen server',
  'dsh-live-voice.speak.qwen.voice': 'Qwen voice',
  'dsh-live-voice.speak.qwen.voiceHelp':
    'Aiden is used by default. These preset voices are not native Brazilian Portuguese voices.',
  'dsh-live-voice.speak.qwen.voices.aiden': 'Aiden — male, American English',
  'dsh-live-voice.speak.qwen.voices.dylan': 'Dylan — male, Beijing Chinese',
  'dsh-live-voice.speak.qwen.voices.eric': 'Eric — male, Sichuan Chinese',
  'dsh-live-voice.speak.qwen.voices.onoAnna': 'Ono Anna — female, Japanese',
  'dsh-live-voice.speak.qwen.voices.ryan': 'Ryan — male, English',
  'dsh-live-voice.speak.qwen.voices.serena': 'Serena — female, Chinese',
  'dsh-live-voice.speak.qwen.voices.sohee': 'Sohee — female, Korean',
  'dsh-live-voice.speak.qwen.voices.uncleFu': 'Uncle Fu — male, Chinese',
  'dsh-live-voice.speak.qwen.voices.vivian': 'Vivian — female, Chinese',
  'dsh-live-voice.speak.rate.help': 'Relative speed: 1 is normal.',
  'dsh-live-voice.speak.rate.label': 'Speech rate',
  'dsh-live-voice.speak.responseDelay.help':
    'After you stop speaking, automatic assistant playback waits for this much continuous silence. Speaking again restarts the wait.',
  'dsh-live-voice.speak.responseDelay.label': 'Assistant response delay',
  'dsh-live-voice.speak.responseDelay.oneAndHalf': '1.5 seconds',
  'dsh-live-voice.speak.segmentGap.help':
    'Wait this many milliseconds between consecutive spoken segments. 400 ms is the default.',
  'dsh-live-voice.speak.segmentGap.label': 'Pause between speech segments',
  'dsh-live-voice.speak.status.paused': 'Speech paused',
  'dsh-live-voice.speak.status.playing': 'Speaking',
  'dsh-live-voice.speak.volume.help':
    'Speech playback only: 0% is silent; 100% is full volume (default). Microphone input is unchanged. Browser speech changes apply from the next segment.',
  'dsh-live-voice.speak.volume.label': 'Speech volume',
};

export default Object.freeze(en);
