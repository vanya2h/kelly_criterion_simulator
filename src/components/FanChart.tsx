import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartTheme } from "../lib/chartTheme";
import { fmtCapital, fmtInt } from "../lib/format";
import type { Band, SimResult } from "../lib/types";
import { VizTooltip } from "./chartBits";
import { axisProps, logFloorFor } from "./chartHelpers";
import { ChartCard, Legend, Segmented } from "./ui";

interface Row {
  i: number;
  band1090: [number, number];
  band2575: [number, number];
  p50: number;
  otherP50: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

function buildRows(own: Band[], other: Band[], clamp: (v: number) => number): Row[] {
  return own.map((b, k) => ({
    i: b.i,
    band1090: [clamp(b.p10), clamp(b.p90)] as [number, number],
    band2575: [clamp(b.p25), clamp(b.p75)] as [number, number],
    p50: clamp(b.p50),
    otherP50: clamp(other[k]?.p50 ?? b.p50),
    p10: b.p10,
    p25: b.p25,
    p75: b.p75,
    p90: b.p90,
  }));
}

function FanPanel({
  label,
  rows,
  color,
  otherColor,
  otherLabel,
  soft,
  softer,
  domain,
  logScale,
  theme,
  N,
  C0,
}: {
  label: string;
  rows: Row[];
  color: string;
  otherColor: string;
  otherLabel: string;
  soft: string;
  softer: string;
  domain: [number, number];
  logScale: boolean;
  theme: ChartTheme;
  N: number;
  C0: number;
}) {
  return (
    <div className="fan-panel">
      <h4 style={{ color }}>{label}</h4>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={rows} margin={{ top: 6, right: 12, bottom: 22, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="i"
            type="number"
            domain={[0, N]}
            tickFormatter={fmtInt}
            {...axisProps(theme)}
            label={{
              value: "bet number",
              position: "insideBottom",
              offset: -12,
              fill: theme.muted,
              fontSize: 11,
            }}
          />
          <YAxis
            scale={logScale ? "log" : "linear"}
            domain={domain}
            allowDataOverflow
            tickFormatter={fmtCapital}
            width={62}
            {...axisProps(theme)}
          />
          <ReferenceLine y={C0} stroke={theme.axis} />
          <Tooltip
            cursor={{ stroke: theme.axis }}
            content={
              <VizTooltip
                titleFmt={(l) => `after ${fmtInt(Number(l))} bets`}
                series={[
                  { key: "p90", label: "90th pct", color: softer, fmt: (v) => fmtCapital(Number(v)) },
                  { key: "p75", label: "75th pct", color: soft, fmt: (v) => fmtCapital(Number(v)) },
                  {
                    key: "p50",
                    label: "median",
                    color,
                    line: true,
                    fmt: (v) => fmtCapital(Number(v)),
                  },
                  { key: "p25", label: "25th pct", color: soft, fmt: (v) => fmtCapital(Number(v)) },
                  { key: "p10", label: "10th pct", color: softer, fmt: (v) => fmtCapital(Number(v)) },
                  {
                    key: "otherP50",
                    label: `${otherLabel} median`,
                    color: otherColor,
                    line: true,
                    fmt: (v) => fmtCapital(Number(v)),
                  },
                ]}
              />
            }
          />
          <Area dataKey="band1090" stroke="none" fill={softer} isAnimationActive={false} activeDot={false} />
          <Area dataKey="band2575" stroke="none" fill={soft} isAnimationActive={false} activeDot={false} />
          <Line
            dataKey="otherP50"
            stroke={otherColor}
            strokeWidth={1.5}
            strokeOpacity={0.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line dataKey="p50" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FanChart({ result, theme }: { result: SimResult; theme: ChartTheme }) {
  const [logScale, setLogScale] = useState(true);
  const { params, classic, adaptive } = result;
  const floor = logFloorFor(params.C0);

  const { classicRows, adaptiveRows, domain } = useMemo(() => {
    const clamp = (v: number) => (logScale ? Math.max(v, floor) : Math.max(v, 0));
    const c = buildRows(classic.bands, adaptive.bands, clamp);
    const a = buildRows(adaptive.bands, classic.bands, clamp);
    let hi = params.C0;
    let lo = params.C0;
    for (const r of [...c, ...a]) {
      hi = Math.max(hi, r.band1090[1]);
      lo = Math.min(lo, r.band1090[0]);
    }
    const d: [number, number] = logScale ? [Math.max(lo / 1.3, floor), hi * 1.15] : [0, hi * 1.05];
    return { classicRows: c, adaptiveRows: a, domain: d };
  }, [classic.bands, adaptive.bands, logScale, floor, params.C0]);

  const shared = { domain, logScale, theme, N: params.N, C0: params.C0 };

  return (
    <ChartCard
      title="Monte Carlo fan — where the whole distribution goes"
      description={`Median with 25–75 and 10–90 percentile bands across ${fmtInt(params.paths)} independent paths. Both panels share one capital axis, so the widths are directly comparable.`}
      tools={
        <Segmented
          ariaLabel="Capital axis scale"
          value={logScale ? "log" : "linear"}
          onChange={(v) => setLogScale(v === "log")}
          options={[
            { value: "log", label: "Log" },
            { value: "linear", label: "Linear" },
          ]}
        />
      }
      table={{
        columns: [
          "Bet #",
          "Classic p10",
          "Classic median",
          "Classic p90",
          "Adaptive p10",
          "Adaptive median",
          "Adaptive p90",
        ],
        rows: classic.bands.map((b, k) => [
          fmtInt(b.i),
          fmtCapital(b.p10),
          fmtCapital(b.p50),
          fmtCapital(b.p90),
          fmtCapital(adaptive.bands[k].p10),
          fmtCapital(adaptive.bands[k].p50),
          fmtCapital(adaptive.bands[k].p90),
        ]),
      }}
      footnote={
        logScale
          ? `Log axis clamps at ${fmtCapital(floor)} — a band touching the bottom edge means a tenth or more of the paths are at or near zero.`
          : "Linear axis: the top decile of a compounding process dwarfs the median, so most of the plot will look flat. Switch to log to read the typical path."
      }
    >
      <div className="fan-grid">
        <FanPanel
          {...shared}
          label="Classic — constant λ"
          rows={classicRows}
          color={theme.classic}
          otherColor={theme.adaptive}
          otherLabel="Adaptive"
          soft={theme.classicSoft}
          softer={theme.classicSofter}
        />
        <FanPanel
          {...shared}
          label="Adaptive — λ(C)"
          rows={adaptiveRows}
          color={theme.adaptive}
          otherColor={theme.classic}
          otherLabel="Classic"
          soft={theme.adaptiveSoft}
          softer={theme.adaptiveSofter}
        />
      </div>
      <Legend
        entries={[
          { label: "Classic median", color: theme.classic },
          { label: "Adaptive median", color: theme.adaptive },
          { label: "25–75 percentile band (panel colour)", color: theme.secondary, kind: "area", opacity: 0.35 },
          { label: "10–90 percentile band (panel colour)", color: theme.secondary, kind: "area", opacity: 0.18 },
        ]}
      />
      <p className="note">
        In each panel the bold line is that panel&apos;s own median and the thin, faded line is the other
        strategy&apos;s median, drawn for direct comparison.
      </p>
    </ChartCard>
  );
}
