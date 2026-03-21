
import { App } from './app.js';

function createApp() {
    const app = new App();
    app.init();
}

if (document.readyState === 'loading') {
    window.addEventListener('load', startApp);
} else {
    createApp();
}