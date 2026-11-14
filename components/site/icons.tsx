/**
 * Lucide icons used by the design (README "Assets"), inlined as SVG so no icon package ships to
 * pages that only need a handful. Paths from lucide.dev (ISC licence).
 */
type IconProps = { size?: number; className?: string; label?: string };

function Svg({ size = 18, className, label, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Svg>
);
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14M12 5v14" /></Svg>
);
export const MinusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
);
export const LocateIcon = (p: IconProps) => (
  <Svg {...p}><path d="M2 12h3M19 12h3M12 2v3M12 19v3" /><circle cx="12" cy="12" r="7" /></Svg>
);
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </Svg>
);
export const MaximizeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Svg>
);
export const FilterIcon = (p: IconProps) => (
  <Svg {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></Svg>
);
export const FlameIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Svg>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m12 19-7-7 7-7M19 12H5" /></Svg>
);
