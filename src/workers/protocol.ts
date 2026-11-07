import type { GenerateOptions, GeneratedGrid } from '../core/generate';
import type { Rotation } from '../core/image';

export type WorkerRequest =
  | {
      type: 'image';
      width: number;
      height: number;
      /** RGBA pixels (transferred). */
      data: ArrayBuffer;
    }
  | { type: 'generate'; id: number; rotation: Rotation; options: GenerateOptions };

export type WorkerResponse =
  | { type: 'result'; id: number; grid: GeneratedGrid; ms: number }
  | { type: 'error'; id: number; message: string };
