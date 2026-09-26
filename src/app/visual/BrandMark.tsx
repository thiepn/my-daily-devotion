import type { ImgHTMLAttributes } from "react";

/**
 * User-approved cream/forest book, cross and morning sun.
 * All sizes derive from design/brand/cream-forest-master.png.
 */
export function BrandMark(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img width="64" height="64" alt="" aria-hidden="true" {...props} src={`${import.meta.env.BASE_URL}icons/icon-192.png`} />;
}
