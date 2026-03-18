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

        let playerIdx = allLayers.length;
        for (let i = 0; i < allLayers.length; i++) {
            if (allLayers[i].zHeight > player.pos.z) {
                playerIdx = i;
                break;
            }
        }

        for (let i = 0; i < playerIdx; i++) {
            this._drawLayer(allLayers[i], level);
        }

        this.renderPlayer(player);

        for (let i = playerIdx; i < allLayers.length; i++) {
            this._drawLayer(allLayers[i], level);
        }
    }

    _drawLayer(layer, level) {
        for (let y = 0; y < level.size.h; y++) {
            for (let x = 0; x < level.size.w; x++) {
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