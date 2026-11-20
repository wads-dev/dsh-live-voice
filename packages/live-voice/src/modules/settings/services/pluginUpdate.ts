import { CURRENT_VERSION, compareVersions } from './releases.js';

export type UpdatePhase =
  'idle' | 'checking' | 'confirm' | 'installing' | 'restart' | 'done' | 'failed' | 'uncertain';
export interface UpdateSnapshot {
  phase: UpdatePhase;
  version: string;
  problem?: string;
}
/** One application-owned operation; closing Settings never starts, repeats or cancels an install. */
export function createPluginUpdate({
  manager,
  isBusy = () => false,
}: {
  manager: () => any;
  isBusy?: () => boolean;
}) {
  let state: UpdateSnapshot = { phase: 'idle', version: '' };
  let registry: string | null | undefined;
  const listeners = new Set<() => void>();
  const patch = (next: UpdateSnapshot) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const fail = (problem: string) => patch({ ...state, phase: 'failed', problem });
  const locked = () =>
    ['checking', 'installing', 'restart', 'done', 'uncertain'].includes(state.phase);
  async function eligible(api: any) {
    if (
      !api ||
      typeof api.listBundles !== 'function' ||
      typeof api.listVersions !== 'function' ||
      typeof api.updateBundle !== 'function'
    )
      return 'unavailable';
    const result = await api.listBundles();
    if (!result?.ok || !Array.isArray(result.value)) return 'unavailable';
    const bundle = result.value.find((item: any) => item.name === 'dsh-live-voice');
    // Never turn a development link, Git or tarball dependency into a registry install.
    if (!bundle?.installed || bundle.readOnlyReason || bundle.availability !== 'profile')
      return 'unavailable';
    if (bundle.update !== 'registry') return 'local';
    if (compareVersions(bundle.version || CURRENT_VERSION, state.version) >= 0) return 'current';
    const listed = await api.listVersions('dsh-live-voice', {});
    if (!listed?.ok) return 'unavailable';
    const listing = listed.value;
    if (listing?.status !== 'listed')
      return listing?.problem === 'not-found' ? 'delayed' : 'unavailable';
    const target = listing.versions?.find((item: any) => item.version === state.version);
    if (!target) return 'delayed';
    if (target.incompatible) return 'incompatible';
    if (!target.bundle || target.deprecated) return 'unavailable';
    registry = listing.registry;
    return null;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async prepare(tag: string) {
      if (locked()) return;
      const version = tag.replace(/^v/, '');
      if (
        !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version) ||
        compareVersions(version, CURRENT_VERSION) <= 0
      )
        return;
      patch({ phase: 'checking', version });
      try {
        if (isBusy()) return fail('busy');
        const problem = await eligible(manager());
        if (problem) return fail(problem);
        patch({ phase: 'confirm', version });
      } catch {
        fail('unavailable');
      }
    },
    cancel() {
      if (state.phase === 'confirm') patch({ phase: 'idle', version: '' });
    },
    async confirm() {
      if (state.phase !== 'confirm') return;
      patch({ ...state, phase: 'checking' });
      try {
        if (isBusy()) return fail('busy');
        const api = manager();
        const problem = await eligible(api);
        if (problem) return fail(problem);
        if (isBusy()) return fail('busy');
        patch({ ...state, phase: 'installing' });
        // No script approvals, shell commands, automatic retries, restart or page reload.
        const result = await api.updateBundle('dsh-live-voice', state.version, {
          registry,
          requestId: globalThis.crypto.randomUUID(),
        });
        if (!result?.ok) return patch({ ...state, phase: 'uncertain', problem: 'uncertain' });
        const update = result.value;
        const value = update?.result;
        if (!value || update.to !== state.version)
          return patch({ ...state, phase: 'uncertain', problem: 'uncertain' });
        if (update.restore) {
          const restored = ['applied', 'restart-required'].includes(update.restore.application);
          return patch({
            ...state,
            phase: 'uncertain',
            problem: restored ? 'restored' : 'restoreFailed',
          });
        }
        if (value.application === 'failed' || value.application === 'cancelled')
          return fail(
            value.error?.code === 'incompatible-version' ||
              value.packageResult?.incompatible?.length
              ? 'incompatible'
              : value.pendingBuilds?.length || value.packageResult?.kind === 'build-blocked'
                ? 'scripts'
                : ['not-found', 'no-matching-version'].includes(value.packageResult?.kind)
                  ? 'delayed'
                  : 'failed',
          );
        if (
          value.bundle !== 'dsh-live-voice' ||
          value.version !== state.version ||
          !['applied', 'restart-required'].includes(value.application)
        )
          return patch({ ...state, phase: 'uncertain', problem: 'uncertain' });
        patch({ ...state, phase: value.application === 'restart-required' ? 'restart' : 'done' });
      } catch {
        if ((state as UpdateSnapshot).phase === 'installing')
          patch({ ...state, phase: 'uncertain', problem: 'uncertain' });
        else fail('unavailable');
      }
    },
  };
}
export type PluginUpdate = ReturnType<typeof createPluginUpdate>;
