import { useEffect } from 'react';

/**
 * Lightweight cross-component dirty-state registry. Sub-panels register
 * themselves while they have unsaved edits; navigation surfaces (Manage
 * tabs, browser unload) check the registry before letting the user move.
 *
 * No React context or prop drilling — keys are panel ids and registration
 * just toggles a Set. `useDirty(key, isDirty)` is the only API panels
 * should need.
 */

const dirtyKeys = new Set<string>();
let beforeUnloadInstalled = false;

const installBeforeUnload = () => {
  if (beforeUnloadInstalled) return;
  beforeUnloadInstalled = true;
  window.addEventListener('beforeunload', (e) => {
    if (dirtyKeys.size === 0) return;
    e.preventDefault();
    // Spec requires returnValue to be set; the browser ignores the message
    // these days but presence of this line triggers the prompt.
    e.returnValue = '';
  });
};

export const isAnythingDirty = (): boolean => dirtyKeys.size > 0;

export const useDirty = (key: string, dirty: boolean): void => {
  useEffect(() => {
    installBeforeUnload();
    if (dirty) dirtyKeys.add(key);
    else dirtyKeys.delete(key);
    return () => { dirtyKeys.delete(key); };
  }, [key, dirty]);
};

/**
 * Synchronous user prompt used by navigation surfaces. Returns true if
 * the user is OK abandoning unsaved edits (or there are none).
 */
export const confirmDiscardIfDirty = (): boolean => {
  if (dirtyKeys.size === 0) return true;
  return window.confirm(
    'You have unsaved changes. Leave anyway and discard them?',
  );
};
