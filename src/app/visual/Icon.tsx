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
  | "note";

const iconPaths: Record<IconName, ReactNode> = {
  today: <><path d="M5 3v3M15 3v3M3.5 8.5h13" /><rect x="3.5" y="5" width="13" height="12" rx="2" /><path d="M6.5 11h2M11.5 11h2M6.5 14h2" /></>,
  bible: <><path d="M4 4.5c2.2-.7 4-.4 6 1.1v11c-2-1.5-3.8-1.8-6-1.1z" /><path d="M16 4.5c-2.2-.7-4-.4-6 1.1v11c2-1.5 3.8-1.8 6-1.1z" /></>,
  prayer: <><path d="M7 3.5v5.8c0 1.6 1.3 2.9 3 2.9s3-1.3 3-2.9V3.5" /><path d="M5.2 8.7v.8c0 2.7 2.1 4.9 4.8 4.9s4.8-2.2 4.8-4.9v-.8M10 14.4v2.6" /></>,
  history: <><path d="M4 6.2A7 7 0 1 1 3.7 14" /><path d="M4 2.8v3.8h3.8M10 6v4.3l2.7 1.6" /></>,
  sun: <><circle cx="10" cy="10" r="3" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4" /></>,
  moon: <path d="M15.8 12.8A6.4 6.4 0 0 1 7.2 4.2 6.5 6.5 0 1 0 15.8 12.8Z" />,
  system: <><rect x="2.8" y="3.8" width="14.4" height="10" rx="1.8" /><path d="M7.2 17h5.6M10 13.8V17" /></>,
  arrow: <><path d="M4 10h11" /><path d="m11.5 6.5 3.5 3.5-3.5 3.5" /></>,
  check: <path d="m5 10 3.1 3.1L15.2 6" />,
  bookmark: <path d="M5.5 3.5h9v13l-4.5-3-4.5 3z" />,
  note: <><path d="M5 3.5h7l3 3V16.5H5z" /><path d="M12 3.5v3h3M7.5 10h5M7.5 12.5h5" /></>,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
}

export function Icon({ name, className = "", ...props }: IconProps) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
