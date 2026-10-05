import dawn from '../../assets/morning-grace/dawn.webp';
import botanical from '../../assets/morning-grace/olive-sprig.webp';
import bibleContext from '../../assets/morning-grace/bible-context.webp';
import historyReflection from '../../assets/morning-grace/history-reflection.webp';
import evening from '../../assets/morning-grace/evening-valley.webp';
import eveningContext from '../../assets/morning-grace/evening-context.webp';
import eveningReflection from '../../assets/morning-grace/evening-reflection.webp';
import { useEffectiveTheme } from './useEffectiveTheme';

/** Locally bundled art. Variants own crop/composition, never viewport visibility. */
export function MorningGraceArtwork({ variant = 'morning', className = '' }: {
  variant?: 'morning' | 'context' | 'reflection' | 'botanical'; className?: string;
}) {
  const dark = useEffectiveTheme();
  const source = variant === 'botanical' ? botanical : variant === 'context' ? dark ? eveningContext : bibleContext : variant === 'reflection' ? dark ? eveningReflection : historyReflection : dark ? evening : dawn;
  return <picture className={`grace-art grace-art--${variant} ${className}`} data-art-theme={dark ? 'evening' : 'day'} aria-hidden="true">
    <img src={source} alt="" width={variant === 'botanical' ? 480 : 1200} height={variant === 'botanical' ? 505 : variant === 'context' ? 470 : variant === 'reflection' ? 500 : 800} decoding="async" fetchPriority={variant === 'morning' || variant === 'context' ? 'high' : 'auto'} />
  </picture>;
}
