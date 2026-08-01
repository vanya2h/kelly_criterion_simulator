import { useMemo, useState } from 'react'
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
} from 'recharts'
import { kellyFraction, lambdaCurve } from '../lib/kelly'
import { fmtCapital, fmtNum, fmtPct } from '../lib/format'
import type { ChartTheme } from '../lib/chartTheme'
import type { Params } from '../lib/types'
import { ChartCard, Legend, Segmented } from './ui'
import { VizTooltip } from './chartBits'
import { axisProps, endLabel } from './chartHelpers'

type Mode = 'lambda' | 'stake'

export function LambdaCurveChart({ params, theme }: { params: Params; theme: ChartTheme }) {
  const [mult, setMult] = useState<'2' | '4' | '10'>('4')
  const [mode, setMode] = useState<Mode>('lambda')

  const fStar = kellyFraction(params.p, params.b)
  const maxC = params.C0 * Number(mult)

  const data = useMemo(() => {
    const scale = mode === 'stake' ? Math.max(fStar, 0) : 1
    return lambdaCurve(params, maxC).map((d) => ({
      C: d.C,
      adaptive: d.adaptive * scale,
      classic: d.classic * scale,
      lambdaRaw: d.adaptive,
    }))
  }, [params, maxC, mode, fStar])

  const cap = params.maxFraction
  const yMax =
    mode === 'stake'
      ? Math.max(
          Math.max(params.lambdaMax, params.lambdaConst) * Math.max(fStar, 0),
          cap,
          0.01,
        ) * 1.12
      : Math.max(params.lambdaMax, params.lambdaConst, 0.05) * 1.12

  const last = data.length - 1
  const unit = mode === 'stake' ? '% of capital' : 'x Kelly'
  const fmtY = (v: number) => (mode === 'stake' ? fmtPct(v, 1) : fmtNum(v, 2))

  return (
    <ChartCard
      title="λ(C) — how aggressively each strategy sizes its bet"
      description={
        mode === 'lambda'
          ? 'The multiplier applied to the Kelly-optimal fraction f*. Classic holds one value at every bankroll; adaptive slides from λ_max when broke down to λ_min when rich.'
          : 'The same two rules expressed as the share of current capital actually staked (λ × f*), so you can see where each one runs into the safety cap.'
      }
      tools={
        <>
          <Segmented
            ariaLabel="Y axis quantity"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'lambda', label: 'λ(C)' },
              { value: 'stake', label: 'stake %' },
            ]}
          />
          <Segmented
            ariaLabel="Capital axis range"
            value={mult}
            onChange={setMult}
            options={[
              { value: '2', label: '2× C₀' },
              { value: '4', label: '4× C₀' },
              { value: '10', label: '10× C₀' },
            ]}
          />
        </>
      }
      table={{
        columns: ['Capital', mode === 'stake' ? 'Classic stake %' : 'Classic λ', mode === 'stake' ? 'Adaptive stake %' : 'Adaptive λ'],
        rows: data
          .filter((_, i) => i % 8 === 0 || i === last)
          .map((d) => [fmtCapital(d.C), fmtY(d.classic), fmtY(d.adaptive)]),
      }}
      footnote={
        fStar <= 0
          ? 'f* is not positive at these odds, so neither rule stakes anything — the stake view is flat at zero.'
          : `f* = p − q/b = ${fmtNum(fStar, 4)}. C_ref marks where the adaptive curve sits halfway between λ_min and λ_max.`
      }
    >
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 20, right: 78, bottom: 22, left: 8 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="C"
              type="number"
              domain={[0, maxC]}
              tickFormatter={fmtCapital}
              {...axisProps(theme)}
              label={{
                value: 'current capital C',
                position: 'insideBottom',
                offset: -12,
                fill: theme.muted,
                fontSize: 11,
              }}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={fmtY}
              width={58}
              {...axisProps(theme)}
            />
            {mode === 'stake' && (
              <ReferenceLine
                y={cap}
                stroke={theme.warning}
                strokeWidth={1.5}
                label={{
                  value: `safety cap ${fmtPct(cap, 0)}`,
                  position: 'insideTopRight',
                  fill: theme.muted,
                  fontSize: 10.5,
                }}
              />
            )}
            <ReferenceLine
              x={params.cRef}
              stroke={theme.axis}
              label={{ value: 'C_ref', position: 'top', fill: theme.muted, fontSize: 10.5 }}
            />
            <Tooltip
              cursor={{ stroke: theme.axis }}
              content={
                <VizTooltip
                  titleFmt={(l) => `capital ${fmtCapital(Number(l))}`}
                  series={[
                    {
                      key: 'classic',
                      label: 'Classic',
                      color: theme.classic,
                      line: true,
                      fmt: (v) => fmtY(Number(v)),
                    },
                    {
                      key: 'adaptive',
                      label: 'Adaptive',
                      color: theme.adaptive,
                      line: true,
                      fmt: (v) => fmtY(Number(v)),
                    },
                  ]}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="classic"
              stroke={theme.classic}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            >
              <LabelList content={endLabel('Classic', theme.classic, last, -6)} />
            </Line>
            <Line
              type="monotone"
              dataKey="adaptive"
              stroke={theme.adaptive}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            >
              <LabelList content={endLabel('Adaptive', theme.adaptive, last, 14)} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
        <Legend
          entries={[
            { label: `Classic — λ = ${fmtNum(params.lambdaConst, 2)} (${unit})`, color: theme.classic },
            { label: `Adaptive — λ(C) sigmoid (${unit})`, color: theme.adaptive },
          ]}
        />
      </div>
    </ChartCard>
  )
}
