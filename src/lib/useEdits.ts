import { useCallback, useRef, useState } from 'react';

interface Change {
  index: number;
  before: string | undefined;
  after: string | undefined;
}

type EditMap = ReadonlyMap<number, string>;

const MAX_HISTORY = 200;
const NO_EDITS: EditMap = new Map();

/**
 * Manual cell edits (cell index → thread id, or '' for "no stitch") with undo/redo.
 * A pencil stroke is grouped into one undo step via beginStroke/endStroke.
 * All bookkeeping is synchronous (refs), state only mirrors it for rendering.
 */
export function useEdits() {
  const editsRef = useRef<EditMap>(NO_EDITS);
  const undoRef = useRef<Change[][]>([]);
  const redoRef = useRef<Change[][]>([]);
  const strokeRef = useRef<Map<number, Change> | null>(null);
  const [snapshot, setSnapshot] = useState({ edits: NO_EDITS, undo: 0, redo: 0 });

  const publish = useCallback(() => {
    setSnapshot({
      edits: editsRef.current,
      undo: undoRef.current.length,
      redo: redoRef.current.length,
    });
  }, []);

  const pushUndo = useCallback((changes: Change[]) => {
    if (changes.length === 0) return;
    undoRef.current = [...undoRef.current, changes].slice(-MAX_HISTORY);
    redoRef.current = [];
  }, []);

  const apply = useCallback(
    (changes: Iterable<[number, string]>) => {
      const prev = editsRef.current;
      let next: Map<number, string> | null = null;
      const recorded: Change[] = [];
      for (const [index, value] of changes) {
        const before = (next ?? prev).get(index);
        if (before === value) continue;
        next ??= new Map(prev);
        next.set(index, value);
        const stroke = strokeRef.current;
        if (stroke) {
          const existing = stroke.get(index);
          stroke.set(index, { index, before: existing ? existing.before : before, after: value });
        } else {
          recorded.push({ index, before, after: value });
        }
      }
      if (!next) return;
      editsRef.current = next;
      pushUndo(recorded);
      publish();
    },
    [publish, pushUndo],
  );

  const beginStroke = useCallback(() => {
    strokeRef.current = new Map();
  }, []);

  const endStroke = useCallback(() => {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    if (!stroke) return;
    pushUndo([...stroke.values()].filter((c) => c.before !== c.after));
    publish();
  }, [publish, pushUndo]);

  const step = useCallback(
    (dir: 'undo' | 'redo') => {
      const from = dir === 'undo' ? undoRef : redoRef;
      const to = dir === 'undo' ? redoRef : undoRef;
      const changes = from.current[from.current.length - 1];
      if (!changes) return;
      const next = new Map(editsRef.current);
      for (const c of changes) {
        const v = dir === 'undo' ? c.before : c.after;
        if (v === undefined) next.delete(c.index);
        else next.set(c.index, v);
      }
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, changes];
      editsRef.current = next;
      publish();
    },
    [publish],
  );

  const undo = useCallback(() => step('undo'), [step]);
  const redo = useCallback(() => step('redo'), [step]);

  const reset = useCallback(
    (initial?: EditMap) => {
      strokeRef.current = null;
      editsRef.current = initial ?? NO_EDITS;
      undoRef.current = [];
      redoRef.current = [];
      publish();
    },
    [publish],
  );

  return {
    edits: snapshot.edits,
    apply,
    beginStroke,
    endStroke,
    undo,
    redo,
    reset,
    canUndo: snapshot.undo > 0,
    canRedo: snapshot.redo > 0,
  };
}
