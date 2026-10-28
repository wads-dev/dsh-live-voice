export function resolveConversationStatus(
  state: any,
  remaining: number | null,
  language: any,
): string {
  const { commons, recognition, settings } = language;
  if (state.inputRecovery?.retrying) return commons.status.recovering();
  if (
    state.inputRecovery ||
    state.inputError ||
    (!state.listening && state.error && !state.speechError)
  )
    return commons.status.stopped();
  const requests = state.pendingTranscriptionRequests ?? state.pendingTranscriptions ?? 0;
  if (state.listening && state.muted) return recognition.status.waitingCommand();
  if (state.answeringQuestion && state.recognizing) return recognition.status.answer();
  if (state.answeringQuestion && state.listening) return recognition.status.awaitingAnswer();
  if (remaining) return settings.autoSend.countdown({ remaining });
  if (state.starting) return recognition.microphone.starting();
  if (state.listening) {
    if (state.recognizing)
      return requests > 0
        ? recognition.status.listeningProcessing()
        : recognition.status.listening();
    return requests > 0 ? recognition.status.processing() : recognition.status.waiting();
  }
  if (state.recognizing || requests > 0) return recognition.status.processing();
  if (state.conversation) return commons.conversation.idle();
  return commons.status.ready();
}
