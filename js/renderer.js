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

    gridToScreen(x, y, z) {
        return sub(cartesianToIso(x, y, z),
            this.view_origin_iso);
    }

    render(view_origin, player, level, fpsTracker = null) {
        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);

        this.view_origin = view_origin;
        this.view_origin_iso = cartesianToIso(view_origin.x,
            view_origin.y, 0);
        
        this.renderLevel(player, level);

        if (fpsTracker) {
            fpsTracker.render(this.ctx, 20, 20);
        }
    }

    renderLevel(player, level) {
        if (!level || !level.isLoaded || level.layers.length === 0) return;

        const allLayers = level.getVisibleTileLayers();

        const playerX = Math.floor(player.pos.x);
        const playerY = Math.floor(player.pos.y);
        const playerZ = Math.floor(player.pos.z);

        let playerIdx = allLayers.length;
        for (let i = 0; i < allLayers.length; i++) {
            if (allLayers[i].zHeight > playerZ) break;
            playerIdx = i;
        }

        for (let i = 0; i <= playerIdx; i++) {
            this._drawLayer(allLayers[i], level, 0, level.size.w,
                0, level.size.h);
        }

        this._drawLayer(allLayers[playerIdx + 1], level, 0, playerX + 1,
            0, playerY + 1);
        this.renderPlayer(player);
        
        this._drawLayer(allLayers[playerIdx + 1], level, 0,playerX + 1,
            playerY + 1, level.size.h);
        this._drawLayer(allLayers[playerIdx + 1], level, playerX + 1,level.size.w,
            0, level.size.h);

        for (let i = playerIdx + 2; i < allLayers.length; i++) {
            this._drawLayer(allLayers[i], level, 0, level.size.w,
                0, level.size.h);
        }
    }

    _drawLayer(layer, level, xStart, xEnd, yStart, yEnd) {
        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                //I haven't figured out the -1 to my own satisfaction yet
                //It makes the player and the collision correct though.
                const screenCoord = cartesianToIso(x - 1, y, layer.zHeight);
                const screenX = screenCoord.x - this.view_origin_iso.x;
                const screenY = screenCoord.y - this.view_origin_iso.y;

                if (screenX <= -ISO.TILE_W ||
                    screenX >= this.canvas.width + ISO.TILE_W ||
                    screenY <= -ISO.IMG_H  ||
                    screenY >= this.canvas.height + ISO.IMG_H) {
                    continue;
                }

                const info = level.getTileInfoForLayer(x, y, layer);
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

    renderPlayer(player) {
        const playerInScreen = this.gridToScreen(player.pos.x,
            player.pos.y, player.pos.z);
        const player_ul = sub(playerInScreen, player.origin);

        const player_shadow = this.imageLibrary.get('player_shadow');
        if (player_shadow) {
            this.ctx.drawImage(player_shadow,
                0, 0, 64, 32,
                player_ul.x, player_ul.y + 42,
                64, 32);
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
    }
}