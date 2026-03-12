
import { App } from './core/app.js';

function startApp() {
    const app = new App();
    app.init();
}

if (document.readyState === 'loading') {
    window.addEventListener('load', startApp);
} else {
    startApp();
}