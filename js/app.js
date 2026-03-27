import { APP_SIZE, APP_MARGIN, ISO } from "./constants.js";
import { Renderer } from "./renderer.js";
import { ImageLibrary } from "./image_library.js";
import { Player } from "./player.js";
import { Npc } from "./npc.js";
import { GameMap } from "./game_map.js";
import { FPSTracker } from "./fps_tracker.js";
import { cartesianToIso, isoToCartesian } from './util.js';
import {vec2D} from './vec2D.js';

export class App {
    constructor() {
        this.canvas = document.getElementById("mainCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.image_library = new ImageLibrary();
        this.renderer = new Renderer(this.canvas, this.image_library);

        this.characters = [];
        this.player = null;
       
        this.game_map = null;
        this.state = "start_screen";

        this.fps_tracker = new FPSTracker();

        this.keys = {};   
        this.last_time = 0;
        this.view_origin = {x: -20.875, y: -.875};

        this.hoveredTile = null;
        this.debugTileHighlight = false;

        this.healthPoints = 11;
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

        this.player = new Player({x: 1.5, y: 1.5}, 1);
        this.player.initializeDefaultItems();   // All item setup now lives on Player

        this.characters.push(this.player);

        this.characters.push(new Npc({x: 4.5, y: 2.5}, 1));
        this.characters.push(new Npc({x: 6.5, y: 5.5}, 1));
        this.characters.push(new Npc({x: 1.5, y: 2.5}, 1));

        this.createHUD();

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
        this.showHUD();
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
        this.hideHUD();
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

        const container = document.getElementById('mainContainer');
        const hud = document.getElementById('hud');

        if (hud) {
            const centeredLeft = (container.clientWidth - w) / 2;
            const centeredTop  = (container.clientHeight - h) / 2;

            hud.style.left   = centeredLeft + 'px';
            hud.style.top    = centeredTop + 'px';
            hud.style.width  = w + 'px';
            hud.style.height = h + 'px';
            hud.style.margin = '0';
        }
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
                this.hoveredTile, this.fps_tracker);
        }
    }

    updatePhysics(dt) {
        if (this.state !== "running") return;

        for (const char of this.characters) {
            char.updatePhysics(dt, this.game_map);
        }

        const playerIso = this.player.getIsoPosition();
        const targetIsoX = playerIso.x - (APP_SIZE.w / 2);
        const targetIsoY = playerIso.y - (APP_SIZE.h / 2);

        const targetWorld = isoToCartesian(targetIsoX, targetIsoY);
        const lerpFactor = 0.2; 
        this.view_origin.x += (targetWorld.x - this.view_origin.x) * lerpFactor * dt;
        this.view_origin.y += (targetWorld.y - this.view_origin.y) * lerpFactor * dt;
        //console.log(this.view_origin);
    }

    initUserInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape') {
                this.onEscapeToggle();
            } else if (e.key.toLowerCase() === 'h') {
                this.debugTileHighlight = !this.debugTileHighlight;
            } else if (this.state === 'running') {
                const num = parseInt(e.key);
                if (num >= 1 && num <= 9) {
                    this.selectSlot(num - 1);
                    e.preventDefault();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        window.addEventListener('contextmenu', () => {
            this.keys = {};
        });

        window.addEventListener('blur', () => {
            this.keys = {};
        });

        this.canvas.addEventListener('click', (e) => this.onMouseClick(e));
        this.canvas.style.cursor = 'crosshair';

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) e.preventDefault();
        });

        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.player) this.player.clearPath();
        });
    }

    screenToWorld(screenPos, z = 0) {
        const viewIso = cartesianToIso(this.view_origin.x, this.view_origin.y, 0);
        const isoX = screenPos.x + viewIso.x;
        const isoY = screenPos.y + viewIso.y + z * ISO.TILE_Z;
        return isoToCartesian(isoX, isoY);
    }

    getPositionFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        return vec2D((e.clientX - rect.left) * (this.canvas.width / rect.width),
            (e.clientY - rect.top)  * (this.canvas.height / rect.height));
    }

    onMouseMove(e) {
        if (!this.debugTileHighlight || this.state !== "running" || !this.game_map) {
            this.hoveredTile = null;
            return;
        }
        this.hoveredTile = this.getHoveredTile(this.getPositionFromEvent(e));
    }

    getHoveredTile(screenPos) {
        if (!this.game_map?.isLoaded) return null;

        for (let i = this.game_map.layers.length - 1; i >= 0; i--) {
            const layer = this.game_map.layers[i];
            const worldPos = this.screenToWorld(screenPos, layer.zHeight);
            
            const tx = Math.floor(worldPos.x);
            const ty = Math.floor(worldPos.y);
            if (this.game_map.getTileInfoForLayer(tx, ty, layer)) {
                return {
                    tileCoord: vec2D(tx, ty),
                    layerZ: layer.zHeight
                };
            }
        }
        return null;
    }

    onMouseClick(e) {
        if (this.state !== "running" || !this.player || !this.game_map) return;

        const clickPos = this.getPositionFromEvent(e);
        const clickedTile = this.getHoveredTile(clickPos);
        if (!clickedTile) {
            this.player.clearPath();
            return;
        }

        const goalZ = clickedTile.layerZ;
        const world_pos_xy = this.screenToWorld(clickPos, goalZ);
        this.player.buildPathToPosition(this.game_map, world_pos_xy, goalZ);
    }

    // ====================== HUD ======================
    createHUD() {
        this.updateHotbarUI();
        this.updateHealthUI();
    }

    showHUD() {
        const hud = document.getElementById("hud");
        if (hud) hud.classList.add("is-active");
    }

    hideHUD() {
        const hud = document.getElementById("hud");
        if (hud) hud.classList.remove("is-active");
    }

    updateHotbarUI() {
        const slotsContainer = document.getElementById("hotbar-slots");
        if (!slotsContainer) return;
        
        slotsContainer.innerHTML = "";

        this.player.hotbar.forEach((slotData, index) => {
            const slot = document.createElement("div");
            slot.className = `slot ${index === this.player.selectedSlot ? "selected" : ""}`;
            slot.dataset.index = index;
            slot.draggable = true;

            const iconDiv = document.createElement("div");
            iconDiv.className = "item-icon";
            iconDiv.textContent = slotData?.item?.icon || "";
            slot.appendChild(iconDiv);

            if (slotData?.item && slotData.count > 1) {
                const countSpan = document.createElement("span");
                countSpan.className = "item-count";
                countSpan.textContent = slotData.count;
                slot.appendChild(countSpan);
            }

            // Drag & Drop support
            slot.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", index.toString());
            });

            slot.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            slot.addEventListener("drop", (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                const toIndex = parseInt(slot.dataset.index);
                
                if (fromIndex !== toIndex) {
                    this.player.swapHotbarSlots(fromIndex, toIndex);
                    this.updateHotbarUI();
                }
            });

            // Click to select
            slot.addEventListener("click", () => {
                this.player.selectedSlot = index;
                this.updateHotbarUI();
            });

            slotsContainer.appendChild(slot);
        });
    }

    selectSlot(index) {
        if (index < 0 || index > 8) return;
        this.player.selectedSlot = index;
        this.updateHotbarUI();

        const selected = this.player.hotbar[index];
        if (selected && selected.item) {
            console.log(`🎮 Selected: ${selected.item.name} (x${selected.count})`);
        }
    }

    updateHealthUI() {
        const container = document.getElementById("hearts-container");
        if (!container) return;

        container.innerHTML = "";

        const fullHearts = Math.floor(this.healthPoints / 2);
        const hasHalfHeart = this.healthPoints % 2 === 1;

        for (let i = 0; i < 10; i++) {
            const heart = document.createElement("div");
            heart.className = "heart";

            if (i < fullHearts) {
                heart.classList.add("full");
            } 
            else if (i === fullHearts && hasHalfHeart) {
                heart.classList.add("half");
            } 
            else {
                heart.classList.add("empty");
            }

            container.appendChild(heart);
        }
    }
}
