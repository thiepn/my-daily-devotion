import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "today"
  | "bible"
  | "prayer"
  | "history"
  | "sun"
  | "moon"
  | "system"
  | "arrow"
  | "check"
  | "bookmark"
  | "note"
  | "leaf"
  | "sprig"
  | "search"
  | "plus"
  | "reflection"
  | "answered"
  | "people"
  | "highlight"
  | "share"
  | "more"
  | "settings";

const iconPaths: Record<IconName, ReactNode> = {
  today: <><path d="M3.2 12.5h13.6" /><path d="M5 12.5a5 5 0 0 1 10 0" /><path d="M10 2.8v2M4.5 5.3l1.4 1.4M15.5 5.3l-1.4 1.4" /><path d="M5.2 16h9.6" /></>,
  bible: <><path d="M3.8 4.6c2.3-.8 4.3-.4 6.2 1.1v10.8c-1.9-1.5-3.9-1.9-6.2-1.1z" /><path d="M16.2 4.6c-2.3-.8-4.3-.4-6.2 1.1v10.8c1.9-1.5 3.9-1.9 6.2-1.1z" /><path d="M10 5.7v10.8" /></>,
  prayer: <><path d="M9.2 17c-1.6-2.4-3.2-4.5-4-6.6-.5-1.3-.4-2.7.1-4l.7-1.8c.3-.8 1.4-.8 1.7 0L10 11" /><path d="M10.8 17c1.6-2.4 3.2-4.5 4-6.6.5-1.3.4-2.7-.1-4L14 4.6c-.3-.8-1.4-.8-1.7 0L10 11" /><path d="M10 3.2V11" /></>,
  history: <><path d="M5.2 3.4v13.2" /><circle cx="5.2" cy="5" r="1.1" /><circle cx="5.2" cy="10" r="1.1" /><circle cx="5.2" cy="15" r="1.1" /><path d="M8.2 5h7.2M8.2 10h5.4M8.2 15h7.2" /></>,
  sun: <><circle cx="10" cy="10" r="3" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4" /></>,
  moon: <path d="M15.8 12.8A6.4 6.4 0 0 1 7.2 4.2 6.5 6.5 0 1 0 15.8 12.8Z" />,
  system: <><rect x="2.8" y="3.8" width="14.4" height="10" rx="1.8" /><path d="M7.2 17h5.6M10 13.8V17" /></>,
  arrow: <><path d="M4 10h11" /><path d="m11.5 6.5 3.5 3.5-3.5 3.5" /></>,
  check: <path d="m5 10 3.1 3.1L15.2 6" />,
  bookmark: <path d="M5.5 3.5h9v13l-4.5-3-4.5 3z" />,
  note: <><path d="M5 3.5h7l3 3V16.5H5z" /><path d="M12 3.5v3h3M7.5 10h5M7.5 12.5h5" /></>,
  leaf: <><path d="M4 15.8C4.4 8.8 8 4.5 15.8 4c-.2 7.5-4.2 11.1-11.8 11.8Z" /><path d="M5 15c2.8-3.8 5.6-6.4 9.4-9" /></>,
  sprig: <><path d="M7 17c.7-5.3 2.5-9.7 6.2-14" /><path d="M8.4 12c-2.7.1-4.5-1.1-5.2-3.6 2.6-.5 4.5.7 5.2 3.6ZM10.4 8.2c2.5-1.9 4.7-1.9 6.6 0-1.6 2.2-3.8 2.2-6.6 0Z" /></>,
  search: <><circle cx="8.6" cy="8.6" r="5" /><path d="m12.4 12.4 4 4" /></>,
  plus: <path d="M10 4v12M4 10h12" />,
  reflection: <><path d="M5 15.8c4.1-.7 7.9-4.4 9.8-10.8-6.1 1-9.7 4.5-9.8 10.8Z" /><path d="M4 17c2.7-3.8 5.8-6.6 9.2-9" /></>,
  answered: <><circle cx="10" cy="10" r="7" /><path d="m6.8 10 2.1 2.2 4.5-4.7" /></>,
  people: <><circle cx="7" cy="7.1" r="2.3" /><circle cx="13.5" cy="7.8" r="1.8" /><path d="M2.9 16c.3-3.1 1.8-5 4.1-5s3.8 1.9 4.1 5M11.2 12c.7-.8 1.5-1.2 2.5-1.2 2 0 3.1 1.6 3.4 4.2" /></>,
  highlight: <><path d="m5 14.8 7.8-7.8 2.2 2.2-7.8 7.8H5z" /><path d="m11.8 8 2.2 2.2M4 17h8" /></>,
  share: <><path d="M10 12.5V3.8" /><path d="m6.7 7.1 3.3-3.3 3.3 3.3" /><path d="M5 10.5H3.8v5.7h12.4v-5.7H15" /></>,
  more: <><circle cx="4.5" cy="10" r=".7" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r=".7" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10" r=".7" fill="currentColor" stroke="none" /></>,
  settings: <><circle cx="10" cy="10" r="2.5" /><path d="M10 2.7v1.5M10 15.8v1.5M2.7 10h1.5M15.8 10h1.5M4.8 4.8l1.1 1.1M14.1 14.1l1.1 1.1M15.2 4.8l-1.1 1.1M5.9 14.1l-1.1 1.1" /></>,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
}

export function Icon({ name, className = "", ...props }: IconProps) {
  return (
    <svg
      className={`icon icon-${name} ${className}`.trim()}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
