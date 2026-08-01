import { type ReactNode, useId, useState } from "react";

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Show the raw value with this formatter instead of the number itself. */
  format?: (v: number) => string;
  /** Map the slider geometrically — right for ranges spanning decades. */
  log?: boolean;
  disabled?: boolean;
  /** Extra control rendered to the right of the numeric input. */
  extra?: ReactNode;
}

const SLIDER_TICKS = 1000;

export function Field({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  log = false,
  disabled = false,
  extra,
}: FieldProps) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const toSlider = (v: number) => {
    if (!log) return v;
    const lo = Math.log(Math.max(min, 1e-9));
    const hi = Math.log(max);
    return ((Math.log(Math.max(clamp(v), 1e-9)) - lo) / (hi - lo)) * SLIDER_TICKS;
  };
  const fromSlider = (s: number) => {
    if (!log) return s;
    const lo = Math.log(Math.max(min, 1e-9));
    const hi = Math.log(max);
    const v = Math.exp(lo + (s / SLIDER_TICKS) * (hi - lo));
    return step >= 1 ? Math.round(v) : v;
  };

  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <span className="field-value">{format ? format(value) : value}</span>
      </div>
      <p className="field-hint">{hint}</p>
      <div className="field-row">
        <input
          id={id}
          type="range"
          disabled={disabled}
          min={log ? 0 : min}
          max={log ? SLIDER_TICKS : max}
          step={log ? 1 : step}
          value={toSlider(value)}
          onChange={(e) => onChange(clamp(fromSlider(Number(e.target.value))))}
        />
        <input
          type="number"
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={Number(value.toPrecision(10))}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(clamp(v));
          }}
        />
        {extra}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card with a chart / table view switch                               */
/* ------------------------------------------------------------------ */

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

export function ChartCard({
  title,
  description,
  tools,
  table,
  children,
  footnote,
  stale = false,
}: {
  title: string;
  description: string;
  tools?: ReactNode;
  /** Table-view twin; every value on the chart must be reachable here. */
  table?: TableSpec;
  children: ReactNode;
  footnote?: ReactNode;
  stale?: boolean;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="card-tools">
          {tools}
          {table && (
            <Segmented
              ariaLabel="View as"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "Table" },
              ]}
            />
          )}
        </div>
      </div>
      <div className={stale ? "stale" : undefined}>
        {view === "chart" || !table ? children : <DataTable spec={table} />}
      </div>
      {footnote && <p className="note">{footnote}</p>}
    </section>
  );
}

export function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {spec.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend — always present for two or more series                      */
/* ------------------------------------------------------------------ */

export interface LegendEntry {
  label: string;
  color: string;
  kind?: "line" | "area";
  opacity?: number;
}

export function Legend({ entries }: { entries: LegendEntry[] }) {
  return (
    <div className="legend">
      {entries.map((e) => (
        <span className="legend-item" key={e.label}>
          <span
            className={e.kind === "area" ? "swatch" : "swatch line"}
            style={{ background: e.color, opacity: e.opacity ?? 1 }}
          />
          {e.label}
        </span>
      ))}
    </div>
  );
}
