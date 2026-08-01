import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { sharedHistogram } from '../lib/stats'
import { fmtCapital, fmtInt, fmtPct } from '../lib/format'
import type { ChartTheme } from '../lib/chartTheme'
import type { SimResult } from '../lib/types'
import { ChartCard, Legend, Segmented } from './ui'
import { VizTooltip } from './chartBits'
import { axisProps } from './chartHelpers'

const BINS = 36

export function TerminalHistogram({ result, theme }: { result: SimResult; theme: ChartTheme }) {
  const [logBins, setLogBins] = useState(true)
  const { params, classic, adaptive } = result

  const data = useMemo(() => {
    const bins = sharedHistogram(
      classic.terminals,
      adaptive.terminals,
      BINS,
      logBins,
      fmtCapital,
    )
    return bins.map((b, k) => ({
      key: String(k),
      ...b,
      range: b.ruinBin ? 'ruined (≤ 0)' : `${fmtCapital(b.lo)} – ${fmtCapital(b.hi)}`,
    }))
  }, [classic.terminals, adaptive.terminals, logBins])

  const startBin = data.findIndex((b) => !b.ruinBin && params.C0 >= b.lo && params.C0 < b.hi)
  const tickEvery = Math.max(1, Math.ceil(data.length / 9))

  return (
    <ChartCard
      title="Terminal capital — the full distribution after the last bet"
      description={`Where all ${fmtInt(params.paths)} paths finished. Both strategies share the same bin edges, so bar heights are directly comparable; the pile to the left of "start" is the fraction of runs that lost money.`}
      tools={
        <Segmented
          ariaLabel="Bin spacing"
          value={logBins ? 'log' : 'linear'}
          onChange={(v) => setLogBins(v === 'log')}
          options={[
            { value: 'log', label: 'Log bins' },
            { value: 'linear', label: 'Linear bins' },
          ]}
        />
      }
      table={{
        columns: ['Terminal capital range', 'Classic paths', 'Adaptive paths'],
        rows: data.map((b) => [b.range, fmtInt(b.classic), fmtInt(b.adaptive)]),
      }}
      footnote={
        logBins
          ? 'Log bins: terminal wealth is roughly log-normal, so equal-width log bins are the honest view. Paths at or below zero cannot be placed on a log axis and get the dedicated "ruined" bucket at the far left.'
          : 'Linear bins: a handful of runaway paths stretch the axis and squash everything else into the first bin. Log bins usually read better.'
      }
    >
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 20, right: 12, bottom: 26, left: 0 }} barGap={2}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="key"
              interval={tickEvery - 1}
              tickFormatter={(k: string) => {
                const b = data[Number(k)]
                return b ? (b.ruinBin ? 'ruined' : fmtCapital(b.lo)) : ''
              }}
              {...axisProps(theme)}
              label={{
                value: 'terminal capital',
                position: 'insideBottom',
                offset: -14,
                fill: theme.muted,
                fontSize: 11,
              }}
            />
            <YAxis
              tickFormatter={fmtInt}
              width={54}
              {...axisProps(theme)}
              label={{
                value: 'paths',
                angle: -90,
                position: 'insideLeft',
                fill: theme.muted,
                fontSize: 11,
              }}
            />
            {startBin >= 0 && (
              <ReferenceLine
                x={String(startBin)}
                stroke={theme.axis}
                label={{
                  value: `start ${fmtCapital(params.C0)}`,
                  position: 'top',
                  fill: theme.muted,
                  fontSize: 10.5,
                }}
              />
            )}
            <Tooltip
              cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
              content={
                <VizTooltip
                  titleFmt={() => ''}
                  series={[
                    { key: 'range', label: 'Range', color: theme.muted, fmt: (v) => String(v) },
                    {
                      key: 'classic',
                      label: 'Classic',
                      color: theme.classic,
                      fmt: (v) =>
                        `${fmtInt(Number(v))} (${fmtPct(Number(v) / params.paths, 1)})`,
                    },
                    {
                      key: 'adaptive',
                      label: 'Adaptive',
                      color: theme.adaptive,
                      fmt: (v) =>
                        `${fmtInt(Number(v))} (${fmtPct(Number(v) / params.paths, 1)})`,
                    },
                  ]}
                />
              }
            />
            <Bar
              dataKey="classic"
              fill={theme.classic}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="adaptive"
              fill={theme.adaptive}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
        <Legend
          entries={[
            { label: 'Classic — constant λ', color: theme.classic, kind: 'area' },
            { label: 'Adaptive — λ(C)', color: theme.adaptive, kind: 'area' },
          ]}
        />
      </div>
    </ChartCard>
  )
}
