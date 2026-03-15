import { APP_SIZE, APP_MARGIN, CAMERA_MARGIN } from "./constants.js";
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

        this.starting_pos = {x: 5 * 64, y: 5 * 64}
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

        const player_in_view_x = this.player.pos.x - this.view_origin.x;
        const player_in_view_y = this.player.pos.y - this.view_origin.y;

        if (player_in_view_x < CAMERA_MARGIN.x) {
            this.view_origin.x = this.player.pos.x - CAMERA_MARGIN.x;
        } else if (player_in_view_x > APP_SIZE.w - CAMERA_MARGIN.x) {
            this.view_origin.x = this.player.pos.x - (APP_SIZE.w - CAMERA_MARGIN.x);
        }

        this.view_origin.x = Math.max(this.view_origin.x, 0);

        if (player_in_view_y < CAMERA_MARGIN.y) {
            this.view_origin.y = this.player.pos.y - CAMERA_MARGIN.y;
        } else if (player_in_view_y> APP_SIZE.h - CAMERA_MARGIN.y) {
            this.view_origin.y = this.player.pos.y - (APP_SIZE.h - CAMERA_MARGIN.y);
        }

        this.view_origin.y = Math.max(this.view_origin.y, 0);


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