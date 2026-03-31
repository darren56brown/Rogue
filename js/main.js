
import { App } from './app.js';

function createApp() {
    window.app = new App();
    window.app.loadAll();
}

if (document.readyState === 'loading') {
    window.addEventListener('load', createApp);
} else {
    createApp();
}