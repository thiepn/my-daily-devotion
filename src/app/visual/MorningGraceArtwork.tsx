import dawn from '../../assets/morning-grace/dawn.webp';
import botanical from '../../assets/morning-grace/olive-sprig.webp';
import bibleContext from '../../assets/morning-grace/bible-context.webp';
import historyReflection from '../../assets/morning-grace/history-reflection.webp';

/** Locally bundled art. Variants own crop/composition, never viewport visibility. */
export function MorningGraceArtwork({ variant = 'morning', className = '' }: {
  variant?: 'morning' | 'context' | 'reflection' | 'botanical'; className?: string;
}) {
  return <picture className={`grace-art grace-art--${variant} ${className}`} aria-hidden="true">
    <img src={variant === 'botanical' ? botanical : variant === 'context' ? bibleContext : variant === 'reflection' ? historyReflection : dawn} alt="" width={variant === 'botanical' ? 480 : 1200} height={variant === 'botanical' ? 505 : variant === 'context' ? 470 : variant === 'reflection' ? 500 : 800} decoding="async" fetchPriority={variant === 'morning' || variant === 'context' ? 'high' : 'auto'} />
  </picture>;
}
