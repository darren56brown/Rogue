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

    render(current_map, view_origin, characters, fpsTracker = null) {
        this.current_map = current_map;

        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);

        this.view_origin = view_origin;
        this.view_origin_iso = cartesianToIso(view_origin.x,
            view_origin.y, 0);
        
        this.renderGameMap(characters);

        if (fpsTracker) {
            fpsTracker.render(this.ctx, 20, 20);
        }
    }

    renderGameMap(characters) {
        if (!this.current_map || !this.current_map.isLoaded) return;

        const drawList = [];
        const allLayers = this.current_map.getVisibleTileLayers();


        for (const layer of allLayers) {
            for (let y = 0; y < this.current_map.size.h; y++) {
                for (let x = 0; x < this.current_map.size.w; x++) {
                    const info = this.current_map.getTileInfoForLayer(x, y, layer);
                    if (!info) continue;

                    const isoPos = cartesianToIso(x - 0.5, y + 0.5, layer.zHeight);
                    const screenPos = sub(isoPos, this.view_origin_iso);

                    if (screenPos.x <= -ISO.TILE_W ||
                        screenPos.x >= this.canvas.width + ISO.TILE_W ||
                        screenPos.y <= -ISO.IMG_H  ||
                        screenPos.y >= this.canvas.height + ISO.IMG_H) {
                        continue;
                    }

                    const img = this.imageLibrary.get(info.imageName);
                    if (!img) continue;

                    drawList.push({
                        type: 'tile',
                        screenY: screenY,
                        img,
                        sx: info.sx, sy: info.sy,
                        sw: info.sw, sh: info.sh,
                        drawX: Math.floor(screenPos.x),
                        drawY: Math.floor(screenPos.y),
                        opacity: layer.opacity || 1
                    });
                }
            }
        }

        for (const character of characters) {
            const screenPos = sub(cartesianToIso(character.pos.x,
                character.pos.y, character.pos.z), this.view_origin_iso);
            drawList.push({
                type: 'character',
                screenY: screenPos.y,
                character
            });
        }

        drawList.sort((a, b) => a.screenY - b.screenY);

        for (const item of drawList) {
            if (item.type === 'tile') {
                if (item.opacity !== 1) this.ctx.globalAlpha = item.opacity;
                this.ctx.drawImage(item.img,
                    item.sx, item.sy,
                    item.sw, item.sh,
                    item.drawX, item.drawY,
                    item.sw, item.sh);
                if (item.opacity !== 1) this.ctx.globalAlpha = 1;
            } else if (item.type === 'character') { 
                this.renderCharacter(item.character, false);
            }
        }
    }

    renderCharacter(character, forGhost) {
        const characterInScreen = sub(cartesianToIso(character.pos.x,
            character.pos.y, character.pos.z), this.view_origin_iso);
        const character_ul = sub(characterInScreen, character.origin);

        let oldAlpha = this.ctx.globalAlpha;
        if (forGhost == true) {
            this.ctx.globalAlpha = 0.3;
        } else {
            const character_shadow = this.imageLibrary.get('player_shadow');
            if (character_shadow) {
                this.ctx.drawImage(character_shadow,
                    0, 0, 64, 32,
                    character_ul.x, character_ul.y + 42,
                    64, 32);
            }
        }

        const character_base = this.imageLibrary.get('player_base');
        if (character_base) {
            this.ctx.drawImage(character_base,
                character.size.w * character.imageCoord.col,
                character.size.h * character.imageCoord.row,
                character.size.w, character.size.h,
                character_ul.x, character_ul.y,
                character.size.w, character.size.h);
        }

        this.ctx.globalAlpha = oldAlpha;
    }
}