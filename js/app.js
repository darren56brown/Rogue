import { APP_SIZE, APP_MARGIN, ISO } from "./constants.js";
import { Renderer } from "./renderer.js";
import { ImageLibrary } from "./image_library.js";
import { Player } from "./player.js";
import { GameMap } from "./game_map.js";
import { FPSTracker } from "./fps_tracker.js";
import { cartesianToIso, isoToCartesian } from './util.js';
import { loadAllUITemplates } from "./util_ui.js";
import { vec2D, sub, magSq, mult, setAdd } from './vec2D.js';
import { SpriteViewer } from './sprite_viewer.js';
import { ConversationUI } from "./conversation_ui.js";
import { InventoryUI } from "./inventory_ui.js";
import { TradeUI } from "./trade_ui.js";

export class App {
    constructor() {
        this.canvas = document.getElementById("mainCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.image_library = new ImageLibrary();
        this.renderer = new Renderer(this.canvas, this.image_library);

        this.player = null;
       
        this.game_maps = new Map();
        this.item_library = new Map();
        this.current_game_map = null;
        this.switching_maps = false;
        this.state = "start_screen";

        this.fps_tracker = new FPSTracker();

        this.keys = {};   
        this.last_time = 0;
        this.view_origin = vec2D(-20.875, -.875);

        this.last_screen_pos = vec2D(0, 0);
        this.highlighted_tile = null;
        this.highlighted_character = null;
        this.selected_character = null;

        this.healthPoints = 7;

        this.spriteViewer = null;
        this.conversationUI = null;
        this.inventoryUI = null;
        this.tradeUI = null;
    }

    async smartGetMap(mapName) {
        if (this.game_maps.has(mapName)) {
            return this.game_maps.get(mapName);
        }
        const map = new GameMap(mapName);
        await map.loadAll(this.image_library, this.item_library);
        this.game_maps.set(mapName, map);
        return map;
    }

    async switchMap(targetMapName, targetPos) {
        if (this.switching_maps) return;
        this.switching_maps = true;

        const loadingEl = document.getElementById("loadingPanel");
        const hudEl = document.getElementById("hud");

        // Close open UIs
        this.hideAllPanels();
        if (this.spriteViewer?.isActive) this.spriteViewer.deactivate();
        if (this.conversationUI) this.conversationUI.closeConversation?.();

        // Instant black flash
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Show loading screen
        if (hudEl) hudEl.classList.remove("is-active");
        if (loadingEl) loadingEl.classList.add("is-active");

        // Force browser to paint black + loading screen
        await new Promise(r => setTimeout(r, 16));
        await new Promise(r => requestAnimationFrame(r));

        const startTime = performance.now();

        try {
            const newMap = await this.smartGetMap(targetMapName);

            this.current_game_map = newMap;

            // Teleport player
            this.player.setPositionXY({ x: targetPos.x, y: targetPos.y });
            this.player.setZ(targetPos.z);
            this.player.clearPath();
            this.player.stopFollowing();

            this.characters = [...this.current_game_map.npcs];
            this.characters.push(this.player);

            // Snap camera
            const playerIso = this.player.getIsoPosition();
            const targetIsoX = playerIso.x - (APP_SIZE.w / 2);
            const targetIsoY = playerIso.y - (APP_SIZE.h / 2);
            const targetWorld = isoToCartesian(targetIsoX, targetIsoY);
            this.view_origin = targetWorld;

        } catch (err) {
            console.error("Map switch failed:", err);
        } finally {
            const elapsed = performance.now() - startTime;
            const remaining = Math.max(0, 1000 - elapsed);
            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, remaining));
            }

            // Hide loading and restore HUD
            if (loadingEl) loadingEl.classList.remove("is-active");
            if (hudEl) hudEl.classList.add("is-active");

            this.switching_maps = false;
        }
    }

    async loadAll() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.initUserInput();

        await loadAllUITemplates();
        await this.image_library.loadAll();
        this.initUI();

        this.game_maps = new Map();
        this.current_game_map = await this.smartGetMap("level_01");

        this.spriteViewer = new SpriteViewer(this.image_library,
            () => this._viewerOnOpen(), () => this._viewerOnClose());
        this.conversationUI = new ConversationUI(this.image_library,
            () => this._viewerOnOpen(), () => this._viewerOnClose());
        this.inventoryUI = new InventoryUI(this.image_library,
            () => this._viewerOnOpen(), () => this._viewerOnClose());
        this.tradeUI = new TradeUI(this.image_library,
            () => this._viewerOnOpen(), () => this._viewerOnClose());

        this.initPhysics();
        requestAnimationFrame(t => this.loop(t));
    }

    initPhysics() {
        this.player = new Player(this.current_game_map.playerStart,
            this.image_library, this.item_library, "player_base");
        this.player.initializeDefaultItems();

        this.characters = [...this.current_game_map.npcs];
        this.characters.push(this.player);

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
            this.setPauseState(true);
        } else if (this.state === 'paused') {
            this.setPauseState(false);
        }
    }

    setPauseState(state) {
        if (state == true) {
            if (this.state == "paused") return;
            this.state = "paused";
            document.getElementById("pauseMenu").classList.add("is-active");
        } else {
            if (this.state == "running") return;
            this.state = "running";
            document.getElementById("pauseMenu").classList.remove("is-active");
        }
    }

    onResumeClick(){
        this.setPauseState(false);
    }

    onQuitClick(){
        this.fullRestart();
    }

    hideAllPanels(){
        document.querySelectorAll(".ui-panel").forEach(p => p.classList.remove("is-active"));
    }

    async fullRestart(){
        this.state = "start_screen";
        this.hideAllPanels();
        this.hideHUD();

        this.game_maps = new Map();
        this.current_game_map = await this.smartGetMap("level_01");

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

            document.documentElement.style.setProperty('--game-vh', `${h / 100}px`);
        }
    }

    loop(time) {
        const delta = Math.min((time - this.last_time)/1000, 0.1);
        if (this.fps_tracker) this.fps_tracker.compute(time);

        this.updatePhysics(delta);
        this.render();
        
        requestAnimationFrame((t) => this.loop(t));
    }

    render() {
        // Stay black while switching maps
        if (this.switching_maps) {
            this.ctx.fillStyle = "#000000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        if (this.state === "start_screen") {
            this.ctx.fillStyle = "#0f3460";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.renderer.render(this.current_game_map, this.view_origin, this.characters,
                this.highlighted_tile, this.highlighted_character,
                this.selected_character);

            if (this.fps_tracker) this.fps_tracker.draw();
        }

        if (this.spriteViewer) {
            this.spriteViewer.draw();
        }
    }

    updatePhysics(dt) {
        if (this.spriteViewer) {
            this.spriteViewer.updatePhysics(dt);
        }

        if (this.state !== "running") return;

        for (const char of this.characters) {
            char.updatePhysics(dt, this.current_game_map);
        }

        if (this.player.follow_success &&
            this.player.follow_target &&
            this.player.follow_target.conversation) {
            const follow_target = this.player.follow_target;
            this.player.stopFollowing();
            this.selected_character = null;
            this.conversationUI.startConversation(follow_target);
        }

        const portal = this.current_game_map.getPortalAt(
            this.player.getPositionXY(), this.player.getZ());
        if (portal) {
            this.switchMap(portal.targetMap, portal.targetPlayerStart);
        }

        const playerIso = this.player.getIsoPosition();
        const targetIsoX = playerIso.x - (APP_SIZE.w / 2);
        const targetIsoY = playerIso.y - (APP_SIZE.h / 2);

        const targetWorld = isoToCartesian(targetIsoX, targetIsoY);
        const lerpFactor = 0.2;

        const view_origin_error = sub(targetWorld, this.view_origin);
        if (magSq(view_origin_error) > 1e-3)
            setAdd(this.view_origin, mult(view_origin_error, lerpFactor * dt));

        this.updateHighlights();
    }

    initUserInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape') {
                this.onEscapeToggle();
            } else if (e.key.toLowerCase() === 'v') {
                if (this.state === "start_screen") return;
                if (this.spriteViewer.isActive) {
                    this.spriteViewer.deactivate();
                } else if (this.selected_character) {
                    this.spriteViewer.activate(this.selected_character);
                } else {
                    this.spriteViewer.activate(this.player);
                }
            } else if (e.key.toLowerCase() === 'i') {
                if (this.state !== "running") return;
                if (this.inventoryUI.isActive()) {
                    this.inventoryUI.deactivate();
                } else {
                    this.inventoryUI.activate(this.player);
                }
            } else if (e.key.toLowerCase() === 't') {
                if (this.state !== "running") return;
                if (this.tradeUI.isActive()) {
                    this.tradeUI.deactivate();
                } else if (this.selected_character) {
                    this.tradeUI.activate(this.player, this.selected_character);
                }
            } else if (this.state === 'running') {
                const num = parseInt(e.key);
                if (num >= 1 && num <= 9) {
                    e.preventDefault();
                    this.selectSlot(num - 1);
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.selectSlot(9);
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

        this.canvas.addEventListener('click', (e) => this.onLeftMouseClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onRightMouseClick(e));
        this.canvas.style.cursor = 'crosshair';

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) e.preventDefault();
        });

        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
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
        this.last_screen_pos = this.getPositionFromEvent(e);
        this.updateHighlights();
    }

    updateHighlights() {
        if (this.state !== "running") {
            this.highlighted_tile = null;
            this.highlighted_character = null;
            return;
        }
        this.highlighted_character = this.getMouseOverCharacter(this.last_screen_pos);
        if (this.highlighted_character) {
            this.highlighted_tile = null;
        } else {
            this.highlighted_tile = this.getMouseOverTile(this.last_screen_pos);
        }
    }

    getMouseOverTile(screenPos) {
        if (!this.current_game_map?.isLoaded) return null;

        for (let i = this.current_game_map.layers.length - 1; i >= 0; i--) {
            const layer = this.current_game_map.layers[i];
            const worldPos = this.screenToWorld(screenPos, layer.zHeight);
            
            const tx = Math.floor(worldPos.x);
            const ty = Math.floor(worldPos.y);
            if (this.current_game_map.getTileInfoForLayer(tx, ty, layer)) {
                return {
                    tileCoord: vec2D(tx, ty),
                    layerZ: layer.zHeight
                };
            }
        }
        return null;
    }

    getMouseOverCharacter(screenPos) {
        if (!this.characters || this.characters.length === 0 || !this.renderer) return null;

        const viewIso = cartesianToIso(this.view_origin.x, this.view_origin.y, 0);

        let bestChar = null;
        let bestDist = Infinity;

        for (const char of this.characters) {
            if (char === this.player) continue;   // don't highlight the player

            const charIso = char.getIsoPosition();
            const charScreen = sub(charIso, viewIso);
            const ul = sub(charScreen, char.origin);

            const br = {
                x: ul.x + char.size.w,
                y: ul.y + char.size.h
            };

            // mouse is inside the character's sprite bounding box?
            if (screenPos.x >= ul.x && screenPos.x <= br.x &&
                screenPos.y >= ul.y && screenPos.y <= br.y) {

                const centerX = ul.x + char.size.w / 2;
                const centerY = ul.y + char.size.h / 2;
                const dist = Math.hypot(screenPos.x - centerX, screenPos.y - centerY);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestChar = char;
                }
            }
        }
        return bestChar;
    }

    onLeftMouseClick(e) {
        if (this.state !== "running") return;

        this.player.clearPath();
        this.player.stopFollowing();

        if (this.highlighted_character && this.highlighted_character !== this.player) {
            this.selected_character = this.highlighted_character;
            return;
        }
        this.selected_character = null;
    }

    onRightMouseClick(e) {
        e.preventDefault();
        if (this.state !== "running") return;

        if (this.highlighted_character && this.highlighted_character !== this.player) {
            this.selected_character = this.highlighted_character;
            this.player.startFollowing(this.highlighted_character);
            return;
        }

        if (this.highlighted_tile) {
            const tile_z = this.highlighted_tile.layerZ;
            const screen_pos = this.getPositionFromEvent(e);
            const world_pos_xy = this.screenToWorld(screen_pos, tile_z);
            this.player.moveTo(this.current_game_map, {x: world_pos_xy.x, y: world_pos_xy.y, z: tile_z});
            return;
        }

        this.player.clearPath();
        this.player.stopFollowing();
    }

    createHUD() {
        this.updateHotbarUI();
        this.updateHealthUI();
    }

    showHUD() {
        const hud = document.getElementById("hud");
        if (hud) hud.classList.add("is-active");
        if (this.fps_tracker) this.fps_tracker.show();
    }

    hideHUD() {
        const hud = document.getElementById("hud");
        if (hud) hud.classList.remove("is-active");
        if (this.fps_tracker) this.fps_tracker.hide();
    }

    updateHotbarUI() {
        const slotsContainer = document.getElementById("hotbar-slots");
        if (!slotsContainer) return;
        
        //slotsContainer.addEventListener('contextmenu', e => e.preventDefault(), { once: true });
        slotsContainer.innerHTML = "";

        const NUM_HOTBAR_SLOTS = 10;
        for (let index = 0; index < NUM_HOTBAR_SLOTS; ++index)
        {
            const slot_element = document.createElement("div");
            slot_element.className = `slot ${index == this.player.selectedSlot ? "selected" : ""}`;
            slot_element.dataset.index = index;
            slot_element.draggable = true;
            slot_element.addEventListener('contextmenu', e => {
                e.preventDefault();
               //this.openSplitDialog(i, e);
            });

            const iconDiv = document.createElement("div");
            iconDiv.className = "item-icon";

            const slot = this.player.inventorySlots[index];

            iconDiv.textContent = slot ? slot.def.icon : "";
            slot_element.appendChild(iconDiv);

            if (slot && slot.count > 1) {
                const countSpan = document.createElement("span");
                countSpan.className = "item-count";
                countSpan.textContent = slot.count;
                slot_element.appendChild(countSpan);
            }

            slot_element.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", index.toString());
            });

            slot_element.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            slot_element.addEventListener("drop", (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                const toIndex = parseInt(slot_element.dataset.index);
                
                if (fromIndex !== toIndex) {
                    this.player.swapHotbarSlots(fromIndex, toIndex);
                    this.updateHotbarUI();
                }
            });

            slot_element.addEventListener("click", () => {
                this.player.selectedSlot = index;
                this.updateHotbarUI();
            });

            slotsContainer.appendChild(slot_element);
        };
    }

    selectSlot(index) {
        if (index < 0 || index > 9) return;
        this.player.selectedSlot = index;
        this.updateHotbarUI();
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

    _viewerOnOpen() {
        this.setPauseState(true);
        this.hideHUD();
    }

    _viewerOnClose() {
        this.setPauseState(false); 
        this.showHUD(); 
        this.updateHotbarUI();
    }
}
