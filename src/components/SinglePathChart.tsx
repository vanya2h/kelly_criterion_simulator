import { useMemo, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartTheme } from "../lib/chartTheme";
import { fmtCapital, fmtInt } from "../lib/format";
import { simulateSinglePath } from "../lib/simulate";
import { downsample } from "../lib/stats";
import type { Params } from "../lib/types";
import { VizTooltip } from "./chartBits";
import { axisProps, endLabel, logFloorFor } from "./chartHelpers";
import { ChartCard, Legend, Segmented } from "./ui";

type Pick = "median" | "best" | "worst" | "custom";

export function SinglePathChart({
  params,
  theme,
  indices,
}: {
  params: Params;
  theme: ChartTheme;
  /** Path indices of interest from the last Monte Carlo run, if there is one. */
  indices: { median: number; best: number; worst: number } | null;
}) {
  const [pick, setPick] = useState<Pick>("median");
  const [custom, setCustom] = useState(0);
  const [logScale, setLogScale] = useState(true);

  const pathIndex =
    pick === "custom" || !indices ? Math.min(Math.max(0, custom), Math.max(0, params.paths - 1)) : indices[pick];

  const trace = useMemo(() => simulateSinglePath(params, pathIndex), [params, pathIndex]);

  const floor = logFloorFor(params.C0);

  const data = useMemo(() => {
    // A log axis cannot render 0, so ruined paths are pinned to the floor.
    const clamp = (v: number) => (logScale ? Math.max(v, floor) : v);
    const rows = [];
    for (let i = 0; i <= params.N; i++) {
      rows.push({
        i,
        classic: clamp(trace.classic[i]),
        adaptive: clamp(trace.adaptive[i]),
        classicRaw: trace.classic[i],
        adaptiveRaw: trace.adaptive[i],
      });
    }
    return downsample(rows, 700);
  }, [trace, params.N, logScale, floor]);

  const last = data.length - 1;
  let hi = params.C0;
  let lo = params.C0;
  for (const d of data) {
    hi = Math.max(hi, d.classic, d.adaptive);
    lo = Math.min(lo, d.classic, d.adaptive);
  }
  // Fit the log axis to the data, not to the clamp floor — otherwise a run that
  // never goes near zero still gets decades of empty axis underneath it.
  const domain: [number, number] = logScale ? [Math.max(floor, lo / 1.4), hi * 1.15] : [0, hi * 1.05];

  const finalClassic = trace.classic[params.N];
  const finalAdaptive = trace.adaptive[params.N];

  return (
    <ChartCard
      title="One path, both strategies, identical coin flips"
      description="Both rules see the exact same sequence of wins and losses — every gap between the curves is the sizing rule, never luck."
      tools={
        <>
          <Segmented
            ariaLabel="Which path"
            value={pick}
            onChange={setPick}
            options={[
              { value: "median", label: "Median" },
              { value: "best", label: "Best" },
              { value: "worst", label: "Worst" },
              { value: "custom", label: "#" },
            ]}
          />
          {pick === "custom" && (
            <input
              type="number"
              min={0}
              max={Math.max(0, params.paths - 1)}
              value={custom}
              onChange={(e) => setCustom(Number(e.target.value) || 0)}
              aria-label="Path index"
            />
          )}
          <Segmented
            ariaLabel="Capital axis scale"
            value={logScale ? "log" : "linear"}
            onChange={(v) => setLogScale(v === "log")}
            options={[
              { value: "log", label: "Log" },
              { value: "linear", label: "Linear" },
            ]}
          />
        </>
      }
      table={{
        columns: ["Bet #", "Classic capital", "Adaptive capital"],
        rows: downsample(data, 120).map((d) => [fmtInt(d.i), fmtCapital(d.classicRaw), fmtCapital(d.adaptiveRaw)]),
      }}
      footnote={
        <>
          Path #{pathIndex}
          {indices && pick !== "custom" ? ` — the ${pick} path by classic terminal capital` : ""}.{" "}
          {trace.classicRuinStep >= 0 && `Classic ruined at bet ${fmtInt(trace.classicRuinStep)}. `}
          {trace.adaptiveRuinStep >= 0 && `Adaptive ruined at bet ${fmtInt(trace.adaptiveRuinStep)}. `}
          {logScale && `Log axis clamps at ${fmtCapital(floor)}; ruined paths flatten there.`}
        </>
      }
    >
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 82, bottom: 22, left: 8 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="i"
              type="number"
              domain={[0, params.N]}
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
            <ReferenceLine
              y={params.C0}
              stroke={theme.axis}
              label={{
                value: "start",
                position: "insideTopLeft",
                fill: theme.muted,
                fontSize: 10.5,
              }}
            />
            {trace.classicRuinStep >= 0 && (
              <ReferenceLine x={trace.classicRuinStep} stroke={theme.classic} strokeWidth={1} />
            )}
            {trace.adaptiveRuinStep >= 0 && (
              <ReferenceLine x={trace.adaptiveRuinStep} stroke={theme.adaptive} strokeWidth={1} />
            )}
            <Tooltip
              cursor={{ stroke: theme.axis }}
              content={
                <VizTooltip
                  titleFmt={(l) => `after ${fmtInt(Number(l))} bets`}
                  series={[
                    {
                      key: "classicRaw",
                      label: "Classic",
                      color: theme.classic,
                      line: true,
                      fmt: (v) => fmtCapital(Number(v)),
                    },
                    {
                      key: "adaptiveRaw",
                      label: "Adaptive",
                      color: theme.adaptive,
                      line: true,
                      fmt: (v) => fmtCapital(Number(v)),
                    },
                  ]}
                />
              }
            />
            <Line
              type="linear"
              dataKey="classic"
              stroke={theme.classic}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            >
              <LabelList content={endLabel(fmtCapital(finalClassic), theme.classic, last, -6)} />
            </Line>
            <Line
              type="linear"
              dataKey="adaptive"
              stroke={theme.adaptive}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            >
              <LabelList content={endLabel(fmtCapital(finalAdaptive), theme.adaptive, last, 14)} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
        <Legend
          entries={[
            { label: "Classic — constant λ", color: theme.classic },
            { label: "Adaptive — λ(C)", color: theme.adaptive },
          ]}
        />
      </div>
    </ChartCard>
  );
}
