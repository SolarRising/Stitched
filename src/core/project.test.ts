import { describe, expect, it } from 'vitest';
import { DMC } from './palettes';
import { parseProject, ProjectFormatError, serializeProject } from './project';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

const image = { name: 'cat.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };

describe('project files', () => {
  it('round-trips settings, image and edits', () => {
    const settings = { ...DEFAULT_SETTINGS, name: 'Kot', maxColors: 20, background: ['dmc:310'] };
    const edits = new Map([
      [3, 'dmc:666'],
      [4, ''],
    ]);
    const parsed = parseProject(serializeProject({ settings, image, edits }));
    expect(parsed.settings).toEqual(settings);
    expect(parsed.image).toEqual(image);
    expect([...parsed.edits]).toEqual([...edits]);
  });

  it('rejects files that are not projects', () => {
    expect(() => parseProject('nope')).toThrow(ProjectFormatError);
    expect(() => parseProject('{"format":"other"}')).toThrow(ProjectFormatError);
    expect(() =>
      parseProject(JSON.stringify({ format: 'stitched-project', version: 99, image })),
    ).toThrow(ProjectFormatError);
    expect(() =>
      parseProject(
        JSON.stringify({
          format: 'stitched-project',
          version: 1,
          image: { dataUrl: 'javascript:1' },
        }),
      ),
    ).toThrow(ProjectFormatError);
  });

  it('drops invalid edits', () => {
    const text = JSON.stringify({
      format: 'stitched-project',
      version: 1,
      image,
      settings: {},
      edits: [[1, 'dmc:310'], [-1, 'dmc:310'], [2, 'dmc:fake'], 'x', [1.5, '']],
    });
    expect([...parseProject(text).edits]).toEqual([[1, 'dmc:310']]);
  });
});

describe('sanitizeSettings', () => {
  it('fills defaults and clamps values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({
      maxColors: 500,
      width: 2,
      rotation: 45,
      fabricId: 'evenweave-28',
      excluded: ['dmc:310', 'bogus', 3],
      replacements: { 'dmc:310': 'dmc:310', 'dmc:666': 'dmc:321', 'dmc:x': 'dmc:321' },
      fabricColor: 'red',
      cleanup: 4,
    });
    expect(s.maxColors).toBe(60);
    expect(s.width).toBe(5);
    expect(s.rotation).toBe(0);
    expect(s.fabricId).toBe('evenweave-28');
    expect(s.excluded).toEqual(['dmc:310']);
    expect(s.replacements).toEqual({ 'dmc:666': 'dmc:321' });
    expect(s.fabricColor).toBe('#ffffff');
    expect(s.cleanup).toBe(DEFAULT_SETTINGS.cleanup);
  });

  it('knows every DMC id', () => {
    expect(DMC.length).toBe(454);
    expect(sanitizeSettings({ background: DMC.map((t) => t.id) }).background.length).toBe(454);
  });
});
