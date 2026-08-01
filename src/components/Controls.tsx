import { useState } from "react";
import type { SimState } from "../hooks/useSimulation";
import { fmtCapital, fmtInt, fmtNum, fmtPct } from "../lib/format";
import { AUTORUN_STEP_BUDGET, stepCount } from "../lib/params";
import type { Params } from "../lib/types";
import { Field, Toggle } from "./ui";

/**
 * Everything below the fold is a knob with a defensible default. What stays
 * above it is the smallest set that still lets you ask the question the app
 * exists to answer: the odds, the horizon, and the two sizing rules.
 */
export function Controls({
  params,
  patch,
  onRun,
  onCancel,
  onReset,
  state,
  autoRun,
  setAutoRun,
}: {
  params: Params;
  patch: (p: Partial<Params>) => void;
  onRun: () => void;
  onCancel: () => void;
  onReset: () => void;
  state: SimState;
  autoRun: boolean;
  setAutoRun: (v: boolean) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const steps = stepCount(params);
  const tooBigForAuto = steps > AUTORUN_STEP_BUDGET;
  const running = state.status === "running";
  const pct = state.total ? state.done / state.total : 0;

  return (
    <aside className="controls">
      <div className="run-row">
        <button
          className="primary"
          onClick={running ? onCancel : onRun}
          title={running ? "Stop the run in flight" : "Reroll the seed and run — fresh dice"}
        >
          {running ? "Cancel" : "Run simulation"}
        </button>
      </div>
      <div className="progress" aria-hidden={!running}>
        <span style={{ width: `${running ? pct * 100 : state.result ? 100 : 0}%` }} />
      </div>
      <p className="status-line">
        {running
          ? `${fmtInt(state.done)} / ${fmtInt(state.total)} paths…`
          : state.status === "error"
            ? `Error: ${state.error}`
            : state.result
              ? `${fmtInt(state.result.params.paths)} paths in ${fmtInt(state.result.elapsedMs)} ms`
              : "Not run yet"}
        {autoRun && tooBigForAuto && " · too large to auto-run, press Run"}
      </p>

      <div className="group">
        <h2>The bet</h2>
        <Field
          label="p — win probability"
          hint="Chance each individual bet wins. Kelly only has something to say when p·b > 1 − p."
          value={params.p}
          onChange={(v) => patch({ p: v })}
          min={0.01}
          max={0.99}
          step={0.005}
          format={(v) => fmtPct(v, 1)}
        />
        <Field
          label="b — payout odds"
          hint="A win returns b × stake in profit. b = 1 is an even-money bet; b = 2 pays two-to-one."
          value={params.b}
          onChange={(v) => patch({ b: v })}
          min={0.1}
          max={10}
          step={0.1}
          format={(v) => `${fmtNum(v, 2)} : 1`}
        />
      </div>

      <div className="group">
        <h2>The run</h2>
        <Field
          label="N — bets per path"
          hint="Length of one run. Kelly's growth-rate optimality is an asymptotic claim, so short runs are noisy."
          value={params.N}
          onChange={(v) => patch({ N: Math.round(v) })}
          min={10}
          max={5000}
          step={1}
          log
          format={fmtInt}
        />
        <Field
          label="paths — Monte Carlo runs"
          hint="Independent repetitions of the whole run. One path tells you nothing; a thousand shows the distribution."
          value={params.paths}
          onChange={(v) => patch({ paths: Math.round(v) })}
          min={1}
          max={5000}
          step={1}
          log
          format={fmtInt}
        />
      </div>

      <div className="group">
        <h2>Classic strategy</h2>
        <Field
          label="λ_const — Kelly multiplier"
          hint="Constant fraction of the Kelly bet, at every bankroll. 1 is full Kelly; 0.5 is the common half-Kelly compromise."
          value={params.lambdaConst}
          onChange={(v) => patch({ lambdaConst: v })}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${fmtNum(v, 2)}×`}
        />
      </div>

      <div className="group">
        <h2>Adaptive strategy</h2>
        <Field
          label="λ_min — multiplier when rich"
          hint="What λ approaches as capital grows large. Sets how conservative the strategy becomes after it wins."
          value={params.lambdaMin}
          onChange={(v) => patch({ lambdaMin: v })}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${fmtNum(v, 2)}×`}
        />
        <Field
          label="λ_max — multiplier when broke"
          hint="What λ approaches as capital goes to zero. Above λ_min this bets harder after losses — the whole point of the rule, and its whole risk."
          value={params.lambdaMax}
          onChange={(v) => patch({ lambdaMax: v })}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${fmtNum(v, 2)}×`}
        />
      </div>

      <button type="button" className="disclosure" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
        <span className="chev" aria-hidden>
          {advanced ? "▾" : "▸"}
        </span>
        Advanced settings
        <span className="disclosure-note">{advanced ? "hide" : "shape · frictions · seed"}</span>
      </button>

      {advanced && (
        <>
          <div className="group">
            <h2>Adaptive curve shape</h2>
            <p className="group-note">λ(C) = λ_min + (λ_max − λ_min) / (1 + (C / C_ref)^steepness)</p>
            <Field
              label="C_ref — capital midpoint"
              hint="The bankroll where λ sits exactly halfway between λ_min and λ_max. Move it to slide the whole ramp."
              value={params.cRef}
              onChange={(v) => patch({ cRef: v })}
              min={1}
              max={1_000_000}
              step={1}
              log
              format={fmtCapital}
              extra={
                <button type="button" onClick={() => patch({ cRef: params.C0 })} title="Set to C₀">
                  = C₀
                </button>
              }
            />
            <Field
              label="steepness — sigmoid sharpness"
              hint="How abruptly λ switches between the two regimes around C_ref. Low is a gentle glide; high is nearly a step function."
              value={params.steepness}
              onChange={(v) => patch({ steepness: v })}
              min={0.5}
              max={10}
              step={0.1}
              format={(v) => fmtNum(v, 1)}
            />
          </div>

          <div className="group">
            <h2>Capital, frictions &amp; ruin</h2>
            <p className="group-note">
              The minimum bet is the knob that decides whether ruin is possible at all — with continuous stakes neither
              strategy can ever reach zero.
            </p>
            <Field
              label="C₀ — starting capital"
              hint="Every path begins here. Only its ratio to the minimum bet really matters."
              value={params.C0}
              onChange={(v) => patch({ C0: Math.round(v) })}
              min={100}
              max={1_000_000}
              step={1}
              log
              format={fmtCapital}
            />
            <Field
              label="max fraction of capital"
              hint="Hard ceiling on any single stake, applied to both strategies after λ · f* · C is computed."
              value={params.maxFraction}
              onChange={(v) => patch({ maxFraction: v })}
              min={0.01}
              max={1}
              step={0.01}
              format={(v) => fmtPct(v, 0)}
            />
            <div style={{ marginBottom: 8 }}>
              <Toggle
                label="Minimum bet size"
                checked={params.minBetEnabled}
                onChange={(v) => patch({ minBetEnabled: v })}
              />
            </div>
            <Field
              label="min_bet"
              hint="Smallest ticket the table will accept. A rule that wants to bet less must bet this much anyway — and a bankroll below it is out of the game."
              value={params.minBet}
              onChange={(v) => patch({ minBet: v })}
              min={0}
              max={100}
              step={0.5}
              format={fmtCapital}
              disabled={!params.minBetEnabled}
            />
            <div style={{ marginBottom: 8 }}>
              <Toggle
                label="Ruin floor"
                checked={params.ruinFloorEnabled}
                onChange={(v) => patch({ ruinFloorEnabled: v })}
              />
            </div>
            <Field
              label="ruin_floor"
              hint="Capital at or below this level ends the path and counts it as ruined."
              value={params.ruinFloor}
              onChange={(v) => patch({ ruinFloor: v })}
              min={0}
              max={Math.max(1, params.C0)}
              step={1}
              format={fmtCapital}
              disabled={!params.ruinFloorEnabled}
            />
          </div>

          <div className="group">
            <h2>Randomness</h2>
            <p className="group-note">
              <strong>Run simulation</strong> rerolls the seed, so every click is a fresh set of dice. Changing a
              parameter keeps the seed, so the charts move because the strategy changed and not because the dice did.
              Type a seed back in to reproduce that run exactly.
            </p>
            <Field
              label="seed"
              hint="Both strategies draw from this one stream, bet for bet. Always the seed actually in force."
              value={params.seed}
              onChange={(v) => patch({ seed: Math.round(v) })}
              min={0}
              max={4294967295}
              step={1}
              format={(v) => String(Math.round(v))}
            />
          </div>

          <div className="group">
            <h2>Behaviour</h2>
            <div style={{ marginBottom: 4 }}>
              <Toggle label="Auto-run on change" checked={autoRun} onChange={setAutoRun} />
            </div>
            <p className="field-hint">
              Reruns 300 ms after the last change while the job stays under {fmtInt(AUTORUN_STEP_BUDGET)} bet-steps (
              {fmtInt(steps)} right now). Larger jobs wait for the button so a slider drag cannot stall the machine.
            </p>
          </div>
        </>
      )}

      <div className="group">
        <button type="button" onClick={onReset} style={{ width: "100%" }}>
          Reset all parameters
        </button>
      </div>
    </aside>
  );
}
