(function initialiseDeviceProfile(global) {
  'use strict';

  const root = document.documentElement;
  const appRoot = document.getElementById('app-root');
  const coarseQuery = global.matchMedia('(pointer: coarse)');
  const fineQuery = global.matchMedia('(pointer: fine)');
  const hoverQuery = global.matchMedia('(hover: hover)');
  let frame = 0;
  let current = null;
  let orientationTipTimer = 0;

  function classify() {
    const width = Math.max(1, global.innerWidth || root.clientWidth);
    const height = Math.max(1, global.innerHeight || root.clientHeight);
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    const touchPoints = Number(global.navigator.maxTouchPoints) || 0;
    const coarse = coarseQuery.matches;
    const fine = fineQuery.matches;
    const hover = hoverQuery.matches;
    const touch = touchPoints > 0 || coarse;
    const orientation = width >= height ? 'landscape' : 'portrait';

    let kind = 'desktop';
    if ((shortestSide <= 540 && longestSide <= 960) || (coarse && longestSide <= 960)) kind = 'phone';
    else if (touch && (coarse || !hover) && shortestSide <= 1100 && longestSide <= 1400) kind = 'tablet';

    let input = 'keyboard';
    if (coarse && !hover) input = 'touch';
    else if (touch && fine) input = 'hybrid';
    else if (touch) input = 'touch';

    return Object.freeze({
      kind,
      input,
      orientation,
      touch,
      coarse,
      fine,
      hover,
      width,
      height,
      compact: kind === 'phone' || height < 620
    });
  }

  function profileLabel(profile) {
    const names = {phone: 'SMARTPHONE', tablet: 'TABLET / IPAD', desktop: 'LAPTOP / DESKTOP'};
    return `${names[profile.kind]} · ${profile.orientation.toUpperCase()}`;
  }

  function controlsLabel(profile) {
    if (profile.input === 'touch') return 'Touch controls enabled automatically';
    if (profile.input === 'hybrid') return 'Touch and keyboard controls available';
    return 'Keyboard controls · WASD / arrows / E';
  }

  function apply() {
    frame = 0;
    const next = classify();
    current = next;
    [root, appRoot].filter(Boolean).forEach(element => {
      element.dataset.device = next.kind;
      element.dataset.input = next.input;
      element.dataset.orientation = next.orientation;
    });

    const profileText = document.getElementById('device-profile');
    const controlsText = document.getElementById('device-controls');
    const orientationTip = document.getElementById('orientation-tip');
    if (profileText) profileText.textContent = profileLabel(next);
    if (controlsText) controlsText.textContent = controlsLabel(next);
    if (orientationTip) {
      global.clearTimeout(orientationTipTimer);
      const showTip = next.kind === 'phone' && next.orientation === 'portrait';
      orientationTip.classList.toggle('hidden', !showTip);
      if (showTip) {
        orientationTipTimer = global.setTimeout(() => orientationTip.classList.add('hidden'), 4000);
      }
    }
    global.dispatchEvent(new CustomEvent('seventhreaction:devicechange', {detail: next}));
  }

  function schedule() {
    if (frame) return;
    frame = global.requestAnimationFrame(apply);
  }

  [coarseQuery, fineQuery, hoverQuery].forEach(query => {
    if (query.addEventListener) query.addEventListener('change', schedule);
    else if (query.addListener) query.addListener(schedule);
  });
  global.addEventListener('resize', schedule, {passive: true});
  global.addEventListener('orientationchange', schedule, {passive: true});

  global.SeventhReactionDevice = Object.freeze({
    get profile() { return current || classify(); },
    refresh: schedule
  });
  apply();
})(globalThis);
