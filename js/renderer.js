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
                    //Always cull here to put less stuff in the list
                    const info = this.current_map.getTileInfoForLayer(x, y, layer);
                    if (!info) continue;

                    //Upper left of tile in iso is not upper left of tile in Cartesian
                    const screen_pos_ul = sub(cartesianToIso(x - 0.5, y + 0.5,
                        layer.zHeight), this.view_origin_iso);

                    if (screen_pos_ul.x <= -ISO.TILE_W ||
                        screen_pos_ul.x >= this.canvas.width + ISO.TILE_W ||
                        screen_pos_ul.y <= -ISO.IMG_H  ||
                        screen_pos_ul.y >= this.canvas.height + ISO.IMG_H) {
                        continue;
                    }
                    if (!this.imageLibrary.get(info.imageName)) continue;

                    //Test y at center of block but down one level
                    const y_sort_point = sub(cartesianToIso(x + 0.5, y + 0.5,
                        layer.zHeight - 1), this.view_origin_iso);

                    drawList.push({
                        type: 'tile',
                        y_sort: y_sort_point.y,
                        z_sort: layer.zHeight - 0.5, //block center is down in z
                        info: info,
                        screen_pos_ul: screen_pos_ul,
                        opacity: layer.opacity || 1
                    });
                }
            }
        }

        for (const character of characters) {
            //Test y at feet of character
            const y_sort_point = sub(cartesianToIso(character.pos.x,
                character.pos.y, character.pos.z), this.view_origin_iso);

            drawList.push({
                type: 'character',
                y_sort: y_sort_point.y,
                z_sort: character.pos.z + 0.5, //character center is up in z
                character: character
            });
        }

        drawList.sort((a, b) => {
            //If we are close to one layer apart, sort by z
            if (Math.abs(a.z_sort - b.z_sort) > 0.99) {
                return a.z_sort - b.z_sort;
            }
            return a.y_sort - b.y_sort;
        });

        for (const item of drawList) {
            if (item.type === 'tile') {
                if (item.opacity !== 1) this.ctx.globalAlpha = item.opacity;
                const img = this.imageLibrary.get(item.info.imageName);
                this.ctx.drawImage(img,
                    item.info.sx, item.info.sy,
                    item.info.sw, item.info.sh,
                    Math.floor(item.screen_pos_ul.x),
                    Math.floor(item.screen_pos_ul.y),
                    item.info.sw, item.info.sh);
                if (item.opacity !== 1) this.ctx.globalAlpha = 1;
            } else if (item.type === 'character') { 
                this.renderCharacter(item.character, false);
            }
        }

        for (const character of characters) {
            this.renderCharacter(character, true);
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
            const shadowInScreen = sub(cartesianToIso(character.pos.x,
                character.pos.y, Math.floor(character.pos.z)), this.view_origin_iso);
            const shadow_ul = sub(shadowInScreen, character.origin);

            const character_shadow = this.imageLibrary.get('player_shadow');
            if (character_shadow) {






                this.ctx.drawImage(character_shadow,
                    0, 0, 64, 32,
                    shadow_ul.x, shadow_ul.y + 42,
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