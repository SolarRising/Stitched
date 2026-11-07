import { useEffect, useRef, useState } from 'react';
import type { GenerateOptions, GeneratedGrid } from '../core/generate';
import type { Rotation } from '../core/image';
import type { WorkerRequest, WorkerResponse } from '../workers/protocol';
import PatternWorker from '../workers/pattern.worker?worker&inline';
import type { LoadedImage } from './imageLoader';

interface Result {
  imageId: number;
  requestId: number;
  grid: GeneratedGrid;
}

/**
 * Runs pattern generation in a Web Worker. Requests are debounced and only the latest
 * result is kept, so dragging a slider never queues up stale work.
 */
export function useGenerator(
  image: LoadedImage | null,
  rotation: Rotation,
  options: GenerateOptions,
): { grid: GeneratedGrid | null; busy: boolean; error: string | null } {
  const workerRef = useRef<Worker | null>(null);
  const latest = useRef(0);
  const imageForRequest = useRef(new Map<number, number>());
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<{ requestId: number; message: string } | null>(null);

  useEffect(() => {
    const worker = new PatternWorker();
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== latest.current) return;
      const imageId = imageForRequest.current.get(msg.id) ?? -1;
      imageForRequest.current.clear();
      if (msg.type === 'result') {
        setResult({ imageId, requestId: msg.id, grid: msg.grid });
        setError(null);
      } else {
        setError({ requestId: msg.id, message: msg.message });
      }
      setPending(0);
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!image || !workerRef.current) return;
    const copy = image.raster.data.slice();
    const msg: WorkerRequest = {
      type: 'image',
      width: image.raster.width,
      height: image.raster.height,
      data: copy.buffer,
    };
    workerRef.current.postMessage(msg, [copy.buffer]);
  }, [image]);

  useEffect(() => {
    if (!image) return;
    const timer = setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;
      const id = ++latest.current;
      imageForRequest.current.set(id, image.id);
      setPending(id);
      const msg: WorkerRequest = { type: 'generate', id, rotation, options };
      worker.postMessage(msg);
    }, 50);
    return () => clearTimeout(timer);
  }, [image, rotation, options]);

  const grid = result && image && result.imageId === image.id ? result.grid : null;
  return { grid, busy: pending !== 0, error: error ? error.message : null };
}
