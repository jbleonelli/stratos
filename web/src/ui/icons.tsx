// Minimal inline-SVG icon set for the Adaptiv shell + primitives. Stroke icons
// inherit `currentColor`; size is a single px value (square).
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  style?: CSSProperties;
  strokeWidth?: number;
}

function svg(path: React.ReactNode, { size = 16, style, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', ...style }}
      aria-hidden
    >
      {path}
    </svg>
  );
}

export const Icon = {
  overview: (p: IconProps) =>
    svg(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>,
      p,
    ),
  events: (p: IconProps) => svg(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />, p),
  building: (p: IconProps) =>
    svg(
      <>
        <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
        <path d="M15 9h4a1 1 0 0 1 1 1v11M3 21h18" />
        <path d="M8 8h0M11 8h0M8 12h0M11 12h0M8 16h0M11 16h0" />
      </>,
      p,
    ),
  device: (p: IconProps) =>
    svg(
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
      </>,
      p,
    ),
  asks: (p: IconProps) =>
    svg(
      <>
        <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />
      </>,
      p,
    ),
  agent: (p: IconProps) =>
    svg(
      <>
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 8V4M9 2h6" />
        <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
      </>,
      p,
    ),
  incident: (p: IconProps) =>
    svg(
      <>
        <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>,
      p,
    ),
  activity: (p: IconProps) =>
    svg(
      <>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </>,
      p,
    ),
  insights: (p: IconProps) =>
    svg(
      <>
        <path d="M3 3v18h18" />
        <path d="M7 16V9M12 16V5M17 16v-3" />
      </>,
      p,
    ),
  admin: (p: IconProps) =>
    svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </>,
      p,
    ),
  people: (p: IconProps) =>
    svg(
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>,
      p,
    ),
  warn: (p: IconProps) =>
    svg(
      <>
        <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>,
      p,
    ),
  reload: (p: IconProps) =>
    svg(
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" />
        <path d="M21 3v6h-6" />
      </>,
      p,
    ),
  signout: (p: IconProps) =>
    svg(
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>,
      p,
    ),
  sun: (p: IconProps) =>
    svg(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
      p,
    ),
  moon: (p: IconProps) => svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />, p),
  plus: (p: IconProps) => svg(<path d="M12 5v14M5 12h14" />, p),
  contract: (p: IconProps) =>
    svg(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>,
      p,
    ),
  hypervisor: (p: IconProps) =>
    svg(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <path d="M6.5 10v4M17.5 10v4M3 17h18" />
      </>,
      p,
    ),
  mail: (p: IconProps) =>
    svg(
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7" />
      </>,
      p,
    ),
};
