import { APP_SIZE, GRID_SIZE, ISO } from "./constants.js";

export class Renderer {
    constructor(canvas, imageLibrary) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.imageLibrary = imageLibrary;
    }

    render(viewOrigin, player, level, fpsTracker = null) {
        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);

        this.renderLevelWithPlayer(viewOrigin, player, level);

        if (fpsTracker) {
            fpsTracker.render(this.ctx, 20, 20);
        }
    }

    renderLevelWithPlayer(viewOrigin, player, level) {
        if (!level || !level.isLoaded || level.layers.length === 0) return;

        const {HALF_W, HALF_H, TILE_W, IMG_H} = ISO;

        const originSX = (viewOrigin.x - viewOrigin.y) * HALF_W;
        const originSY = (viewOrigin.x + viewOrigin.y) * HALF_H;

        const allLayers = level.getVisibleTileLayers(); // already filtered visible ones

        
        const playerInsertAfterLayerIndex = 2;

        // Draw layers BEFORE player
        for (let i = 0; i <= playerInsertAfterLayerIndex && i < allLayers.length; i++) {
            const layer = allLayers[i];
            this._drawLayer(viewOrigin, layer, originSX, originSY, level, TILE_W, IMG_H);
        }

        // ─── Draw player ───────────────────────────────────────
        this.renderPlayer(viewOrigin, player);

        // Draw layers AFTER player
        for (let i = playerInsertAfterLayerIndex + 1; i < allLayers.length; i++) {
            const layer = allLayers[i];
            this._drawLayer(viewOrigin, layer, originSX, originSY, level, TILE_W, IMG_H);
        }
    }

    // Helper method – draws one full layer (extracted for clarity)
    _drawLayer(viewOrigin, layer, originSX, originSY, level, TILE_W, IMG_H) {
        const {HALF_W, HALF_H} = ISO;

        for (let y = 0; y < level.size.h; y++) {
            for (let x = 0; x < level.size.w; x++) {
                const screenX = (x - y) * HALF_W - originSX;
                const screenY = (x + y) * HALF_H - originSY;

                if (screenX <= -TILE_W || screenX >= this.canvas.width + TILE_W ||
                    screenY <= -IMG_H  || screenY >= this.canvas.height + IMG_H) {
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
                    TILE_W, IMG_H
                );

                if (layer.opacity !== 1) {
                    this.ctx.globalAlpha = 1;
                }
            }
        }
    }

    renderPlayer(viewOrigin, player) {
        const {HALF_W, HALF_H} = ISO;

        // Project everything to screen
        const originSX = (viewOrigin.x - viewOrigin.y) * HALF_W;
        const originSY = (viewOrigin.x + viewOrigin.y) * HALF_H;

        const playerSX = (player.pos.x - player.pos.y) * HALF_W - originSX;
        const playerSY = (player.pos.x + player.pos.y) * HALF_H - originSY;

        // Shadow (tweak y offset if needed)
        const player_shadow = this.imageLibrary.get('player_shadow');
        if (player_shadow) {
            this.ctx.drawImage(player_shadow,
                0, 0, 64, 32,
                playerSX - player.origin.x,
                playerSY - player.origin.y + 42,
                64, 32);
        }

        // Player base
        const player_base = this.imageLibrary.get('player_base');
        if (player_base) {
            this.ctx.drawImage(player_base,
                player.size.w * player.imageCoord.col,
                player.size.h * player.imageCoord.row,
                player.size.w, player.size.h,
                playerSX - player.origin.x,
                playerSY - player.origin.y,
                player.size.w, player.size.h);
        }
    }
}