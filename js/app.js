import { APP_SIZE, APP_MARGIN } from "./constants.js";
import { Renderer } from "./renderer.js";
import { ImageLibrary } from "./image_library.js";
import { Player } from "./player.js";

export class App {
    constructor() {
        this.canvas = document.getElementById("mainCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.imageLibrary = new ImageLibrary();
        this.imageLibrary.loadAll();

        this.renderer = new Renderer(this.canvas, this.imageLibrary);
        this.player = new Player();
                
        this.keys = {};   
        this.lastTime = 0;
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.initUserInput();

        this.lastTime = performance.now();
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

        this.canvas.width = APP_SIZE.w;
        this.canvas.height = APP_SIZE.h;

        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.style.margin = `${APP_MARGIN}px`;
    }

    loop(time) {
        const delta = Math.min((time - this.lastTime)/1000, 0.1);
        this.updatePhysics(delta);

        this.renderer.render(this.player);

        requestAnimationFrame((t) => this.loop(t));
    }

    updatePhysics(dt) {
        this.player.updatePhysics(dt, this.keys);
    }

    initUserInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        window.addEventListener('contextmenu', () => {
            this.keys = {};
        });
        //Window loses focus
        window.addEventListener('blur', () => {
            this.keys = {};
        });
    }
}