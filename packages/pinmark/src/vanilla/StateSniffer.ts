// Best-effort snapshot of the application's global state stores (Redux, Vuex,
// Zustand) captured at pin time so the AI can inspect the exact state that
// produced the issue. All reads are defensive: if nothing is detected, the
// snapshot is `undefined` and the field is simply omitted from the pin.

export interface StateSnapshotResult {
  detected: string[];
  snapshot: Record<string, unknown>;
  error?: string;
}

const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_ARRAY = 20;
const MAX_KEYS = 30;
const MAX_FIBER_DEPTH = 15;

/** Serialize arbitrary state into a JSON-safe, truncated plain object. */
function serializeState(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'function') return '[function]';
  if (t === 'symbol') return '[symbol]';
  if (t === 'bigint') return `[bigint:${String(value)}]`;
  if (t !== 'object') {
    return t === 'string' && (value as string).length > MAX_STRING
      ? `${(value as string).slice(0, MAX_STRING)}…`
      : value;
  }
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[depth-limit]';
  seen.add(value);
  let out: unknown;
  if (Array.isArray(value)) {
    const arr: unknown[] = value.slice(0, MAX_ARRAY).map((v) => serializeState(v, depth + 1, seen));
    if (value.length > MAX_ARRAY) arr.push(`…+${value.length - MAX_ARRAY} items`);
    out = arr;
  } else {
    const obj: Record<string, unknown> = {};
    let count = 0;
    for (const key of Object.keys(value)) {
      if (count++ >= MAX_KEYS) {
        obj.__truncated = true;
        break;
      }
      obj[key] = serializeState((value as Record<string, unknown>)[key], depth + 1, seen);
    }
    out = obj;
  }
  seen.delete(value);
  return out;
}

function findStoreGlobal(names: string[]): any {
  const w = window as any;
  for (const name of names) {
    try {
      const s = w[name];
      if (s && (typeof s.getState === 'function' || s.state !== undefined)) return s;
    } catch { /* continue */ }
  }
  return undefined;
}

/** Bounded walk of the React fiber tree looking for a `<Provider store=…>`. */
function findReduxViaReactDevtools(): unknown {
  const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook || !hook.renderers) return undefined;
  let found: unknown;
  try {
    const walk = (fiber: any, depth: number): unknown => {
      if (!fiber || depth > MAX_FIBER_DEPTH) return undefined;
      const props = fiber.memoizedProps;
      if (props && props.store && typeof props.store.getState === 'function') {
        return props.store.getState();
      }
      let child = fiber.child;
      while (child) {
        const r = walk(child, depth + 1);
        if (r !== undefined) return r;
        child = child.sibling;
      }
      return undefined;
    };
    hook.renderers.forEach((_renderer: any, id: number) => {
      if (found !== undefined) return;
      const roots = hook.getFiberRoots ? hook.getFiberRoots(id) : undefined;
      if (!roots) return;
      for (const root of roots) {
        if (found !== undefined) return;
        found = walk(root.current, 0);
      }
    });
  } catch { /* fiber internals are unstable; ignore */ }
  return found;
}

/** Snapshot all detectable global stores. Returns undefined when none exist. */
export function getGlobalStateSnapshot(): StateSnapshotResult | undefined {
  try {
    const detected: string[] = [];
    const snapshot: Record<string, unknown> = {};
    const w = window as any;

    // ── Redux ──
    const reduxStore = findStoreGlobal(['store', '__store__', '__STORE__', 'reduxStore']);
    if (reduxStore && typeof reduxStore.getState === 'function') {
      try {
        snapshot.redux = serializeState(reduxStore.getState());
        detected.push('redux');
      } catch { /* ignore */ }
    } else {
      // No window-level store; look for a Redux Provider in the React tree.
      try {
        const providerState = findReduxViaReactDevtools();
        if (providerState !== undefined) {
          snapshot.redux = serializeState(providerState);
          detected.push('redux (react provider)');
        }
      } catch { /* ignore */ }
    }
    if (w.__REDUX_DEVTOOLS_EXTENSION__) {
      detected.push('redux-devtools');
      if (!snapshot.redux) {
        // The extension hook doesn't expose state directly; note its presence only.
        snapshot.reduxDevtools = { note: 'extension detected; store state not exposed via window' };
      }
    }

    // ── Vuex / Vue ──
    const vueHook = w.__VUE_DEVTOOLS_GLOBAL_HOOK__;
    if (vueHook) {
      if (vueHook.store && vueHook.store.state !== undefined) {
        try {
          snapshot.vuex = serializeState(vueHook.store.state);
          detected.push('vuex');
        } catch { /* ignore */ }
      }
      detected.push('vue-devtools');
    }
    if (!snapshot.vuex) {
      const vuexGlobal = findStoreGlobal(['$store']);
      if (vuexGlobal && vuexGlobal.state !== undefined) {
        try {
          snapshot.vuex = serializeState(vuexGlobal.state);
          detected.push('vuex');
        } catch { /* ignore */ }
      }
    }

    // ── Zustand ──
    const zustand = findStoreGlobal(['zustand', '__zustand__', 'zustandStores', 'useStore']);
    if (zustand && typeof zustand.getState === 'function') {
      try {
        snapshot.zustand = serializeState(zustand.getState());
        detected.push('zustand');
      } catch { /* ignore */ }
    }

    if (detected.length === 0) return undefined;
    return { detected, snapshot };
  } catch (e) {
    return { detected: [], snapshot: {}, error: String(e) };
  }
}
