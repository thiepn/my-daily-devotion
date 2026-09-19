import type { SVGProps } from "react";

/**
 * Morning Grace brand mark:
 * Scripture (open book) + daily growth (sprig) + new mercies (morning sun).
 * Keep this geometry synchronized with public/brand-mark.svg.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <circle cx="45.5" cy="15.5" r="4.8" fill="var(--color-morning)" />
      <path d="M31.5 46.2c.8-11.5 4.2-22.4 11.2-31.5" stroke="var(--color-accent-strong)" strokeWidth="2.35" strokeLinecap="round" />
      <path d="M34.6 34.2c-5.8.3-9.4-2.2-10.8-7.5 5.5-1.1 9.3 1.4 10.8 7.5Z" fill="var(--color-accent)" />
      <path d="M37.5 26.6c5.1-3.7 9.6-3.7 13.4 0-3.4 4.5-7.8 4.5-13.4 0Z" fill="var(--color-accent-strong)" />
      <path d="M39.6 20.5c-3.7-3.2-4.2-6.7-1.5-10.5 4.1 2.1 4.6 5.6 1.5 10.5Z" fill="var(--color-brand-leaf-soft)" />
      <path d="M14 43.5c6.3-1.4 11.8-.3 17.5 3.5 5.7-3.8 11.2-4.9 18.5-3.5v9.2c-7.1-1.7-12.5-.6-18.5 3.4-6-4-11.4-5.1-17.5-3.4v-9.2Z" stroke="var(--color-accent-strong)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M31.5 47v9" stroke="var(--color-accent-strong)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
