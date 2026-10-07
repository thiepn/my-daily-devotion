const protections = new Set<symbol>();
const listeners = new Set<() => void>();
export const isUpdateProtected = (): boolean => protections.size > 0;
export function subscribeUpdateProtection(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function protectApplicationUpdate(): () => void {
  const token = Symbol("writing"); protections.add(token); for (const listener of listeners) listener();
  return () => { protections.delete(token); for (const listener of listeners) listener(); };
}
