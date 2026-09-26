import dawn from '../../assets/morning-grace/dawn.webp';
import botanical from '../../assets/morning-grace/olive-sprig.webp';

/** Locally bundled art. Variants own crop/composition, never viewport visibility.
 * Bible/history variants are available for subsequent screen phases; they do not
 * imply that those screens have received their final contextual illustrations.
 */
export function MorningGraceArtwork({ variant = 'morning', className = '' }: {
  variant?: 'morning' | 'context' | 'reflection' | 'botanical'; className?: string;
}) {
  return <picture className={`grace-art grace-art--${variant} ${className}`} aria-hidden="true">
    <img src={variant === 'botanical' ? botanical : dawn} alt="" width={variant === 'botanical' ? 480 : 1200} height={variant === 'botanical' ? 505 : 800} decoding="async" fetchPriority={variant === 'morning' ? 'high' : 'auto'} />
  </picture>;
}
