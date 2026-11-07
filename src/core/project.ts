import { NO_STITCH } from './pattern';
import { threadById } from './palettes';
import { sanitizeSettings, type Settings } from './settings';

export const PROJECT_FORMAT = 'stitched-project';
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = '.stitched.json';

export interface ProjectData {
  settings: Settings;
  image: { name: string; dataUrl: string };
  edits: Map<number, string>;
}

export function serializeProject(p: ProjectData): string {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    settings: p.settings,
    image: p.image,
    edits: [...p.edits.entries()],
  });
}

export class ProjectFormatError extends Error {}

export function parseProject(text: string): ProjectData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectFormatError('Not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new ProjectFormatError('Not a project');
  const obj = raw as Record<string, unknown>;
  if (obj.format !== PROJECT_FORMAT) throw new ProjectFormatError('Not a Stitched project');
  if (typeof obj.version !== 'number' || obj.version > PROJECT_VERSION) {
    throw new ProjectFormatError('Unsupported project version');
  }
  const image = obj.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.dataUrl !== 'string' ||
    !/^data:image\/(png|jpeg|webp|gif|bmp);base64,/.test(image.dataUrl)
  ) {
    throw new ProjectFormatError('Project has no image');
  }
  const edits = new Map<number, string>();
  if (Array.isArray(obj.edits)) {
    for (const e of obj.edits) {
      if (!Array.isArray(e) || e.length !== 2) continue;
      const [i, id] = e;
      if (!Number.isInteger(i) || i < 0 || typeof id !== 'string') continue;
      if (id === NO_STITCH || threadById(id)) edits.set(i, id);
    }
  }
  return {
    settings: sanitizeSettings(obj.settings),
    image: {
      name: typeof image.name === 'string' ? image.name.slice(0, 200) : 'image',
      dataUrl: image.dataUrl,
    },
    edits,
  };
}
