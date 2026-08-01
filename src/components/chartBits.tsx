/* ------------------------------------------------------------------ */
/* Shared tooltip                                                      */
/* ------------------------------------------------------------------ */

export interface TooltipSeries {
  /** Key into the hovered datum. */
  key: string;
  label: string;
  color: string;
  fmt: (v: unknown) => string;
  /** Rendered as a line swatch instead of a block. */
  line?: boolean;
}

interface Injected {
  active?: boolean;
  label?: string | number;
  payload?: { payload?: Record<string, unknown> }[];
}

/**
 * One tooltip shape for every chart in the app. Reads the hovered *datum* rather
 * than the payload entries so a tooltip can show values the chart doesn't plot.
 */
export function VizTooltip({
  active,
  label,
  payload,
  series,
  titleFmt,
}: Injected & { series: TooltipSeries[]; titleFmt: (label: unknown) => string }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="tt">
      {titleFmt(label) && <div className="tt-title">{titleFmt(label)}</div>}
      {series.map((s) => (
        <div className="tt-row" key={s.key}>
          <span className="lbl">
            <span className={s.line ? "swatch line" : "swatch"} style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
          <span className="val">{s.fmt(datum[s.key])}</span>
        </div>
      ))}
    </div>
  );
}
