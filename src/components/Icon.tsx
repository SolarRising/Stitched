const PATHS = {
  image: 'M4 5h16v14H4z M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17 M15.5 9.5a1.5 1.5 0 1 0 0-.01',
  save: 'M5 4h11l3 3v13H5z M8 4v5h8V4 M8 20v-6h8v6',
  open: 'M3 7h6l2 2h10v10H3z M3 7V5h6l2 2',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  tips: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  rotateLeft: 'M4 4v5h5 M4.6 9A8 8 0 1 1 6 16.5',
  rotateRight: 'M20 4v5h-5 M19.4 9A8 8 0 1 0 18 16.5',
  crop: 'M6 2v16h16 M2 6h16v16',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 7.5-2',
  zoomIn: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M20 20l-4.8-4.8 M10.5 7.5v6 M7.5 10.5h6',
  zoomOut: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M20 20l-4.8-4.8 M7.5 10.5h6',
  fit: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4.5a1.5 1.5 0 0 1 3 0V11 M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6 6 0 0 1-5-2.7L3 14.5a1.6 1.6 0 0 1 2.6-1.8L8 15',
  pencil: 'M4 20l1-4L16 5l3 3L8 19z M14 7l3 3',
  eraser: 'M8 20h12 M5 15l9-9 5 5-8 8H8z M10 10l5 5',
  fill: 'M5 11l7-7 7 7-7 7z M5 11h14 M20 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z',
  picker: 'M14 4l6 6 M17 3l4 4-3 3-4-4z M14 7l-9 9v3h3l9-9',
  undo: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  swap: 'M7 4L3 8l4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7',
  ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8',
  skip: 'M4 4h16v16H4z M4 4l16 16',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  close: 'M6 6l12 12 M18 6L6 18',
  sparkle:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  brush: 'M14 4l6 6-8 8-6-6z M6 12l-2 6 6-2',
  reset: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The Stitched mark: a cross stitch on a grid. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
      <path
        d="M9 9l14 14"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path d="M23 9L9 23" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}
