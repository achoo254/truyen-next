/* global document, window */
// Runs before the page paints (a file, not an inline script: the CSP allows scripts from the site only), so a
// reader who turned the lights off never sees a flash of bright paper. Same key and values as src/ui/lights.ts.
(function () {
  var dark = false;
  try {
    var saved = window.localStorage.getItem('truyen:lights');
    dark = saved === 'off' || (saved !== 'on' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    // Storage blocked (private mode, settings): the light look.
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
