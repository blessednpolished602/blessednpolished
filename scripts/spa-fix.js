// Legacy: copied index.html → 404.html for GitHub Pages SPA routing.
// GitHub Pages is no longer used. Hosting is Digital Ocean App Platform,
// which uses public/_redirects ("/* /index.html 200") for SPA fallback.
// This script is kept as a no-op to avoid breaking the postbuild hook.
import { copyFileSync } from 'node:fs';
copyFileSync('dist/index.html', 'dist/404.html');
console.log('SPA 404 fallback created (legacy, harmless).');
