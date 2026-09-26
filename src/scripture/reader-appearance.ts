import { useEffect, useRef, useState } from 'react';
import { db } from '../data/database';
import { nowInstant } from '../domain/identity';

export interface ReaderAppearance {
  font: 'literary' | 'classic' | 'sans';
  scale: number;
  leading: 'comfortable' | 'close' | 'generous';
}

export const DEFAULT_READER_APPEARANCE: ReaderAppearance = { font: 'literary', scale: 1, leading: 'comfortable' };
const preferenceKey = 'reader-appearance';

/** Imported preferences remain untrusted; invalid fields fall back independently. */
export function readReaderAppearance(value: unknown): ReaderAppearance {
  const candidate = value && typeof value === 'object' ? value as Partial<ReaderAppearance> : {};
  return {
    font: candidate.font === 'classic' || candidate.font === 'sans' ? candidate.font : 'literary',
    scale: typeof candidate.scale === 'number' && Number.isFinite(candidate.scale) && candidate.scale >= .9 && candidate.scale <= 1.5 ? candidate.scale : 1,
    leading: candidate.leading === 'close' || candidate.leading === 'generous' ? candidate.leading : 'comfortable',
  };
}

export function useReaderAppearance() {
  const [appearance, setAppearance] = useState(DEFAULT_READER_APPEARANCE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const writes = useRef(Promise.resolve());
  const currentWrite = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void db.preferences.get(preferenceKey).then(record => {
      if (!cancelled) setAppearance(readReaderAppearance(record?.value));
    }).catch(() => {
      if (!cancelled) setError('Reading settings could not be loaded. You can still adjust this view.');
    }).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  const update = (next: ReaderAppearance) => {
    const value = readReaderAppearance(next);
    const version = ++currentWrite.current;
    setAppearance(value);
    setError('');
    // Preserve the most recent choice when several controls change quickly.
    writes.current = writes.current.then(async () => {
      await db.preferences.put({ key: preferenceKey, value, updatedAt: nowInstant() });
    }).catch(() => {
      if (version === currentWrite.current) setError('This view changed, but settings could not be saved. Try again.');
    });
  };
  return { appearance, ready, error, update };
}
