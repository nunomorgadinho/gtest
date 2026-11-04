/* Aplica o tema e a vista guardados antes de a página ser desenhada (evita o "flash"). */
(() => {
  try {
    const root = document.documentElement;
    const t = localStorage.getItem('wlmon-theme');
    if (t === 'light' || t === 'dark') root.dataset.theme = t;
    const v = localStorage.getItem('wlmon-view');
    if (v === 'basic' || v === 'advanced') root.dataset.view = v;
  } catch (e) { /* sem armazenamento: usa o tema do sistema e a vista por omissão */ }
})();
