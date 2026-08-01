import { useCallback, useEffect, useRef, useState } from "react";
import { runSimulation } from "../lib/simulate";
import type { Params, SimResult } from "../lib/types";
import type { WorkerResponse } from "../sim.worker";
import SimWorker from "../sim.worker?worker&inline";

export interface SimState {
  status: "idle" | "running" | "done" | "error";
  /** Paths completed in the current run. */
  done: number;
  total: number;
  result: SimResult | null;
  error: string | null;
}

const INITIAL: SimState = { status: "idle", done: 0, total: 0, result: null, error: null };

/**
 * Runs the Monte Carlo in a worker so a 5,000 x 5,000 job cannot freeze the UI.
 * Starting a new run kills the in-flight worker outright — that is the only way
 * to cancel a tight synchronous loop, and it is instant.
 */
export function useSimulation() {
  const [state, setState] = useState<SimState>(INITIAL);
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);

  const kill = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => kill, [kill]);

  /**
   * Fallback for environments that refuse to construct the inlined worker —
   * some browsers block blob workers on a `file://` page. Blocks the UI for the
   * duration, which is why it is a fallback and not the default path.
   */
  const runInline = useCallback((params: Params, runId: number) => {
    setTimeout(() => {
      if (runId !== runIdRef.current) return;
      try {
        const result = runSimulation(params);
        setState({
          status: "done",
          done: params.paths,
          total: params.paths,
          result,
          error: null,
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }, 0);
  }, []);

  const run = useCallback(
    (params: Params) => {
      kill();
      const runId = ++runIdRef.current;
      setState((s) => ({
        status: "running",
        done: 0,
        total: params.paths,
        // Hold the previous render instead of flashing an empty card.
        result: s.result,
        error: null,
      }));

      let worker: Worker;
      try {
        worker = new SimWorker();
      } catch {
        runInline(params, runId);
        return;
      }
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.runId !== runIdRef.current) return;
        if (msg.type === "progress") {
          setState((s) => ({ ...s, status: "running", done: msg.done, total: msg.total }));
        } else if (msg.type === "done") {
          setState({
            status: "done",
            done: msg.result.params.paths,
            total: msg.result.params.paths,
            result: msg.result,
            error: null,
          });
          kill();
        } else {
          setState((s) => ({ ...s, status: "error", error: msg.message }));
          kill();
        }
      };
      worker.onerror = () => {
        // The worker never came up (blocked blob URL, CSP); do the work here.
        kill();
        runInline(params, runId);
      };
      worker.postMessage({ runId, params });
    },
    [kill, runInline],
  );

  const cancel = useCallback(() => {
    kill();
    runIdRef.current++;
    setState((s) => ({ ...s, status: s.result ? "done" : "idle" }));
  }, [kill]);

  return { state, run, cancel };
}
