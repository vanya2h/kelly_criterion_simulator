import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controls } from './components/Controls'
import { FanChart } from './components/FanChart'
import { LambdaCurveChart } from './components/LambdaCurveChart'
import { RunSummary } from './components/RunSummary'
import { SinglePathChart } from './components/SinglePathChart'
import { StatsTable } from './components/StatsTable'
import { TerminalHistogram } from './components/TerminalHistogram'
import { Segmented } from './components/ui'
import { useSimulation } from './hooks/useSimulation'
import { useChartTheme } from './lib/chartTheme'
import { AUTORUN_STEP_BUDGET, DEFAULT_PARAMS, randomSeed, stepCount } from './lib/params'
import { representativeIndices } from './lib/simulate'
import type { Params } from './lib/types'

type ThemeChoice = 'auto' | 'light' | 'dark'

export default function App() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [autoRun, setAutoRun] = useState(true)
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('auto')
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )
  const { state, run, cancel } = useSimulation()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (themeChoice === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = themeChoice
  }, [themeChoice])

  const theme = useChartTheme(themeChoice === 'auto' ? `auto-${systemDark}` : themeChoice)

  const patch = useCallback((p: Partial<Params>) => {
    setParams((prev) => {
      const next = { ...prev, ...p }
      // A ruin floor above the starting bankroll would end every path at bet 0.
      if (next.ruinFloor > next.C0) next.ruinFloor = next.C0
      return next
    })
  }, [])

  // The rerolled seed is written back into params so the seed input, the summary
  // tile and the simulation can never disagree. That write would otherwise queue
  // a second, redundant auto-run — this skips exactly that one.
  const skipNextAuto = useRef(false)

  /** The button: fresh dice, same parameters. */
  const runNow = useCallback(() => {
    const next = { ...params, seed: randomSeed() }
    skipNextAuto.current = true
    setParams(next)
    run(next)
  }, [params, run])

  /** Auto-run keeps the current seed, so a slider drag shows the strategy changing, not the dice. */
  const rerun = useCallback(() => run(params), [params, run])

  useEffect(() => {
    if (skipNextAuto.current) {
      skipNextAuto.current = false
      return
    }
    if (!autoRun) return
    if (stepCount(params) > AUTORUN_STEP_BUDGET) return
    const id = setTimeout(rerun, 300)
    return () => clearTimeout(id)
  }, [params, autoRun, rerun])

  const result = state.result
  const stale = state.status === 'running'

  const indices = useMemo(
    () => (result ? representativeIndices(result.classic.terminals) : null),
    [result],
  )

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Kelly criterion — constant fraction vs. capital-adaptive fraction</h1>
          <p>
            Both strategies bet a multiple λ of the Kelly-optimal fraction f* = p − q/b. Classic
            holds λ fixed at every bankroll. Adaptive slides λ along a sigmoid in current capital —
            bolder when small, calmer when large. Same odds, same coin flips; only the sizing rule
            differs.
          </p>
        </div>
        <Segmented
          ariaLabel="Colour theme"
          value={themeChoice}
          onChange={setThemeChoice}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </header>

      <div className="layout">
        <Controls
          params={params}
          patch={patch}
          onRun={runNow}
          onCancel={cancel}
          onReset={() => setParams(DEFAULT_PARAMS)}
          state={state}
          autoRun={autoRun}
          setAutoRun={setAutoRun}
        />

        <main className="content">
          <RunSummary params={params} result={result} />

          <LambdaCurveChart params={params} theme={theme} />

          {result ? (
            <div className={stale ? 'content stale' : 'content'}>
              <SinglePathChart params={result.params} theme={theme} indices={indices} />
              <FanChart result={result} theme={theme} />
              <TerminalHistogram result={result} theme={theme} />
              <StatsTable result={result} theme={theme} />
            </div>
          ) : (
            <section className="card">
              <div className="empty">
                {stale
                  ? 'Running the first simulation…'
                  : state.status === 'error'
                    ? `Simulation failed: ${state.error}`
                    : 'Run a simulation to see the results.'}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
