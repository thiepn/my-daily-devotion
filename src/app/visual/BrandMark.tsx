import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}>
      <path d="M8 7.5c4.8-1.5 8.7-.9 12 1.8v23c-3.3-2.7-7.2-3.3-12-1.8v-23Z" fill="currentColor" opacity=".92" />
      <path d="M32 7.5c-4.8-1.5-8.7-.9-12 1.8v23c3.3-2.7 7.2-3.3 12-1.8v-23Z" fill="currentColor" opacity=".68" />
      <path d="M12 25c4.1-1.2 6.4.2 8 3.1 1.6-2.9 3.9-4.3 8-3.1" stroke="var(--color-accent-strong)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
