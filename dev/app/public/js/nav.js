(function () {
  function init(){
    const btn = document.getElementById('burger');
    const nav = document.getElementById('primaryNav');
    if (btn && nav) btn.addEventListener('click', () => nav.classList.toggle('open'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
