import { useEffect, useMemo, useState, type DragEvent } from 'react';
import sampleUrl from './assets/sample.svg?url';
import { ColorsPanel } from './components/ColorsPanel';
import { EmptyState } from './components/EmptyState';
import { ExportDialog } from './components/ExportDialog';
import { Header } from './components/Header';
import { ImagePanel } from './components/ImagePanel';
import { Legend, type LegendActions } from './components/Legend';
import { PatternView, type Tool, type View } from './components/PatternView';
import { SizePanel } from './components/SizePanel';
import { ThreadPicker } from './components/ThreadPicker';
import { TipsDialog } from './components/TipsDialog';
import type { GenerateOptions } from './core/generate';
import { FULL_CROP, type CropRect, type Rotation } from './core/image';
import { threadById, type Thread } from './core/palettes';
import { buildPattern, cellThreadId, detectBackground, floodRegion } from './core/pattern';
import { parseProject, PROJECT_EXTENSION, serializeProject } from './core/project';
import {
  DEFAULT_SETTINGS,
  fitSize,
  settingsAspect,
  toGenerateOptions,
  type Settings,
} from './core/settings';
import { useI18n } from './i18n';
import { downloadBlob, pickFile, safeFileName } from './lib/download';
import { imageToDataUrl, loadImage, type LoadedImage } from './lib/imageLoader';
import { threadTitle } from './lib/labels';
import { useEdits } from './lib/useEdits';
import { useGenerator } from './lib/useGenerator';
import type { ChartStyle } from './render/chartRenderer';

type Dialog =
  | { kind: 'export' }
  | { kind: 'tips' }
  | { kind: 'replace'; from: Thread }
  | { kind: 'paint' }
  | null;

interface Notice {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

const GEOMETRY_KEYS = ['width', 'height', 'crop', 'rotation'] as const;
let noticeId = 0;

export default function App() {
  const { t } = useI18n();
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const editsApi = useEdits();
  const { edits, undo, redo } = editsApi;
  const [view, setView] = useState<View>('chart');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('both');
  const [tool, setTool] = useState<Tool>('pan');
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);

  const genKey = JSON.stringify(toGenerateOptions(settings));
  const genOptions = useMemo(() => JSON.parse(genKey) as GenerateOptions, [genKey]);
  const { grid, busy, error } = useGenerator(image, settings.rotation, genOptions);

  const pattern = useMemo(
    () =>
      grid
        ? buildPattern(grid, {
            background: settings.background,
            replacements: settings.replacements,
            edits,
          })
        : null,
    [grid, settings.background, settings.replacements, edits],
  );

  const aspect = image ? settingsAspect(image.raster.width, image.raster.height, settings) : 1;

  const notify = (text: string, kind: Notice['kind'] = 'info') =>
    setNotice({ id: ++noticeId, kind, text });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Applies a settings change; geometry changes discard manual edits (after asking). */
  const update = (patch: Partial<Settings>): boolean => {
    const geometry = GEOMETRY_KEYS.some(
      (k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(settings[k]),
    );
    if (geometry && edits.size > 0) {
      if (!window.confirm(t('confirm.discardEdits', { n: edits.size }))) return false;
      editsApi.reset();
    }
    setSettings((s) => ({ ...s, ...patch }));
    return true;
  };

  const resized = (next: Settings) =>
    image ? fitSize(next, settingsAspect(image.raster.width, image.raster.height, next)) : {};

  const onCrop = (crop: CropRect) => update({ crop, ...resized({ ...settings, crop }) });
  const onRotate = (rotation: Rotation) =>
    update({ rotation, crop: FULL_CROP, ...resized({ ...settings, rotation, crop: FULL_CROP }) });

  const applyImage = (img: LoadedImage, name: string) => {
    const imgAspect = img.raster.width / img.raster.height;
    setSettings((s) => {
      const base: Settings = {
        ...s,
        name,
        crop: FULL_CROP,
        rotation: 0,
        background: [],
        replacements: {},
        excluded: [],
      };
      return { ...base, ...fitSize(base, imgAspect) };
    });
    editsApi.reset();
    setImage(img);
    setHighlight(null);
    setActiveColor(null);
    setView('chart');
    if (img.resizedFrom) {
      notify(t('notice.resized', { w: img.raster.width, h: img.raster.height }));
    }
  };

  const openImage = async (src: Blob | string, name: string) => {
    if (edits.size > 0 && !window.confirm(t('confirm.discardEdits', { n: edits.size }))) return;
    try {
      const img = await loadImage(src, name);
      applyImage(img, img.name);
    } catch {
      notify(t('error.image'), 'error');
    }
  };

  const openProject = async (file: Blob) => {
    try {
      const data = parseProject(await file.text());
      const img = await loadImage(data.image.dataUrl, data.image.name);
      setSettings(data.settings);
      editsApi.reset(data.edits);
      setImage(img);
      setHighlight(null);
      setActiveColor(null);
      notify(t('notice.projectLoaded', { name: data.settings.name || img.name }));
    } catch {
      notify(t('error.project'), 'error');
    }
  };

  const chooseImage = async () => {
    const file = await pickFile('image/*');
    if (file) await openImage(file, file.name);
  };

  const chooseProject = async () => {
    const file = await pickFile(`${PROJECT_EXTENSION},.json,application/json`);
    if (file) await openProject(file);
  };

  const saveProject = () => {
    if (!image) return;
    const text = serializeProject({
      settings,
      image: { name: image.name, dataUrl: imageToDataUrl(image) },
      edits: new Map(edits),
    });
    const name = safeFileName(settings.name || image.name, 'stitched');
    downloadBlob(new Blob([text], { type: 'application/json' }), `${name}${PROJECT_EXTENSION}`);
  };

  const openFromDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (/\.json$/i.test(file.name) || file.type === 'application/json') await openProject(file);
    else await openImage(file, file.name);
  };

  const detectBg = () => {
    if (!pattern) return;
    const id = detectBackground(pattern);
    const th = id ? threadById(id) : undefined;
    if (!id || !th) {
      notify(t('colors.noBackground'));
      return;
    }
    update({ background: [...new Set([...settings.background, id])] });
    if (highlight === id) setHighlight(null);
    notify(t('notice.backgroundRemoved', { thread: threadTitle(th) }));
  };

  const legendActions: LegendActions = {
    onHighlight: setHighlight,
    onReplace: (from) => setDialog({ kind: 'replace', from }),
    onBackground: (id) => {
      update({ background: [...new Set([...settings.background, id])] });
      if (highlight === id) setHighlight(null);
    },
    onExclude: (id) => {
      update({ excluded: [...new Set([...settings.excluded, id])] });
      if (highlight === id) setHighlight(null);
    },
    onPaint: (id) => {
      setActiveColor(id);
      setTool('pencil');
      if (view === 'original') setView('chart');
    },
    onRestoreBackground: (id) =>
      update({ background: settings.background.filter((x) => x !== id) }),
    onUndoReplace: (from) => {
      const rest = { ...settings.replacements };
      delete rest[from];
      update({ replacements: rest });
    },
  };

  const replaceThread = (from: Thread, to: Thread) => {
    setDialog(null);
    if (from.id === to.id) return;
    update({ replacements: { ...settings.replacements, [from.id]: to.id } });
    // Hand-painted cells with that thread follow the replacement too.
    const painted = [...edits].filter(([, id]) => id === from.id);
    if (painted.length) {
      editsApi.beginStroke();
      editsApi.apply(painted.map(([i]) => [i, to.id] as [number, string]));
      editsApi.endStroke();
    }
    if (highlight === from.id) setHighlight(to.id);
    if (activeColor === from.id) setActiveColor(to.id);
  };

  const onFill = (index: number) => {
    if (!pattern) return;
    if (!activeColor) {
      setDialog({ kind: 'paint' });
      return;
    }
    const region = floodRegion(pattern.cells, pattern.width, pattern.height, index);
    editsApi.beginStroke();
    editsApi.apply(region.map((i) => [i, activeColor] as [number, string]));
    editsApi.endStroke();
  };

  const onPick = (index: number) => {
    if (!pattern) return;
    const id = cellThreadId(pattern, index);
    if (id) {
      setActiveColor(id);
      setTool('pencil');
    }
  };

  const clearEdits = () => {
    if (window.confirm(t('confirm.discardEdits', { n: edits.size }))) editsApi.reset();
  };

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'))
        return;
      if (dialog || !image) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (!mod && !e.altKey) {
        const tools: Record<string, Tool> = {
          h: 'pan',
          b: 'pencil',
          e: 'eraser',
          g: 'fill',
          i: 'picker',
        };
        if (tools[key]) setTool(tools[key]);
        else if (key === 'escape') setHighlight(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, image, undo, redo]);

  const pickerReference = dialog?.kind === 'replace' ? dialog.from.rgb : undefined;

  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.relatedTarget) setDragging(false);
      }}
      onDrop={openFromDrop}
    >
      <Header
        hasImage={!!image}
        canExport={!!pattern && pattern.stitchCount > 0}
        onOpenImage={chooseImage}
        onOpenProject={chooseProject}
        onSaveProject={saveProject}
        onExport={() => setDialog({ kind: 'export' })}
        onTips={() => setDialog({ kind: 'tips' })}
      />

      {image ? (
        <main className="workspace">
          <aside className="sidebar" aria-label={t('section.size')}>
            <div className="project-name field">
              <label className="field-label" htmlFor="project-name">
                {t('project.name')}
              </label>
              <input
                id="project-name"
                type="text"
                value={settings.name}
                placeholder={t('project.namePlaceholder')}
                maxLength={120}
                onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <ImagePanel
              image={image}
              settings={settings}
              onCrop={onCrop}
              onRotate={onRotate}
              onChange={update}
              onChangeImage={chooseImage}
            />
            <SizePanel settings={settings} aspect={aspect} pattern={pattern} onChange={update} />
            <ColorsPanel
              settings={settings}
              pattern={pattern}
              onChange={update}
              onDetectBackground={detectBg}
            />
          </aside>

          <section className="stage">
            <PatternView
              pattern={pattern}
              image={image}
              rotation={settings.rotation}
              crop={settings.crop}
              fabricColor={settings.fabricColor}
              view={view}
              chartStyle={chartStyle}
              tool={tool}
              activeColor={activeColor}
              highlight={highlight}
              busy={busy}
              canUndo={editsApi.canUndo}
              canRedo={editsApi.canRedo}
              editCount={edits.size}
              onView={setView}
              onChartStyle={setChartStyle}
              onTool={setTool}
              onChooseColor={() => setDialog({ kind: 'paint' })}
              onStrokeStart={editsApi.beginStroke}
              onPaint={editsApi.apply}
              onStrokeEnd={editsApi.endStroke}
              onFill={onFill}
              onPick={onPick}
              onUndo={editsApi.undo}
              onRedo={editsApi.redo}
              onClearEdits={clearEdits}
            />
            {error && (
              <div className="error-banner" role="alert">
                {t('error.generate', { msg: error })}
              </div>
            )}
          </section>

          <aside className="legend-panel" aria-label={t('legend.title')}>
            {pattern ? (
              <Legend
                pattern={pattern}
                settings={settings}
                highlight={highlight}
                activeColor={activeColor}
                actions={legendActions}
              />
            ) : (
              <p className="muted pad">{t('view.working')}</p>
            )}
          </aside>
        </main>
      ) : (
        <EmptyState
          onOpenImage={chooseImage}
          onSample={() => openImage(sampleUrl, t('sample.name'))}
        />
      )}

      {dialog?.kind === 'export' && pattern && (
        <ExportDialog
          pattern={pattern}
          settings={settings}
          onClose={() => setDialog(null)}
          onError={(msg) => notify(msg, 'error')}
        />
      )}
      {dialog?.kind === 'tips' && <TipsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'replace' && (
        <ThreadPicker
          title={`${t('legend.replace').replace('…', '')}: ${threadTitle(dialog.from)}`}
          reference={pickerReference}
          exclude={[dialog.from.id]}
          onPick={(to) => replaceThread(dialog.from, to)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'paint' && (
        <ThreadPicker
          reference={activeColor ? threadById(activeColor)?.rgb : undefined}
          onPick={(th) => {
            setActiveColor(th.id);
            if (tool === 'pan' || tool === 'picker') setTool('pencil');
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {notice && (
        <div className={`toast ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.text}
          <button type="button" aria-label={t('common.close')} onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {dragging && <div className="drop-overlay">{t('empty.dropHere')}</div>}
    </div>
  );
}
