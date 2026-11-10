const stage = document.querySelector('.map-slider-stage');
const slider = stage.querySelector('input');
const handle = stage.querySelector('.map-slider-handle');
const hint = document.getElementById('map-slider-hint');

function updateSplit() {
  const pj = slider.valueAsNumber;
  stage.style.setProperty('--split', `${pj}%`);
  slider.setAttribute('aria-valuetext', `PJ ${pj} %, hráč ${100 - pj} %`);
}

slider.addEventListener('input', updateSplit);
updateSplit();
stage.dataset.active = '';
slider.hidden = false;
handle.hidden = false;
hint.hidden = false;
