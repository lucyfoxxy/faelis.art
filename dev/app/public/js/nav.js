(function () {
  function init(){
    const btn = document.getElementById('menu-btn');
    const nav = document.getElementById('site-nav');
    if (btn && nav) btn.addEventListener('click', () => nav.classList.toggle('open'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
