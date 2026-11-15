'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconChevronLeft, IconClose } from '@/components/icons';

export default function ScreenshotGallery({ images }: { images: { id: string; mediaId: string }[] }) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);

  useEffect(() => {
    if (index === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setIndex((current) => (current === null ? null : (current + 1) % images.length));
      if (event.key === 'ArrowLeft')
        setIndex((current) => (current === null ? null : (current - 1 + images.length) % images.length));
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, images.length, close]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="gallery">
        {images.map((image, position) => (
          <button
            key={image.id}
            type="button"
            className="gallery-item"
            onClick={() => setIndex(position)}
            aria-label={`Open screenshot ${position + 1} of ${images.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${image.mediaId}`} alt={`Screenshot ${position + 1}`} loading="lazy" />
          </button>
        ))}
      </div>

      {index !== null ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${images[index]!.mediaId}`}
            alt={`Screenshot ${index + 1} of ${images.length}`}
            onClick={(event) => event.stopPropagation()}
          />
          <div className="lightbox-bar" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-sm" onClick={() => setIndex((index - 1 + images.length) % images.length)}>
              <IconChevronLeft size={16} />
              Prev
            </button>
            <button type="button" className="btn btn-sm" onClick={close}>
              <IconClose size={16} />
              Close
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setIndex((index + 1) % images.length)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
