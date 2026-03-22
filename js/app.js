import { APP_SIZE, APP_MARGIN, CAMERA_MARGIN, ISO } from "./constants.js";
import { Renderer } from "./renderer.js";
import { ImageLibrary } from "./image_library.js";
import { Character } from "./character.js";
import { GameMap } from "./game_map.js";
import { FPSTracker } from "./fps_tracker.js";
import { cartesianToIso, isoToCartesian } from './util.js';
import { sub, setAdd } from './vector.js';

export class App {
    constructor() {
        this.canvas = document.getElementById("mainCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.image_library = new ImageLibrary();
        this.renderer = new Renderer(this.canvas, this.image_library);

        //Characters are sorted by screen position in render
        //so do not count on their order in any way.
        this.characters = [];
        this.player = null;
       
        this.game_map = null;
        this.state = "start_screen";

        this.fps_tracker = new FPSTracker();

        this.keys = {};   
        this.last_time = 0;
        this.view_origin = {x: 0, y: 0};
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.initUserInput();
        this.initUI();

        this.image_library.loadAll();

        const game_map_promise = GameMap.load('level_01')
            .then(loadedLevel => { this.game_map = loadedLevel; })
            .catch(err => console.error("Level loading failed", err));

        const images_promise = new Promise(resolve => {
            this.image_library.onAllLoaded(resolve);
        });

        Promise.all([game_map_promise, images_promise])
            .then(() => {
                this.initPhysics();
                requestAnimationFrame(t => this.loop(t));
            })
            .catch(err => console.error("Asset loading failed:", err));
    }

    initPhysics() {
        this.characters = [];

        const starting_pos = {x: 1.5, y: 1.5, z: 1};
            this.player = new Character(starting_pos);
            this.characters.push(this.player);

        // Add as many NPCs as you want here (they start as identical Player instances)
        this.characters.push(new Character({x: 4.5, y: 2.5, z: 1}));
        this.characters.push(new Character({x: 6.5, y: 5.5, z: 1}));
        this.characters.push(new Character({x: 1.5, y: 2.5, z: 1}));

        this.last_time = performance.now();
    }

    initUI(){
        document.getElementById("playButton").onclick = () => this.onPlayClick();
        document.getElementById("resumeButton").onclick = () => this.onResumeClick();
        document.getElementById("quitButton").onclick = () => this.onQuitClick();
    }

    onPlayClick(){
        this.state = "running";
        this.hideAllPanels();
    }

    onEscapeToggle() {
        if (this.state === 'running') {
            this.state = "paused";
            document.getElementById("pauseMenu").classList.add("is-active");
        } else if (this.state === 'paused') {
            this.state = "running";
            document.getElementById("pauseMenu").classList.remove("is-active");
        }
    }

    onResumeClick(){
        if (this.state === 'running') return;
        this.onEscapeToggle();
    }

    onQuitClick(){
        this.fullRestart();
    }

    hideAllPanels(){
        document.querySelectorAll(".ui-panel").forEach(p => p.classList.remove("is-active"));
    }

    fullRestart(){
        this.state = "start_screen";
        this.hideAllPanels();
        document.getElementById("mainMenu").classList.add("is-active");
        this.initPhysics();
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
        if (this.fps_tracker) this.fps_tracker.update(time);

        this.updatePhysics(delta);
        this.render();
        
        requestAnimationFrame((t) => this.loop(t));
    }

    render() {
        if (this.state === "start_screen") {
            this.ctx.fillStyle = "#0f3460";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.renderer.render(this.game_map, this.view_origin, this.characters,
                this.fps_tracker);

        }
    }

    updatePhysics(dt) {
        if (this.state !== "running") return;

        for (const char of this.characters) {
            if (char === this.player) {
                char.updatePhysics(dt, this.keys, this.game_map);
            } else {
                char.updatePhysics(dt, null, this.game_map);
            }
        }

        this.view_origin_iso = cartesianToIso(this.view_origin.x,
            this.view_origin.y, 0);
        const playerInScreen = sub(this.player.getIsoPosition(), this.view_origin_iso);

        let camScreenDX = 0;
        let camScreenDY = 0;

        if (playerInScreen.x < CAMERA_MARGIN.x) {
            camScreenDX = playerInScreen.x - CAMERA_MARGIN.x;
        } else if (playerInScreen.x > APP_SIZE.w - CAMERA_MARGIN.x) {
            camScreenDX = playerInScreen.x - (APP_SIZE.w - CAMERA_MARGIN.x);
        }
        if (playerInScreen.y < CAMERA_MARGIN.y) {
            camScreenDY = playerInScreen.y - CAMERA_MARGIN.y;
        } else if (playerInScreen.y > APP_SIZE.h - CAMERA_MARGIN.y) {
            camScreenDY = playerInScreen.y - (APP_SIZE.h - CAMERA_MARGIN.y);
        }

        if (camScreenDX !== 0 || camScreenDY !== 0) {
            const worldDelta = isoToCartesian(camScreenDX, camScreenDY);
            setAdd(this.view_origin, worldDelta);
        }
    }

    initUserInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            if (e.key === 'Escape') this.onEscapeToggle();
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