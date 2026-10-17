import React, { useState } from 'react';
import { resizedImageUrl } from '../utils/optimizedImage';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { src?: string };

/** <img> that prefers the extension-resized WebP copy and falls back to the original once if it is missing. */
export default function OptimizedImage({ src, onError, loading = 'lazy', ...rest }: Props) {
  const resized = resizedImageUrl(src);
  const [useOriginal, setUseOriginal] = useState(false);
  const shown = resized && !useOriginal ? resized : src;
  return (
    <img
      {...rest}
      src={shown}
      loading={loading}
      decoding="async"
      onError={(e) => {
        if (resized && !useOriginal) setUseOriginal(true);
        else onError?.(e);
      }}
    />
  );
}
