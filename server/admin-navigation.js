const panes = [...document.querySelectorAll('[data-admin-pane]')];
const links = [...document.querySelectorAll('.admin-nav a')];
let active;

function render() {
  const target = location.hash.slice(1);
  const pane =
    panes.find(
      (entry) => entry.dataset.adminPane === target && !entry.hidden,
    ) || panes[0];
  for (const entry of panes)
    entry.toggleAttribute('data-active', entry === pane);
  for (const link of links) {
    if (link.hash === '#' + pane.dataset.adminPane)
      link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (pane === active) return;
  const previous = active;
  active = pane;
  if (previous) window.scrollTo({ top: 0, behavior: 'instant' });
}

for (const link of links)
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    render();
  });
window.addEventListener('hashchange', render);
window.addEventListener('stul-admin-public-mode', render);
render();
