import { describe, expect, it } from 'vitest';
import { DEFAULT_READER_APPEARANCE, readReaderAppearance } from './reader-appearance';

describe('reader appearance from stored or imported preferences', () => {
  it('accepts valid choices without changing them', () => {
    expect(readReaderAppearance({ font: 'sans', scale: 1.4, leading: 'generous' })).toEqual({ font: 'sans', scale: 1.4, leading: 'generous' });
  });
  it.each([null, undefined, '', 42, [], { font: 'remote-font', scale: Infinity, leading: 'zero' }])('recovers invalid preference data: %j', value => {
    expect(readReaderAppearance(value)).toEqual(DEFAULT_READER_APPEARANCE);
  });
  it.each([-1, 0, .8, 2, NaN, '1.2'])('rejects unsafe size %s while retaining valid independent choices', scale => {
    expect(readReaderAppearance({ font: 'classic', scale, leading: 'close' })).toEqual({ font: 'classic', scale: 1, leading: 'close' });
  });
});
