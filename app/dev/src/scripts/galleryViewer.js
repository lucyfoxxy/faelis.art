import { createGalleryItemsBySlug } from './utils/_slugLoader.js';
import { loadImageWithTransition } from './utils/_transitionLoader.js';

const metas = import.meta.glob('@Content/albumData/*.json', {
  query: '?json',
  eager: true,
});

const assetModules = import.meta.glob('@Assets/albums/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

const itemsBySlug = createGalleryItemsBySlug(metas, assetModules);
const MAX_VISIBLE_THUMBS = 10;
const EXTRA_VISIBLE_THUMBS = 1;

const parseLength = (value) => {
  const length = parseFloat(value);
  return Number.isFinite(length) ? length : null;
};

export default function initGalleryPage() {
  const root = document.querySelector('.media-gallery__hook[data-slug]');
  if (!root) return;

  const slug     = root.getAttribute('data-slug');
  const autoplay = root.getAttribute('data-autoplay') === 'true';
  const random   = root.getAttribute('data-random') === 'true';
  const interval = parseInt(root.getAttribute('data-interval') || '8000', 10);

  const viewer     = root.querySelector('.media-gallery');
  const frame      = viewer?.querySelector('.media-gallery__frame');
  const imgEl      = frame?.querySelector('.media-gallery__image');
  const btnPrev    = frame?.querySelector('.media-gallery__prev');
  const btnNext    = frame?.querySelector('.media-gallery__next');
  const btnPlay    = frame?.querySelector('.media-gallery__playpause');
  const progress   = frame?.querySelector('.media-gallery__progress');
  const thumbs     = viewer?.querySelector('.media-gallery__thumbs');
  const thumbsWrap = thumbs?.querySelector('.media-gallery__thumbs-wrap');
  const thumbsPrev = thumbs?.querySelector('.media-gallery__thumbs-prev');
  const thumbsNext = thumbs?.querySelector('.media-gallery__thumbs-next');

  if (!viewer || !frame || !imgEl || !btnPrev || !btnNext || !btnPlay || !progress || !thumbsWrap || !thumbsPrev || !thumbsNext) return;

  // hier: items kommen bereits mit gehashten URLs aus itemsBySlug
  const items = itemsBySlug.get(slug) ?? [];
  const order = items.map((_, index) => index);
  if (random) order.sort(() => Math.random() - 0.5);

  imgEl.decoding = 'async';

  if (order.length === 0) {
    progress.hidden = true;
    btnPrev.disabled = true;
    btnNext.disabled = true;
    btnPlay.disabled = true;
    btnPlay.hidden = true;
    thumbsPrev.hidden = true;
    thumbsNext.hidden = true;
    const empty = document.createElement('p');
    empty.className = 'media-gallery__empty';
    empty.textContent = 'No artworks available yet.';
    thumbsWrap.removeAttribute('role');
    thumbsWrap.replaceChildren(empty);
    return;
  }

  const hasMultiple = order.length > 1;
  btnPrev.disabled = btnNext.disabled = !hasMultiple;
  btnPrev.hidden = btnNext.hidden = !hasMultiple;
  btnPlay.hidden = !hasMultiple;
  progress.hidden = !hasMultiple;
  let i = 0;
  let timer = null;
  let playing = hasMultiple && autoplay;
  let elapsedBeforePause = 0;
  let tickStartTime = 0;
  let resumeAfterLightbox = false;
  let pauseKenBurns = () => {};
  let resumeKenBurns = () => {};
  let windowStart = 0;
  const configuredWindow = Math.max(
    1,
    Math.min(parseInt(thumbs.getAttribute('data-window') || '', 10) || MAX_VISIBLE_THUMBS, MAX_VISIBLE_THUMBS),
  );
  let maxVisible = configuredWindow;

  const computeWindowFromLayout = () => {
    const wrapRect = thumbsWrap.getBoundingClientRect();
    const thumbsRect = thumbs.getBoundingClientRect();
    const availableWidth = wrapRect.width || thumbsRect.width;

    if (!availableWidth) return configuredWindow;

    const styles = getComputedStyle(thumbsWrap);
    const sampleThumb = thumbsWrap.querySelector('.media-gallery__thumb');
    const sampleWidth = sampleThumb?.getBoundingClientRect().width;
    const thumbSize = (sampleWidth && sampleWidth > 0)
      ? sampleWidth
      : parseLength(styles.gridAutoColumns)
        ?? parseLength(styles.getPropertyValue('--thumb-size'));
    const gap = parseLength(styles.columnGap) ?? parseLength(styles.gap) ?? 0;

    if (!thumbSize || thumbSize <= 0) return configuredWindow;

    const totalWidthPerThumb = thumbSize + gap;
    if (totalWidthPerThumb <= 0) return configuredWindow;

    const fit = Math.floor((availableWidth + gap) / totalWidthPerThumb);
    return Math.max(1, fit);
  };

  const updateMaxVisible = () => {
    const layoutWindow = computeWindowFromLayout();
    const next = Math.max(1, Math.min(configuredWindow, layoutWindow));
    if (next === maxVisible) return false;

    maxVisible = next;
    if (windowStart + maxVisible > order.length) {
      windowStart = Math.max(0, order.length - maxVisible);
    }
    return true;
  };

  thumbs.toggleAttribute('data-has-multiple', hasMultiple);
  thumbsPrev.hidden = thumbsNext.hidden = order.length <= maxVisible;

  const setProgress = (p) => progress.style.setProperty('--p', String(p));
  const updatePlayButton = () => {
    btnPlay.textContent = playing ? '⏸' : '▶';
    btnPlay.setAttribute('aria-label', playing ? 'Pause autoplay' : 'Resume autoplay');
  };

  frame.style.setProperty('--gallery-interval', `${interval}ms`);

  const lightbox = (() => {
    let overlay = document.querySelector('.media-gallery__lightbox');
    let created = false;
    if (!(overlay instanceof HTMLElement)) {
      overlay = document.createElement('div');
      overlay.className = 'media-gallery__lightbox';
      overlay.innerHTML = `
        <figure>
          <img class="media-gallery__lightbox-image" alt="" />
          
          <button class="media-gallery__lightbox-close" type="button" aria-label="Close">×</button>
        </figure>
      `;
      document.body.appendChild(overlay);
      created = true;
    }

    const img = overlay.querySelector('.media-gallery__lightbox-image');
    
    const btnClose = overlay.querySelector('.media-gallery__lightbox-close');

    if (!img || !btnClose) {
      if (created) overlay.remove();
      return null;
    }

    const close = () => {
      overlay.classList.remove('is-open');
      document.body.classList.remove('media-gallery__lightbox-open');
      document.removeEventListener('keydown', handleKey);
      if (resumeAfterLightbox) {
        playing = true;
        resumeAfterLightbox = false;
        updatePlayButton();
        resumeKenBurns();
        run({ resetProgress: false });
      }
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };

    if (!(overlay instanceof HTMLElement)) return null;

    if (!overlay.dataset.bound) {
      btnClose.addEventListener('click', close);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
      });
      overlay.dataset.bound = 'true';
    }

    return {
      open(item) {
        if (!item) return;
        
        img.src = item.full;
        img.alt = item.alt || '';
        overlay.classList.add('is-open');
        document.body.classList.add('media-gallery__lightbox-open');
        document.addEventListener('keydown', handleKey);
      },
      close,
    };
  })();

  const getMaxStart = () => Math.max(0, order.length - maxVisible);

  const renderThumbs = () => {
    updateMaxVisible();
    const fragment = document.createDocumentFragment();
    const end = Math.min(order.length, windowStart + maxVisible + EXTRA_VISIBLE_THUMBS);

    for (let orderIdx = windowStart; orderIdx < end; orderIdx += 1) {
      const item = items[order[orderIdx]];
      if (!item) continue;
      const button = document.createElement('button');
      button.className = 'media-gallery__thumb';
      button.type = 'button';
      button.dataset.index = String(orderIdx);
      button.setAttribute('aria-label', item.alt || `Image ${orderIdx + 1}`);
      button.setAttribute('role', 'listitem');

      const img = document.createElement('img');
      img.src = item.thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';

      button.appendChild(img);
      button.addEventListener('click', () => {
        show(orderIdx, 0);
        run();
      });
      fragment.appendChild(button);
    }

    thumbsWrap.replaceChildren(fragment);
    highlightThumbs();
    updateThumbNav();
  };

  const highlightThumbs = () => {
    thumbsWrap.querySelectorAll('.media-gallery__thumb').forEach((thumb) => {
      const thumbIndex = parseInt(thumb.dataset.index || '', 10);
      const isActive = thumbIndex === i;
      thumb.classList.toggle('active', isActive);
      thumb.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  };

  const ensureThumbVisibility = (direction = 0) => {
    const maxStart = getMaxStart();

    if (direction > 0) {
      if (i < windowStart) {
        windowStart = i;
      } else if (i >= windowStart + maxVisible - 1 && windowStart < maxStart) {
        windowStart = Math.min(i, maxStart);
      }
    } else if (direction < 0) {
      if (i > windowStart + maxVisible - 1) {
        windowStart = Math.max(0, Math.min(i - maxVisible + 1, maxStart));
      } else if (i <= windowStart && windowStart > 0) {
        const target = Math.max(0, Math.min(maxStart, i - maxVisible + 1));
        windowStart = target;
      }
    } else {
      if (i < windowStart) {
        windowStart = i;
      } else if (i >= windowStart + maxVisible) {
        windowStart = Math.max(0, Math.min(i - maxVisible + 1, maxStart));
      }
    }

    renderThumbs();
  };

  const handleResize = () => {
    if (updateMaxVisible()) {
      ensureThumbVisibility(0);
    }
  };

  const updateThumbNav = () => {
    const maxStart = getMaxStart();
    thumbsPrev.disabled = windowStart === 0;
    thumbsNext.disabled = windowStart >= maxStart;
    thumbsPrev.hidden = thumbsNext.hidden = order.length <= maxVisible;
  };

  const show = (idx, direction = 0) => {
    if (order.length === 0) return;
    i = (idx + order.length) % order.length;
    const item = items[order[i]];
    if (!item) return;

    loadImageWithTransition(imgEl, {
      src: item.full,
      alt: item.alt || '',
      fallbackSrc: item.full,
    });

    ensureThumbVisibility(direction);
    setProgress(0);
  };

  const next = () => show(i + 1, 1);
  const prev = () => show(i - 1, -1);

  const tick = () => {
    tickStartTime = performance.now();
    const step = () => {
      if (!playing) return;
      const now = performance.now();
      const elapsed = Math.min(interval, elapsedBeforePause + (now - tickStartTime));
      const progressValue = elapsed / interval;
      setProgress(progressValue);
      if (progressValue >= 1) {
        elapsedBeforePause = 0;
        tickStartTime = 0;
        next();
        run();
      } else {
        timer = requestAnimationFrame(step);
      }
    };
    timer = requestAnimationFrame(step);
  };

  pauseKenBurns = () => {
    imgEl.classList.remove('is-transitioning');
    imgEl.style.opacity = '1';
    imgEl.style.animationPlayState = 'paused';
  };

  resumeKenBurns = () => {
    if (imgEl.style.animationPlayState !== 'paused') return;
    imgEl.style.animationPlayState = '';
    imgEl.style.opacity = '';
  };

  const run = ({ resetProgress = true } = {}) => {
    if (timer) cancelAnimationFrame(timer);
    timer = null;
    if (resetProgress) {
      elapsedBeforePause = 0;
      setProgress(0);
    } else {
      setProgress(Math.min(1, elapsedBeforePause / interval));
    }
    if (playing) {
      resumeKenBurns();
      tick();
    }
  };

  const captureElapsed = () => {
    if (!timer) return;
    const now = performance.now();
    elapsedBeforePause = Math.min(interval, elapsedBeforePause + (now - tickStartTime));
    cancelAnimationFrame(timer);
    timer = null;
    tickStartTime = 0;
  };

  btnPrev.addEventListener('click', (event) => {
    event.stopPropagation();
    prev();
    run();
  });
  btnNext.addEventListener('click', (event) => {
    event.stopPropagation();
    next();
    run();
  });
  btnPlay.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasPlaying = playing;
    playing = !playing;
    updatePlayButton();
    if (wasPlaying && !playing) {
      captureElapsed();
      pauseKenBurns();
    } else if (!wasPlaying && playing) {
      resumeKenBurns();
      run({ resetProgress: false });
    }
  });

  window.addEventListener('resize', handleResize);

  thumbsPrev.addEventListener('click', () => {
    windowStart = Math.max(0, windowStart - maxVisible);
    renderThumbs();
  });
  thumbsNext.addEventListener('click', () => {
    const maxStart = getMaxStart();
    if (windowStart < maxStart) {
      windowStart = Math.min(maxStart, windowStart + maxVisible);
      renderThumbs();
    }
  });

  frame.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button')) return;
    if (lightbox) {
      if (playing) {
        captureElapsed();
        resumeAfterLightbox = true;
        playing = false;
        updatePlayButton();
      }
      pauseKenBurns();
      lightbox.open(items[order[i]]);
    }
  });

  frame.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      frame.click();
    }
  });

  // Thumbnails rendern
  renderThumbs();
  updatePlayButton();
  show(0, 0);
  requestAnimationFrame(handleResize);
  if (autoplay && hasMultiple) run();
}
