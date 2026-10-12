import { APP_RELEASE } from './src/present/release.js';

window.APP_RELEASE = APP_RELEASE;
// The stamp lives outside the React root, so navigation and error pages retain it.
if (!document.getElementById('app-release')) {
  const stamp = document.createElement('footer');
  stamp.id = 'app-release';
  stamp.className = 'release-stamp';
  stamp.setAttribute('aria-label', 'Application release and version');
  stamp.textContent = `Release ${APP_RELEASE.release} · v${APP_RELEASE.version}`;
  document.body.appendChild(stamp);
}
