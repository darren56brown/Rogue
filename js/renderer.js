import { APP_SIZE, ISO } from "./constants.js";
import { vec, add, sub, mult } from './vector.js';
import { cartesianToIso } from './util.js';

export class Renderer {
    constructor(canvas, imageLibrary) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.imageLibrary = imageLibrary;
    }

    render(current_map, view_origin, player, fpsTracker = null) {
        this.current_map = current_map;

        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);

        this.view_origin = view_origin;
        this.view_origin_iso = cartesianToIso(view_origin.x,
            view_origin.y, 0);
        
        this.renderGameMap(player);

        if (fpsTracker) {
            fpsTracker.render(this.ctx, 20, 20);
        }
    }

    renderGameMap(player) {
        if (!this.current_map || !this.current_map.isLoaded) return;

        const allLayers = this.current_map.getVisibleTileLayers();

        const playerX = Math.floor(player.pos.x);
        const playerY = Math.floor(player.pos.y);
        const playerCgZ = Math.round(player.pos.z) + 0.5;

        let playerIdx = allLayers.length;
        for (let i = 0; i < allLayers.length; i++) {
            const layerCgZ = allLayers[i].zHeight - 0.5;
            if (Math.abs(playerCgZ - layerCgZ) < 0.5) {
                playerIdx = i;
                break;
            }
        }

        //Below player
        this._renderSubrange(
            0, this.current_map.size.w,
            0, this.current_map.size.h,
            0, playerIdx);

        //Behind player
        this._renderSubrange(
            0, playerX + 1,
            0, playerY + 1,
            playerIdx, playerIdx + 1);

        this.renderPlayer(player, false);
       
        //In front of player
        this._renderSubrange(
            0, playerX + 1,
            playerY + 1, this.current_map.size.h,
            playerIdx, playerIdx + 1);
        this._renderSubrange(
            playerX + 1, this.current_map.size.w,
            0, this.current_map.size.h,
            playerIdx, playerIdx + 1);

        //Above player
        this._renderSubrange(
            0, this.current_map.size.w,
            0, this.current_map.size.h,
            playerIdx + 1, allLayers.length);

        this.renderPlayer(player, true);
    }

    _renderSubrange(xStart, xEnd, yStart, yEnd, zStart, zEnd) {
        const allLayers = this.current_map.getVisibleTileLayers();
        for (let z = zStart; z < zEnd; z++) {
            const layer = allLayers[z];
            for (let y = yStart; y < yEnd; y++) {
                for (let x = xStart; x < xEnd; x++) {
                    //I haven't figured out the magic offset to my own satisfaction yet
                    //It makes the player and the collision correct though.
                    const screenCoord = cartesianToIso(x - 0.5, y + 0.5, layer.zHeight);
                    const screenX = screenCoord.x - this.view_origin_iso.x;
                    const screenY = screenCoord.y - this.view_origin_iso.y;

                    if (screenX <= -ISO.TILE_W ||
                        screenX >= this.canvas.width + ISO.TILE_W ||
                        screenY <= -ISO.IMG_H  ||
                        screenY >= this.canvas.height + ISO.IMG_H) {
                        continue;
                    }

                    const info = this.current_map.getTileInfoForLayer(x, y, layer);
                    if (!info) continue;

                    const img = this.imageLibrary.get(info.imageName);
                    if (!img) continue;

                    if (layer.opacity !== 1) {
                        this.ctx.globalAlpha = layer.opacity;
                    }

                    this.ctx.drawImage(
                        img,
                        info.sx, info.sy, info.sw, info.sh,
                        Math.floor(screenX), Math.floor(screenY),
                        ISO.TILE_W, ISO.IMG_H
                    );

                    if (layer.opacity !== 1) {
                        this.ctx.globalAlpha = 1;
                    }
                }
            }
        }
    }

    renderPlayer(player, forGhost) {
        const playerInScreen = sub(cartesianToIso(player.pos.x,
            player.pos.y, player.pos.z), this.view_origin_iso);
        const player_ul = sub(playerInScreen, player.origin);

        let oldAlpha = this.ctx.globalAlpha;
        if (forGhost == true) {
            this.ctx.globalAlpha = 0.3;
        } else {
            const player_shadow = this.imageLibrary.get('player_shadow');
            if (player_shadow) {
                this.ctx.drawImage(player_shadow,
                    0, 0, 64, 32,
                    player_ul.x, player_ul.y + 42,
                    64, 32);
            }
        }

        const player_base = this.imageLibrary.get('player_base');
        if (player_base) {
            this.ctx.drawImage(player_base,
                player.size.w * player.imageCoord.col,
                player.size.h * player.imageCoord.row,
                player.size.w, player.size.h,
                player_ul.x, player_ul.y,
                player.size.w, player.size.h);
        }

        this.ctx.globalAlpha = oldAlpha;
    }
}