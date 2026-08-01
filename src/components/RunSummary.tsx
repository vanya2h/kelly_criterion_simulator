import { fmtCapital, fmtInt, fmtNum, fmtPct } from "../lib/format";
import { adaptiveLambda, kellyFraction, stakeFor } from "../lib/kelly";
import type { Params, SimResult } from "../lib/types";

export function RunSummary({ params, result }: { params: Params; result: SimResult | null }) {
  const fStar = kellyFraction(params.p, params.b);
  const edge = params.p * params.b - (1 - params.p);
  const minBet = params.minBetEnabled ? params.minBet : 0;

  const classicStake = stakeFor(params.lambdaConst, fStar, params.C0, params.maxFraction, minBet);
  const lam0 = adaptiveLambda(params.C0, params.lambdaMin, params.lambdaMax, params.cRef, params.steepness);
  const adaptiveStake = stakeFor(lam0, fStar, params.C0, params.maxFraction, minBet);

  // Capital below which the minimum ticket exceeds what the rule wants to bet.
  const forcedBelow = (lambda: number) => (minBet > 0 && lambda * fStar > 0 ? minBet / (lambda * fStar) : 0);

  const noEdge = fStar <= 0;
  const frictionless = !params.minBetEnabled && (!params.ruinFloorEnabled || params.ruinFloor <= 0);

  return (
    <>
      <div className="tiles">
        <Tile
          k="Kelly fraction f*"
          v={fmtNum(fStar, 4)}
          sub={`p − q/b at p=${fmtNum(params.p, 3)}, b=${fmtNum(params.b, 2)}`}
        />
        <Tile k="Edge per unit staked" v={fmtNum(edge, 4)} sub="expected profit on a stake of 1" />
        <Tile
          k="Classic stake at C₀"
          v={classicStake < 0 ? "cannot bet" : fmtCapital(classicStake)}
          sub={`${fmtPct(params.C0 > 0 && classicStake > 0 ? classicStake / params.C0 : 0, 1)} of capital`}
        />
        <Tile
          k="Adaptive stake at C₀"
          v={adaptiveStake < 0 ? "cannot bet" : fmtCapital(adaptiveStake)}
          sub={`λ(C₀) = ${fmtNum(lam0, 3)} · ${fmtPct(params.C0 > 0 && adaptiveStake > 0 ? adaptiveStake / params.C0 : 0, 1)} of capital`}
        />
        <Tile
          k="Workload"
          v={`${fmtInt(params.paths)} × ${fmtInt(params.N)}`}
          sub={`${fmtInt(params.paths * params.N)} bet-steps per strategy`}
        />
        <Tile
          k="Seed"
          v={String(params.seed)}
          sub={result ? `last run took ${fmtInt(result.elapsedMs)} ms` : "not run yet"}
        />
      </div>

      {noEdge && (
        <div className="callout crit">
          <span className="icon" aria-hidden>
            ✕
          </span>
          <span>
            <strong>No edge at these odds.</strong> f* = {fmtNum(fStar, 4)} ≤ 0, so the Kelly-optimal bet is zero and
            both strategies sit flat for the whole run. Raise <em>p</em> or <em>b</em> until p·b &gt; 1 − p.
          </span>
        </div>
      )}

      {!noEdge && params.minBetEnabled && params.minBet > 0 && (
        <div className="callout warn">
          <span className="icon" aria-hidden>
            !
          </span>
          <span>
            <strong>Minimum bet is on — this is where the two rules genuinely diverge.</strong> (Advanced settings.)
            With continuous stakes, fractional Kelly can shrink its bet forever and never truly go broke; a minimum
            ticket of {fmtCapital(params.minBet)} breaks that. Classic is forced to overbet once capital falls below{" "}
            {fmtCapital(forcedBelow(params.lambdaConst))}; adaptive, betting more when small, crosses that line lower —
            at roughly {fmtCapital(forcedBelow(params.lambdaMax))}. Below the minimum ticket a path cannot bet at all
            and is counted as ruined.
          </span>
        </div>
      )}

      {!noEdge && frictionless && (
        <div className="callout">
          <span className="icon" aria-hidden>
            i
          </span>
          <span>
            <strong>Frictionless mode.</strong> No minimum bet and no ruin floor, so capital can halve forever without
            ever reaching zero — the probability of ruin will be 0% for both strategies by construction, no matter how
            reckless λ is. Turn on the minimum bet or the ruin floor under <em>Advanced settings</em> to see real ruin
            behaviour.
          </span>
        </div>
      )}
    </>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="tile">
      <p className="k">{k}</p>
      <p className="v">{v}</p>
      <p className="sub">{sub}</p>
    </div>
  );
}
