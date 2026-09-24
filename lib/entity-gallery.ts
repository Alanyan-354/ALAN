import type { Entity } from './types';

export type GalleryImage = { src: string; alt: string; kind: 'photo' | 'graphic' };

function isSafeImage(value: unknown): value is GalleryImage {
  if (!value || typeof value !== 'object') return false;
  const image = value as Record<string, unknown>;
  return typeof image.src === 'string' &&
    (/^\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)$/i.test(image.src) || /^https:\/\//i.test(image.src)) &&
    typeof image.alt === 'string' && image.alt.trim().length > 0 && image.alt.length <= 200 &&
    (image.kind === 'photo' || image.kind === 'graphic');
}

export function entityGallery(entity: Entity): GalleryImage[] {
  const configured = Array.isArray(entity.metadata.gallery)
    ? entity.metadata.gallery.filter(isSafeImage).slice(0, 12)
    : [];
  const submitted = entity.image_url
    ? [{ src: entity.image_url, alt: `${entity.name} at ${entity.location_name || 'campus'}`, kind: 'photo' as const }]
    : [];
  return [...submitted, ...configured.filter(image => image.src !== entity.image_url)];
}

export function entityCover(entity: Entity): GalleryImage | undefined {
  const gallery = entityGallery(entity);
  return gallery.find(image => image.kind === 'photo') || gallery[0];
}
