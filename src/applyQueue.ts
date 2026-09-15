/**
 * Coordinates settings writes shared by the Opciones and Niveles modals: a
 * debounced live preview as the user edits, plus the final Cancel/Save.
 * Every write is chained onto one promise instead of fired independently,
 * so a still-in-flight debounced write can never resolve *after*, and
 * overwrite, a Cancel/Save requested later. Scheduling a new debounced
 * write also cancels any not-yet-fired one, so only the latest edit in a
 * burst (a dragged slider, several quick clicks) actually applies.
 */
export interface ApplyQueue {
  /** Cancels a pending (not yet fired) debounced write, if any */
  cancelScheduled(): void;
  /** Debounces `task`, replacing any not-yet-fired scheduled write */
  schedule(task: () => Promise<void>, delayMs?: number): void;
  /** Chains `task` onto the queue right away, resolving once it (and everything queued before it) has settled */
  enqueue(task: () => Promise<void>): Promise<void>;
}

const DEFAULT_DELAY_MS = 200;

export function createApplyQueue(): ApplyQueue {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();

  function cancelScheduled() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    chain = chain.then(task, task);
    return chain;
  }

  function schedule(task: () => Promise<void>, delayMs: number = DEFAULT_DELAY_MS) {
    cancelScheduled();
    timer = setTimeout(() => {
      timer = undefined;
      enqueue(task);
    }, delayMs);
  }

  return { cancelScheduled, schedule, enqueue };
}
