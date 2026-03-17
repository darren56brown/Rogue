import { APP_SIZE, APP_MARGIN, CAMERA_MARGIN, ISO } from "./constants.js";
import { Renderer } from "./renderer.js";
import { ImageLibrary } from "./image_library.js";
import { Player } from "./player.js";
import { Level } from "./level.js";
import { FPSTracker } from "./fps_tracker.js";

export class App {
    constructor() {
        this.canvas = document.getElementById("mainCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.image_library = new ImageLibrary();
        this.renderer = new Renderer(this.canvas, this.image_library);

        this.starting_pos = {x: 5, y: 5}
        this.player = new Player(this.starting_pos);

        this.level = null;

        this.fps_tracker = new FPSTracker();

        this.keys = {};   
        this.last_time = 0;
        this.view_origin = {x: 0, y: 0};
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.initUserInput();

        // 1. Start loading images
        this.image_library.loadAll();

        // 2. Start loading the level data (returns a promise)
        // We catch the returned level object and assign it to this.level
        const level_promise = Level.load('level_01')
            .then(loadedLevel => { this.level = loadedLevel; })
            .catch(err => console.error("Level loading failed", err));

        // 3. Create the image loading promise
        const images_promise = new Promise(resolve => {
            this.image_library.onAllLoaded(resolve);
        });

        // 4. Wait for BOTH to finish
        Promise.all([level_promise, images_promise])
            .then(() => {
                //console.log("All assets ready — starting game loop");
                this.last_time = performance.now();
                requestAnimationFrame(t => this.loop(t));
            })
            .catch(err => {
                console.error("Asset loading failed:", err);
            });
    }
    
    resizeCanvas() {
        const aspect_ratio = 16/9;
        let w, h;
        const inner_width = window.innerWidth - 2 * APP_MARGIN;
        const inner_height = window.innerHeight - 2 * APP_MARGIN;

        if (inner_width / inner_height > aspect_ratio) {
            h = inner_height;
            w = h * aspect_ratio;
        } else {
            w = inner_width;
            h = w / aspect_ratio;
        }

        this.canvas.width = APP_SIZE.w;
        this.canvas.height = APP_SIZE.h;

        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.style.margin = `${APP_MARGIN}px`;
    }

    loop(time) {
        const delta = Math.min((time - this.last_time)/1000, 0.1);
        if (this.fps_tracker) {
            this.fps_tracker.update(time);
        }

        this.updatePhysics(delta);

        this.renderer.render(this.view_origin, this.player, this.level,
            this.fps_tracker);

        requestAnimationFrame((t) => this.loop(t));
    }

    updatePhysics(dt) {
        this.player.updatePhysics(dt, this.keys);

        // === ISOMETRIC CAMERA (preserves your original margin behavior) ===
        const {HALF_W, HALF_H} = ISO;

        // Current projected screen position of player
        const originSX = (this.view_origin.x - this.view_origin.y) * HALF_W;
        const originSY = (this.view_origin.x + this.view_origin.y) * HALF_H;
        const playerSX = (this.player.pos.x - this.player.pos.y) * HALF_W - originSX;
        const playerSY = (this.player.pos.x + this.player.pos.y) * HALF_H - originSY;

        let camScreenDX = 0;
        let camScreenDY = 0;

        if (playerSX < CAMERA_MARGIN.x) {
            camScreenDX = playerSX - CAMERA_MARGIN.x;
        } else if (playerSX > APP_SIZE.w - CAMERA_MARGIN.x) {
            camScreenDX = playerSX - (APP_SIZE.w - CAMERA_MARGIN.x);
        }
        if (playerSY < CAMERA_MARGIN.y) {
            camScreenDY = playerSY - CAMERA_MARGIN.y;
        } else if (playerSY > APP_SIZE.h - CAMERA_MARGIN.y) {
            camScreenDY = playerSY - (APP_SIZE.h - CAMERA_MARGIN.y);
        }

        // Convert screen camera shift back to world coordinates
        if (camScreenDX !== 0 || camScreenDY !== 0) {
            const worldDX = (camScreenDX / HALF_W + camScreenDY / HALF_H) / 2;
            const worldDY = (-camScreenDX / HALF_W + camScreenDY / HALF_H) / 2;

            this.view_origin.x += worldDX;
            this.view_origin.y += worldDY;
        }

        // Clamp (optional)
        //this.view_origin.x = Math.max(0, this.view_origin.x);
        //this.view_origin.y = Math.max(0, this.view_origin.y);
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