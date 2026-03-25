import { APP_SIZE, APP_MARGIN, CAMERA_MARGIN, ISO } from "./constants.js";
import { Renderer } from "./renderer.js";
import { ImageLibrary } from "./image_library.js";
import { Character } from "./character.js";
import { GameMap } from "./game_map.js";
import { FPSTracker } from "./fps_tracker.js";
import { cartesianToIso, isoToCartesian } from './util.js';
import { getTileCoordFromXY } from './util.js';
import { vec2D, add, sub, div, norm, dist, mag, intersect, mult } from './vec2D.js';

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
        this.view_origin = {x: -10.125, y: -.125};

        this.hoveredTile = null;
        this.debugTileHighlight = false;
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

        this.player = new Character({x: 1.5, y: 1.5}, 1);
        this.characters.push(this.player);

        // Add as many NPCs as you want here (they start as identical Player instances)
        this.characters.push(new Character({x: 4.5, y: 2.5}, 1));
        this.characters.push(new Character({x: 6.5, y: 5.5}, 1));
        this.characters.push(new Character({x: 1.5, y: 2.5}, 1));

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
        const lerpFactor = 1.0; 
        this.view_origin.x += (targetWorld.x - this.view_origin.x) * lerpFactor * dt;
        this.view_origin.y += (targetWorld.y - this.view_origin.y) * lerpFactor * dt;
    }

    initUserInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape') {
                this.onEscapeToggle();
            } else if (e.key.toLowerCase() === 'h') {
                this.debugTileHighlight = !this.debugTileHighlight;
            }
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

        this.canvas.addEventListener('click', (e) => this.onMouseClick(e));
        this.canvas.style.cursor = 'crosshair';

        //Prevent text selection / double-click weirdness
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
        const isoY = screenPos.y + viewIso.y + z * ISO.TILE_H;  // correct z-height plane
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
        const start_pos_xy = this.player.getPositionXY();
        const startZ = this.player.getZ();

        const tilePath = this.game_map.findPath(start_pos_xy, startZ,
            world_pos_xy, goalZ);

        if (!tilePath.length) {
            this.player.clearPath();
            return;
        }

        let waypoints = [];
        this._pushWaypoint(waypoints, start_pos_xy.x, start_pos_xy.y, startZ);
        for (let i = 1; i < tilePath.length - 1; ++i)
        {
            const pathPoint = tilePath[i];
            this._pushWaypoint(waypoints, pathPoint.x + 0.5,
                pathPoint.y + 0.5, pathPoint.z);
        }
        this._pushWaypoint(waypoints, world_pos_xy.x, world_pos_xy.y, goalZ);
        this.player.setWaypoints(waypoints);
    }

    _pushWaypoint(waypoints, x, y, z) {
        if (waypoints.length == 0) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const last_waypoint = waypoints[waypoints.length - 1];
        const step_down = last_waypoint.z - z;
        if (Math.abs(step_down) < 0.1) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }
        const from_tile_center = add(getTileCoordFromXY(last_waypoint.x, last_waypoint.y),
            vec2D(0.5, 0.5));
        const to_tile_center = add(getTileCoordFromXY(x, y), vec2D(0.5, 0.5));
        const unit_tile_to_tile_dir = norm(sub(to_tile_center, from_tile_center));
        const along_edge = vec2D(-unit_tile_to_tile_dir.y, unit_tile_to_tile_dir.x);
        const tile_to_tile_midpoint = div(add(from_tile_center, to_tile_center), 2.0);

        const xy_pos = vec2D(x, y);
        const cliff_edge_point = intersect(last_waypoint, xy_pos,
            tile_to_tile_midpoint, add(tile_to_tile_midpoint, along_edge));
        
        if (step_down > .1) {
            const step_xy_dist = dist(cliff_edge_point, xy_pos);
            if (step_xy_dist < .45) {
                waypoints.push({x: tile_to_tile_midpoint.x,
                    y: tile_to_tile_midpoint.y, z: last_waypoint.z});
                waypoints.push({x: to_tile_center.x,
                    y: to_tile_center.y, z: z});
                waypoints.push({x: x, y: y, z: z});
                return;
            }

            waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: last_waypoint.z});
            if (step_xy_dist > .55)
            {
                const along_unit = norm(sub(xy_pos, cliff_edge_point));
                const extra_point = add(cliff_edge_point, mult(along_unit, 0.5));
                waypoints.push({x: extra_point.x, y: extra_point.y, z: z}); 
            }
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const step_xy_dist = dist(last_waypoint, cliff_edge_point);
        if (step_xy_dist < .45) {
            waypoints.push({x: from_tile_center.x,
                y: from_tile_center.y, z: last_waypoint.z});
            waypoints.push({x: tile_to_tile_midpoint.x,
                y: tile_to_tile_midpoint.y, z: z});
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        if (step_xy_dist > .55)
        {
            const along_unit = norm(sub(last_waypoint, cliff_edge_point));
            const jump_point = add(cliff_edge_point, mult(along_unit, 0.5));
            waypoints.push({x: jump_point.x, y: jump_point.y, z: last_waypoint.z}); 
        }
        waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: z});
        waypoints.push({x: x, y: y, z: z}); 
    }
}