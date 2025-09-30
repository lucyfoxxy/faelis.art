export function runOnReady(callback) {
  if (typeof callback !== 'function') return;

  const run = () => {
    try {
      callback();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize page script', error);
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    requestAnimationFrame(run);
    return;
  }

  const once = () => {
    requestAnimationFrame(run);
  };

  document.addEventListener('DOMContentLoaded', once, { once: true });
  document.addEventListener('astro:page-load', once, { once: true });
}

export default runOnReady;
