import { STROKE_META, type StrokeKey } from "@/lib/strokes";
export { STROKE_META, strokeOf, type StrokeKey } from "@/lib/strokes";

// Hand-drawn glyph set derived from the pool: one line weight, round caps, water motifs.
// Stroke glyphs abstract each stroke's arm path; nav glyphs reuse the same wave language.

type P = { className?: string; size?: number; title?: string };

function Svg({ size = 24, className, title, children, viewBox = "0 0 24 24" }: P & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {children}
    </svg>
  );
}

// ---- strokes ------------------------------------------------------------------


export function StrokeGlyph({ stroke, size = 28, className }: P & { stroke: StrokeKey }) {
  const color = STROKE_META[stroke].color;
  const common = { size, className, viewBox: "0 0 32 32", title: STROKE_META[stroke].label };
  switch (stroke) {
    case "P": // breaststroke: the almond-shaped arm sweep seen from above
      return (
        <Svg {...common}>
          <g stroke={color}>
            <circle cx="16" cy="5" r="2" fill={color} />
            <path d="M16 9c-7 2-9.5 9-0 17 9.5-8 7-15 0-17z" />
            <path d="M11 15h10" opacity=".45" />
          </g>
        </Svg>
      );
    case "Z": // backstroke: arm arcing over the face-up head
      return (
        <Svg {...common}>
          <g stroke={color}>
            <path d="M4 22c3 0 3-1.6 6-1.6s3 1.6 6 1.6 3-1.6 6-1.6 3 1.6 6 1.6" />
            <path d="M8 20a8 8 0 0 1 16 0" />
            <circle cx="24.5" cy="16.5" r="1.8" fill={color} />
            <path d="M8 20l-1.5 2.5" opacity=".6" />
          </g>
        </Svg>
      );
    case "K": // freestyle: high elbow catching over the wave
      return (
        <Svg {...common}>
          <g stroke={color}>
            <path d="M4 23c3 0 3-1.6 6-1.6s3 1.6 6 1.6 3-1.6 6-1.6 3 1.6 6 1.6" />
            <path d="M7 19l7-9 9 4.5 2.5 5" />
            <circle cx="9" cy="16" r="1.8" fill={color} />
          </g>
        </Svg>
      );
    case "M": // butterfly: the name says it all
      return (
        <Svg {...common}>
          <g stroke={color}>
            <path d="M16 15C12 6 5 7 5.5 13.5S12 19 16 15z" />
            <path d="M16 15c4-9 11-8 10.5-1.5S20 19 16 15z" />
            <path d="M16 15c-2.5 3.5-5 5.5-7.5 6M16 15c2.5 3.5 5 5.5 7.5 6" opacity=".55" />
          </g>
        </Svg>
      );
    case "O": // medley: one ring, four strokes
      return (
        <Svg {...common}>
          <path d="M16 6a10 10 0 0 1 10 10" stroke="#e8504a" />
          <path d="M26 16a10 10 0 0 1-10 10" stroke="#2f7fe0" />
          <path d="M16 26A10 10 0 0 1 6 16" stroke="#0f9d74" />
          <path d="M6 16A10 10 0 0 1 16 6" stroke="#0a6182" />
          <circle cx="16" cy="16" r="2.2" fill="#c98a06" stroke="none" />
        </Svg>
      );
  }
}

// ---- navigation ------------------------------------------------------------------

export function HomeGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="16.5" cy="6.5" r="2" />
      <path d="M6 12.5l5-3.5 4 2.5" />
      <path d="M2 16c2.5 0 2.5-1.8 5-1.8s2.5 1.8 5 1.8 2.5-1.8 5-1.8 2.5 1.8 5 1.8" />
      <path d="M2 20.5c2.5 0 2.5-1.8 5-1.8s2.5 1.8 5 1.8 2.5-1.8 5-1.8 2.5 1.8 5 1.8" opacity=".5" />
    </Svg>
  );
}

export function RacesGlyph(p: P) {
  // a starting block on the pool deck
  return (
    <Svg {...p}>
      <path d="M3 20h18" />
      <path d="M6 20v-8h8.5l3.5 3.5V20" />
      <path d="M9 15.5h4" />
      <path d="M8 12V8.5" opacity=".55" />
      <path d="M8 8.5h3" opacity=".55" />
    </Svg>
  );
}

export function RecordsGlyph(p: P) {
  // stopwatch
  return (
    <Svg {...p}>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M10 3h4M12 3v3.5" />
      <path d="M12 13.5l3-2.5" />
      <path d="M18.5 6.5L20 5" />
    </Svg>
  );
}

export function OpenWaterGlyph(p: P) {
  // a turning buoy
  return (
    <Svg {...p}>
      <path d="M7.5 15a4.5 4.5 0 0 1 9 0" />
      <path d="M6.5 15h11" />
      <path d="M12 10.5V5l4 1.6L12 8.2" />
      <path d="M2 19.5c2.5 0 2.5-1.6 5-1.6s2.5 1.6 5 1.6 2.5-1.6 5-1.6 2.5 1.6 5 1.6" />
    </Svg>
  );
}

export function OverviewGlyph(p: P) {
  // lanes with swimmers at different positions
  return (
    <Svg {...p}>
      <path d="M3 6h18M3 12h18M3 18h18" opacity=".35" />
      <circle cx="15" cy="6" r="1.9" fill="currentColor" />
      <circle cx="9" cy="12" r="1.9" fill="currentColor" />
      <circle cx="18" cy="18" r="1.9" fill="currentColor" />
    </Svg>
  );
}

export function SettingsGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </Svg>
  );
}

// ---- small UI glyphs ------------------------------------------------------------------

export function ChevronGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function DocGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </Svg>
  );
}

export function ClockGlyph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function PinGlyph(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}

export function SparkGlyph(p: P) {
  // the little star used for personal bests
  return (
    <Svg {...p}>
      <path d="M12 3.5l2.4 5.1 5.6.7-4.1 3.9 1 5.5L12 16l-4.9 2.7 1-5.5L4 9.3l5.6-.7z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function MedalGlyph({ place, size = 28, className }: P & { place: 1 | 2 | 3 }) {
  const color = place === 1 ? "#f2b01e" : place === 2 ? "#9fb0bb" : "#c7783a";
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} role="img" aria-label={`${place}. místo`}>
      <path d="M9 2.5h4l2.2 7H11.2zM19 2.5h-4l-2.2 7h4z" fill={color} opacity=".55" />
      <circle cx="14" cy="17" r="8" fill={color} />
      <circle cx="14" cy="17" r="5.6" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="1.2" />
      <text x="14" y="20.6" textAnchor="middle" fontSize="10" fontWeight="800" fill="white" style={{ fontFamily: "var(--font-display), sans-serif" }}>
        {place}
      </text>
    </svg>
  );
}
