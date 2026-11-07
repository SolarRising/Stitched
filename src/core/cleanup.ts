import { EMPTY } from './quantize';

/**
 * Removes "confetti": connected regions (4-neighbourhood, same colour) smaller than
 * `minSize` stitches are recoloured to the most common colour around them (which may be
 * "no stitch"). Fewer isolated stitches means fewer thread changes while stitching.
 * Returns a new array; the input is not modified.
 */
export function removeSmallRegions(
  cells: Uint16Array,
  width: number,
  height: number,
  minSize: number,
  maxPasses = 4,
): Uint16Array {
  const out = cells.slice();
  if (minSize <= 1) return out;
  const n = width * height;
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  const region: number[] = [];
  const votes = new Map<number, number>();

  for (let pass = 0; pass < maxPasses; pass++) {
    label.fill(-1);
    let changed = false;
    let nextLabel = 0;
    for (let start = 0; start < n; start++) {
      if (label[start] >= 0 || out[start] === EMPTY) continue;
      const color = out[start];
      const id = nextLabel++;
      region.length = 0;
      let sp = 0;
      stack[sp++] = start;
      label[start] = id;
      while (sp > 0) {
        const i = stack[--sp];
        region.push(i);
        const x = i % width;
        const y = (i - x) / width;
        if (x > 0 && label[i - 1] < 0 && out[i - 1] === color) {
          label[i - 1] = id;
          stack[sp++] = i - 1;
        }
        if (x < width - 1 && label[i + 1] < 0 && out[i + 1] === color) {
          label[i + 1] = id;
          stack[sp++] = i + 1;
        }
        if (y > 0 && label[i - width] < 0 && out[i - width] === color) {
          label[i - width] = id;
          stack[sp++] = i - width;
        }
        if (y < height - 1 && label[i + width] < 0 && out[i + width] === color) {
          label[i + width] = id;
          stack[sp++] = i + width;
        }
        if (region.length >= minSize) break;
      }
      if (region.length >= minSize) {
        // Big enough — finish labelling the region so it isn't revisited.
        while (sp > 0) {
          const i = stack[--sp];
          const x = i % width;
          const y = (i - x) / width;
          const push = (j: number) => {
            if (label[j] < 0 && out[j] === color) {
              label[j] = id;
              stack[sp++] = j;
            }
          };
          if (x > 0) push(i - 1);
          if (x < width - 1) push(i + 1);
          if (y > 0) push(i - width);
          if (y < height - 1) push(i + width);
        }
        continue;
      }

      // Small region: vote among the 8-neighbourhood of its cells.
      votes.clear();
      for (const i of region) {
        const x = i % width;
        const y = (i - x) / width;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
            const j = ny * width + nx;
            const c = out[j];
            if (c === color) continue;
            // Orthogonal neighbours count double: they share an edge with the region.
            votes.set(c, (votes.get(c) ?? 0) + (dx === 0 || dy === 0 ? 2 : 1));
          }
        }
      }
      let best = -1;
      let bestVotes = 0;
      for (const [c, v] of votes) {
        if (v > bestVotes || (v === bestVotes && c < best)) {
          best = c;
          bestVotes = v;
        }
      }
      if (best < 0) continue; // whole image is this one colour
      for (const i of region) out[i] = best;
      changed = true;
    }
    if (!changed) break;
  }
  return out;
}
