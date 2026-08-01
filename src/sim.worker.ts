import { runSimulation } from './lib/simulate'
import type { Params, SimResult } from './lib/types'

/** The worker global, typed without pulling the WebWorker lib into the app tsconfig. */
const ctx = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent) => void) | null
}

export type WorkerRequest = { runId: number; params: Params }

export type WorkerResponse =
  | { type: 'progress'; runId: number; done: number; total: number }
  | { type: 'done'; runId: number; result: SimResult }
  | { type: 'error'; runId: number; message: string }

ctx.onmessage = (e: MessageEvent) => {
  const { runId, params } = e.data as WorkerRequest
  try {
    const result = runSimulation(params, (done, total) => {
      ctx.postMessage({ type: 'progress', runId, done, total } satisfies WorkerResponse)
    })
    // Transfer the big buffers instead of copying them.
    ctx.postMessage({ type: 'done', runId, result } satisfies WorkerResponse, [
      result.classic.terminals.buffer,
      result.classic.drawdowns.buffer,
      result.classic.ruinStep.buffer,
      result.adaptive.terminals.buffer,
      result.adaptive.drawdowns.buffer,
      result.adaptive.ruinStep.buffer,
    ] as Transferable[])
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      runId,
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse)
  }
}
