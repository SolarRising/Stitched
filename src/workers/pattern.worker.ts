import { generateGrid } from '../core/generate';
import { rotateImage, type RasterImage, type Rotation } from '../core/image';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** The bits of DedicatedWorkerGlobalScope we use (avoids mixing DOM and WebWorker libs). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

type GenerateRequest = Extract<WorkerRequest, { type: 'generate' }>;

let source: RasterImage | null = null;
let rotated: { rotation: Rotation; image: RasterImage } | null = null;
let pending: GenerateRequest | null = null;
let scheduled = false;

/**
 * Requests that arrive while a pattern is being computed are queued as messages; they are
 * all delivered before the timer below fires, so only the newest one is actually computed.
 */
function run() {
  scheduled = false;
  const msg = pending;
  pending = null;
  if (!msg) return;
  const started = performance.now();
  try {
    if (!source) throw new Error('No image loaded');
    if (!rotated || rotated.rotation !== msg.rotation) {
      rotated = { rotation: msg.rotation, image: rotateImage(source, msg.rotation) };
    }
    const grid = generateGrid(rotated.image, msg.options);
    scope.postMessage({ type: 'result', id: msg.id, grid, ms: performance.now() - started }, [
      grid.cells.buffer,
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    scope.postMessage({ type: 'error', id: msg.id, message }, []);
  }
}

scope.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'image') {
    source = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.data) };
    rotated = null;
    return;
  }
  pending = msg;
  if (!scheduled) {
    scheduled = true;
    setTimeout(run, 0);
  }
};
