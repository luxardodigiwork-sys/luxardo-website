import React, { useState } from 'react';
import { resizedImageUrl } from '../utils/optimizedImage';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { src?: string };

/** <img> that prefers the extension-resized WebP copy and falls back to the original once if it is missing. */
export default function OptimizedImage({ src, onError, loading = 'lazy', ...rest }: Props) {
  const resized = resizedImageUrl(src);
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const shown = resized && failedSource !== src ? resized : src;
  return (
    <img
      {...rest}
      src={shown}
      loading={loading}
      decoding="async"
      onError={(e) => {
        if (resized && failedSource !== src) setFailedSource(src);
        else onError?.(e);
      }}
    />
  );
}
