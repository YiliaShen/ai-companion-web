import { useEffect, useState } from 'react';
import { CaretLeft, CaretRight, Heart, Images } from '@phosphor-icons/react';
import type { AlbumPhoto } from '../../contracts';
import { formatDate, sceneLabels } from '../../app/presentation';
import { Dialog } from '../../components/Dialog';
import { Media } from '../../components/Media';

export function AlbumGrid({ photos, onOpen, onFavorite, compact = false }: { photos: AlbumPhoto[]; onOpen: (photo: AlbumPhoto) => void; onFavorite: (id: string) => void; compact?: boolean }) {
  return <div className={`album-grid ${compact ? 'album-grid-compact' : ''}`}>{photos.map((photo) => <article className="album-photo" key={photo.id}>
    <button type="button" className="album-image-button" onClick={() => onOpen(photo)} aria-label={`查看照片：${photo.caption}`}><Media src={photo.imageUrl} alt={photo.caption} /><span className="photo-scene">{sceneLabels[photo.scene]}</span></button>
    {!compact && <div className="photo-caption"><p>{photo.caption}</p><span>{formatDate(photo.createdAt)}</span></div>}
    <button type="button" className={`favorite-button ${photo.favorite ? 'is-favorite' : ''}`} aria-label={photo.favorite ? '取消收藏照片' : '收藏照片'} aria-pressed={photo.favorite} onClick={() => onFavorite(photo.id)}><Heart size={19} weight={photo.favorite ? 'fill' : 'regular'} /></button>
  </article>)}</div>;
}
export function AlbumView({ photos, name, onOpen, onFavorite, onChat }: { photos: AlbumPhoto[]; name: string; onOpen: (photo: AlbumPhoto) => void; onFavorite: (id: string) => void; onChat: () => void }) {
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const visible = favoritesOnly ? photos.filter((photo) => photo.favorite) : photos;
  return <section className="feature-view album-view"><header className="feature-heading"><div><h1>把此刻，留在这里</h1><p>和{name}分享过的风景，慢慢成为日常。</p></div><span className="quiet-count">{photos.length} 张照片</span></header>
    <div className="filter-tabs" role="group" aria-label="筛选相册"><button type="button" className={!favoritesOnly ? 'is-active' : ''} aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>全部时刻</button><button type="button" className={favoritesOnly ? 'is-active' : ''} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}><Heart size={16} />我收藏的</button></div>
    {visible.length ? <AlbumGrid photos={visible} onOpen={onOpen} onFavorite={onFavorite} /> : <div className="empty-state album-empty"><Images size={36} weight="light" /><h2>{favoritesOnly ? '喜欢的瞬间，值得再看一次' : '第一张照片，还在来的路上'}</h2><p>{favoritesOnly ? '点亮照片上的爱心，就能在这里找到它。' : '照片会在聊天语境中自然出现。可以聊聊想去的地方，或对 TA 说“想看看你”。'}</p>{!favoritesOnly && <button className="secondary-button" type="button" onClick={onChat}>回去聊聊</button>}</div>}
    <p className="asset-attribution">相册中的照片是角色与场景示意，不代表真实的人物身份或实时拍摄。角色图由 AI 生成，场景图来自 Unsplash。</p>
  </section>;
}
export function PhotoLightbox({ photos, initialId, onClose, onFavorite }: { photos: AlbumPhoto[]; initialId: string; onClose: () => void; onFavorite?: (id: string) => void }) {
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((photo) => photo.id === initialId)));
  const photo = photos[Math.min(index, photos.length - 1)];
  const [initialTouch, setInitialTouch] = useState<number | null>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(value + 1, photos.length - 1));
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(value - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length]);
  if (!photo) return null;
  return <Dialog title="一起收藏的此刻" onClose={onClose} className="lightbox"><div className="lightbox-image" onTouchStart={(event) => setInitialTouch(event.touches[0].clientX)} onTouchEnd={(event) => {
    if (initialTouch === null) return;
    const distance = event.changedTouches[0].clientX - initialTouch;
    if (Math.abs(distance) > 60) setIndex((value) => Math.max(0, Math.min(photos.length - 1, value + (distance < 0 ? 1 : -1))));
    setInitialTouch(null);
  }}><Media src={photo.imageUrl} alt={photo.caption} eager /></div>
    <div className="lightbox-meta"><div><p>{photo.caption}</p><span>{sceneLabels[photo.scene]} · {formatDate(photo.createdAt)}</span></div>{onFavorite && <button className={`icon-button ${photo.favorite ? 'is-favorite' : ''}`} type="button" aria-label={photo.favorite ? '取消收藏照片' : '收藏照片'} aria-pressed={photo.favorite} onClick={() => onFavorite(photo.id)}><Heart size={24} weight={photo.favorite ? 'fill' : 'regular'} /></button>}</div>
    {photos.length > 1 && <div className="lightbox-pagination"><button type="button" className="icon-button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="上一张"><CaretLeft size={22} /></button><span>{index + 1} / {photos.length}</span><button type="button" className="icon-button" disabled={index === photos.length - 1} onClick={() => setIndex(index + 1)} aria-label="下一张"><CaretRight size={22} /></button></div>}
    <p className="asset-attribution">角色与场景示意照片 · AI 角色图 / Unsplash 场景图</p>
  </Dialog>;
}
