import { FULL_CROP, type CropRect, type ResampleMode, type Rotation } from '../core/image';
import type { Settings } from '../core/settings';
import { useI18n } from '../i18n';
import type { LoadedImage } from '../lib/imageLoader';
import { CropBox } from './CropBox';
import { Field, IconButton, Section, Segmented } from './ui';

export function ImagePanel({
  image,
  settings,
  onCrop,
  onRotate,
  onChange,
  onChangeImage,
}: {
  image: LoadedImage;
  settings: Settings;
  onCrop: (c: CropRect) => void;
  onRotate: (r: Rotation) => void;
  onChange: (patch: Partial<Settings>) => void;
  onChangeImage: () => void;
}) {
  const { t } = useI18n();
  const isFull =
    settings.crop.x === 0 &&
    settings.crop.y === 0 &&
    settings.crop.w === 1 &&
    settings.crop.h === 1;
  return (
    <Section title={t('section.image')}>
      <CropBox
        source={image.canvas}
        rotation={settings.rotation}
        crop={settings.crop}
        onChange={onCrop}
        label={t('image.cropHint')}
      />
      <p className="hint">{t('image.cropHint')}</p>
      <div className="button-row">
        <IconButton
          icon="rotateLeft"
          label={t('image.rotateLeft')}
          onClick={() => onRotate(((settings.rotation + 270) % 360) as Rotation)}
        />
        <IconButton
          icon="rotateRight"
          label={t('image.rotateRight')}
          onClick={() => onRotate(((settings.rotation + 90) % 360) as Rotation)}
        />
        <IconButton
          icon="crop"
          label={t('image.resetCrop')}
          showLabel
          disabled={isFull}
          onClick={() => onCrop(FULL_CROP)}
        />
        <IconButton icon="image" label={t('image.change')} showLabel onClick={onChangeImage} />
      </div>
      <Field label={t('image.type')} hint={t('image.type.hint')}>
        <Segmented<ResampleMode>
          label={t('image.type')}
          value={settings.resample}
          onChange={(resample) => onChange({ resample })}
          options={[
            { value: 'average', label: t('image.type.average') },
            { value: 'sharp', label: t('image.type.sharp') },
          ]}
        />
      </Field>
    </Section>
  );
}
