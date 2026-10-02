import { useState } from 'react';
import { ImageSquare, User } from '@phosphor-icons/react';
import { localAsset } from '../app/presentation';

export function Media({ src, alt, className = '', portrait = false, eager = false }: { src: string; alt: string; className?: string; portrait?: boolean; eager?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <span className={`media ${portrait ? 'media-portrait' : ''} ${className}`}>
    {failedSource === src || !src
      ? <span className="media-fallback" role="img" aria-label={alt}>{portrait ? <User size={32} weight="light" /> : <ImageSquare size={32} weight="light" />}<span>{portrait ? alt.slice(0, 2) : '照片暂时无法显示'}</span></span>
      : <img src={localAsset(src)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedSource(src)} />}
  </span>;
}
