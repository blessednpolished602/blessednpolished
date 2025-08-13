// copies index.html to 404.html so GitHub Pages serves SPA routes
import { copyFileSync } from 'fs';
copyFileSync('dist/index.html', 'dist/404.html');
console.log('SPA 404 fallback created.');
