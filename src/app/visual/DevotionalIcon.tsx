import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { BooksIcon } from "@phosphor-icons/react/dist/csr/Books";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { HandsPrayingIcon } from "@phosphor-icons/react/dist/csr/HandsPraying";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import type { IconProps } from '@phosphor-icons/react';

const icons = { today: HouseIcon, bible: BookOpenIcon, prayer: HandsPrayingIcon, history: ClockIcon, sun: SunIcon, profile: UserIcon, plan: BooksIcon, arrow: ArrowRightIcon, chevron: CaretRightIcon, check: CheckIcon };
export type DevotionalIconName = keyof typeof icons;

export function DevotionalIcon({ name, active = false, className = '', ...props }: IconProps & { name: DevotionalIconName; active?: boolean }) {
  const Glyph = icons[name];
  return <Glyph className={`devotional-icon ${className}`} weight={active ? 'fill' : 'light'} aria-hidden="true" focusable="false" {...props} />;
}
