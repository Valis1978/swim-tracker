// Tiny dependency-free progress sparkline. Lower time = better, so the line going DOWN visually means improvement;
// we flip it so up = better for kid-friendly reading.
export default function Sparkline({ values, width = 120, height = 36, stroke = "#0879a0" }: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const pts = values.map((v, i) => {
    const x = pad + (i * (width - 2 * pad)) / (values.length - 1);
    // faster (lower) time plotted higher
    const y = pad + ((v - min) / span) * (height - 2 * pad);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
    </svg>
  );
}
