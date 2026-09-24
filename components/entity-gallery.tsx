'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GalleryImage } from '@/lib/entity-gallery';

export function EntityGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  if (!images.length) return null;

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(images.length - 1, index));
    track.current?.children[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    setCurrent(next);
  };

  return <div className="entity-gallery" aria-label={`${name} image gallery`}>
    <div className="entity-gallery-track" ref={track} onScroll={event => {
      const element = event.currentTarget;
      if (element.clientWidth) setCurrent(Math.min(images.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
    }}>
      {images.map((image, index) => <figure className={`entity-gallery-slide ${image.kind === 'graphic' ? 'is-graphic' : ''}`} key={`${image.src}-${index}`}>
        <img src={image.src} alt={image.alt} loading={index ? 'lazy' : 'eager'} />
        <figcaption>{image.kind === 'graphic' ? 'Brand or dining graphic' : image.alt}</figcaption>
      </figure>)}
    </div>
    {images.length > 1 && <div className="entity-gallery-controls">
      <div className="entity-gallery-arrows">
        <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0} aria-label="Previous image"><ChevronLeft size={18} /></button>
        <button type="button" onClick={() => goTo(current + 1)} disabled={current === images.length - 1} aria-label="Next image"><ChevronRight size={18} /></button>
      </div>
      <span aria-live="polite">{current + 1} / {images.length}</span>
      <div className="entity-gallery-dots" aria-label="Choose image">{images.map((image, index) => <button key={`${image.src}-${index}`} type="button" onClick={() => goTo(index)} aria-label={`View image ${index + 1}`} aria-current={index === current ? 'true' : undefined} />)}</div>
    </div>}
  </div>;
}
