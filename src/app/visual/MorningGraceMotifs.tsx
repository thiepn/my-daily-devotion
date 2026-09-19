import type { SVGProps } from "react";

type MotifProps = SVGProps<SVGSVGElement>;

export function BotanicalSprig({ className = "", ...props }: MotifProps) {
  return (
    <svg className={`mg-motif mg-sprig ${className}`.trim()} viewBox="0 0 72 96" fill="none" aria-hidden="true" {...props}>
      <path d="M22 88c2-28 10-50 31-76" className="mg-motif-stem" />
      <path d="M30 62C16 64 7 58 4 45c13-3 23 3 26 17Z" className="mg-motif-leaf" />
      <path d="M38 43c13-10 24-10 33 0-8 12-19 12-33 0Z" className="mg-motif-leaf mg-motif-leaf-strong" />
      <path d="M44 29c-10-8-11-18-4-27 11 6 12 15 4 27Z" className="mg-motif-leaf mg-motif-leaf-soft" />
      <path d="M23 76c12-8 22-6 30 5-10 9-20 7-30-5Z" className="mg-motif-leaf mg-motif-leaf-soft" />
    </svg>
  );
}

export function SunriseOrnament({ className = "", ...props }: MotifProps) {
  return (
    <svg className={`mg-motif mg-sunrise ${className}`.trim()} viewBox="0 0 96 44" fill="none" aria-hidden="true" {...props}>
      <path d="M15 34h66" className="mg-motif-line" />
      <path d="M30 34a18 18 0 0 1 36 0" className="mg-motif-sun-line" />
      <path d="M48 4v8M24 14l6 6M72 14l-6 6" className="mg-motif-ray" />
    </svg>
  );
}

export function MorningLandscape({ className = "", ...props }: MotifProps) {
  return (
    <svg className={`mg-motif mg-landscape ${className}`.trim()} viewBox="0 0 720 280" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice" {...props}>
      <circle cx="575" cy="67" r="27" className="mg-landscape-sun" />
      <path d="M0 170c72-38 122-57 185-58 67-1 102 35 158 33 68-3 104-62 184-65 73-3 116 41 193 71v129H0Z" className="mg-landscape-back" />
      <path d="M0 202c72-25 131-27 194-9 70 20 112 36 186 14 66-20 113-59 181-57 66 2 105 31 159 60v70H0Z" className="mg-landscape-mid" />
      <path d="M0 236c90-21 166-8 235 6 86 18 145-7 221-13 91-7 169 20 264 34v17H0Z" className="mg-landscape-front" />
      <path d="M88 227c8-28 18-48 31-63M105 222c-5-23-4-42 2-58M610 226c-5-28-3-49 6-70M631 229c7-22 15-40 25-54" className="mg-landscape-tree-stem" />
      <path d="M118 167c-17 7-28 19-31 36 17 1 29-11 31-36ZM108 175c15 5 25 15 29 29-15 2-25-8-29-29ZM614 159c-14 7-22 17-24 31 14 1 23-9 24-31ZM620 174c13 4 22 13 25 26-13 1-21-8-25-26Z" className="mg-landscape-tree" />
    </svg>
  );
}

export function EditorialFlourish({ className = "", ...props }: MotifProps) {
  return (
    <svg className={`mg-motif mg-flourish ${className}`.trim()} viewBox="0 0 180 30" fill="none" aria-hidden="true" {...props}>
      <path d="M0 15h70M110 15h70" className="mg-motif-line" />
      <path d="M90 24c1-9 4-16 10-23M93 13c-6 0-9-3-10-8 6-1 9 2 10 8ZM96 8c5-4 9-4 12 0-3 4-7 4-12 0Z" className="mg-flourish-sprig" />
    </svg>
  );
}
