import { useEffect, useState } from 'react'

export interface ChartTheme {
  classic: string
  adaptive: string
  classicSoft: string
  classicSofter: string
  adaptiveSoft: string
  adaptiveSofter: string
  grid: string
  axis: string
  muted: string
  secondary: string
  primary: string
  surface: string
  warning: string
  critical: string
}

const TOKENS: Record<keyof ChartTheme, string> = {
  classic: '--classic',
  adaptive: '--adaptive',
  classicSoft: '--classic-soft',
  classicSofter: '--classic-softer',
  adaptiveSoft: '--adaptive-soft',
  adaptiveSofter: '--adaptive-softer',
  grid: '--grid',
  axis: '--axis',
  muted: '--text-muted',
  secondary: '--text-secondary',
  primary: '--text-primary',
  surface: '--surface-1',
  warning: '--warning',
  critical: '--critical',
}

function read(): ChartTheme {
  const cs = getComputedStyle(document.documentElement)
  const out = {} as ChartTheme
  for (const [key, token] of Object.entries(TOKENS)) {
    out[key as keyof ChartTheme] = cs.getPropertyValue(token).trim()
  }
  return out
}

/**
 * Recharts wants concrete color strings, not `var(--x)` — so resolve the tokens
 * once per theme change and hand the values down.
 */
export function useChartTheme(themeKey: string): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => read())
  useEffect(() => {
    // Let the class/attribute change paint before sampling.
    const id = requestAnimationFrame(() => setTheme(read()))
    return () => cancelAnimationFrame(id)
  }, [themeKey])
  return theme
}
