import { APP_WIDTH, APP_HEIGHT, APP_MARGIN } from "./constants.js";
import { Renderer } from "../systems/renderer.js";

export class App {
    constructor() {
        this.canvas = document.getElementById("mainCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.renderer = new Renderer(this.canvas);
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        requestAnimationFrame((t) => this.loop(t))
    }
    
    resizeCanvas() {
        const aspect_ratio = 16/9;
        let w, h;
        const innerWidth = window.innerWidth - 2 * APP_MARGIN;
        const innerHeight = window.innerHeight - 2 * APP_MARGIN;

        if (innerWidth / innerHeight > aspect_ratio) {
            h = innerHeight;
            w = h * aspect_ratio;
        } else {
            w = innerWidth;
            h = w / aspect_ratio;
        }

        this.canvas.width = APP_WIDTH;
        this.canvas.height = APP_HEIGHT;

        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.style.margin = `${APP_MARGIN}px`;
    }

    loop(msec) {
        this.renderer.render();
        requestAnimationFrame((t) => this.loop(t));
    }
}