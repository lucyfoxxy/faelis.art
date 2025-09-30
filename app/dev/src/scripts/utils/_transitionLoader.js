export function loadImageWithTransition(imgEl, { src, alt = '', fallbackSrc, onApply } = {}) {
  if (!(imgEl instanceof HTMLImageElement) || !src) return null;

  const applyImage = (finalSrc) => {
    imgEl.src = finalSrc;
    imgEl.alt = alt;
    if (typeof onApply === 'function') {
      onApply();
    }
    requestAnimationFrame(() => {
      void imgEl.offsetWidth;
      imgEl.classList.add('is-animating');
      imgEl.classList.remove('is-transitioning');
    });
  };

  const loader = new Image();
  loader.decoding = 'async';

  imgEl.classList.remove('is-animating');
  imgEl.classList.add('is-transitioning');

  loader.addEventListener('load', () => {
    applyImage(src);
  }, { once: true });

  loader.addEventListener('error', () => {
    applyImage(fallbackSrc ?? src);
  }, { once: true });

  loader.src = src;
  return loader;
}
