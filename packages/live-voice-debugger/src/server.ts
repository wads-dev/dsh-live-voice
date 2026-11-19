/**
 * Fail closed: tool execution is scoped to an Agent, not the browser tab that
 * initiated a turn. Until DSH exposes verifiable turn-to-tab provenance, the
 * host must not register tools that read a tab-local debugger or its journal.
 * A tool call ID or recording ID alone is not such provenance.
 */
export const name = 'dsh-live-voice-debugger';
export function apply() {}
