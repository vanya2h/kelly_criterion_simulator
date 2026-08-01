import type { ReactElement } from "react";

/* ------------------------------------------------------------------ */
/* Selective direct labels                                             */
/* ------------------------------------------------------------------ */

interface LabelProps {
  x?: number | string;
  y?: number | string;
  index?: number;
}

/**
 * Direct-labels the final point of a series only. A number on every point is
 * noise; the endpoint is the one that answers "which line is which".
 *
 * The two strategies routinely finish on top of each other, so callers stagger
 * `dy` in opposite directions rather than letting the labels collide.
 */
export function endLabel(text: string, color: string, lastIndex: number, dy = 4) {
  return function EndLabel(props: unknown): ReactElement | null {
    const { x, y, index } = props as LabelProps;
    if (index !== lastIndex || x == null || y == null) return null;
    return (
      <text
        x={Number(x) + 7}
        y={Number(y)}
        dy={dy}
        fill={color}
        fontSize={11}
        fontWeight={650}
        style={{ pointerEvents: "none" }}
      >
        {text}
      </text>
    );
  };
}

/** Axis/tick styling shared by every chart, kept recessive on purpose. */
export function axisProps(theme: { axis: string; muted: string }) {
  return {
    stroke: theme.axis,
    tick: { fill: theme.muted, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: theme.axis },
  } as const;
}

/** Log axes cannot show zero; clamp to a floor and say so in a footnote. */
export function logFloorFor(C0: number): number {
  return Math.max(C0 * 1e-4, 1e-6);
}
