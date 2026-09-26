import { ArrowRightIcon, BookOpenIcon, BooksIcon, CaretRightIcon, CheckIcon, ClockIcon, HandsPrayingIcon, HouseIcon, SunIcon, UserIcon } from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';

const icons = { today: HouseIcon, bible: BookOpenIcon, prayer: HandsPrayingIcon, history: ClockIcon, sun: SunIcon, profile: UserIcon, plan: BooksIcon, arrow: ArrowRightIcon, chevron: CaretRightIcon, check: CheckIcon };
export type DevotionalIconName = keyof typeof icons;

export function DevotionalIcon({ name, active = false, className = '', ...props }: IconProps & { name: DevotionalIconName; active?: boolean }) {
  const Glyph = icons[name];
  return <Glyph className={`devotional-icon ${className}`} weight={active ? 'fill' : 'light'} aria-hidden="true" focusable="false" {...props} />;
}
