import { APP_SIZE, ISO } from "./constants.js";
import { sub } from './vec2D.js';
import { cartesianToIso } from './util.js';

export class Renderer {
    constructor(canvas, imageLibrary) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.imageLibrary = imageLibrary;
    }

    render(current_map, view_origin, characters, hoveredTile, fpsTracker) {
        this.current_map = current_map;
        this.hoveredTile = hoveredTile;

        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);

        this.view_origin_iso = cartesianToIso(view_origin.x,
            view_origin.y, 0);
        
        this.renderGameMap(characters);

        if (fpsTracker) {
            fpsTracker.render(this.ctx, 20, 20);
        }
    }

    renderGameMap(characters) {
        if (!this.current_map || !this.current_map.isLoaded) return;

        characters.sort((a, b) => { return a.compareToOther(b); });

        let nextCharacterIdx = 0;
        for (const layer of this.current_map.getVisibleTileLayers()) {
            const map_width = this.current_map.size.w;
            const map_height = this.current_map.size.h;

            //Traverse tiles in perfect draw order
            for (let depth = 0; depth <= (map_width + map_height - 2); depth++) {
                 for (let x = 0; x <= depth; x++) {
                    const y = depth - x;
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

                    const img = this.imageLibrary.get(info.imageName);
                    if (!img) continue;

                    //Test y at center of block but down one level
                    const y_sort_point = cartesianToIso(x + 0.5, y + 0.5,
                        layer.zHeight - 1);
                    //Test z down half to center of block
                    const z_sort = layer.zHeight - 0.5;

                    //Draw any characters left to draw which must be drawn before this tile
                    while (nextCharacterIdx < characters.length) {
                        const nextCharacter = characters[nextCharacterIdx];
                        if (nextCharacter.compareToSortInfo(y_sort_point.y, z_sort) > 0) break;
                        this.renderCharacter(nextCharacter);
                        nextCharacterIdx++;
                    }

                    const opacity = layer.opacity || 1;

                    if (opacity !== 1) this.ctx.globalAlpha = opacity;      
                    this.ctx.drawImage(img,
                        info.sx, info.sy,
                        info.sw, info.sh,
                        Math.floor(screen_pos_ul.x),
                        Math.floor(screen_pos_ul.y),
                        info.sw, info.sh);
                    if (opacity !== 1) this.ctx.globalAlpha = 1;

                    // Debug highlight - glowing outline on the hovered tile
                    if (this.hoveredTile &&
                        x === this.hoveredTile.tileCoord.x &&
                        y === this.hoveredTile.tileCoord.y &&
                        Math.abs(layer.zHeight - this.hoveredTile.layerZ) < 0.1) {
                        //Is a distance check for z appropriate?
                        this.drawIsoTileOutline(screen_pos_ul);
                    }
                }
            }
        }

        //Draw any left over characters
        while (nextCharacterIdx < characters.length) {
            const nextCharacter = characters[nextCharacterIdx];
            this.renderCharacter(nextCharacter);
            nextCharacterIdx++;
        }

        //Redraw all characters so that they appear as ghosts behind walls
        for (const character of characters) {
            this.renderCharacter(character, true);
        }

        this.drawWaypointPath(characters);
    }

    renderCharacter(character, forGhost) {
        const characterInScreen = sub(character.getIsoPosition(), this.view_origin_iso);
        const character_ul = sub(characterInScreen, character.origin);

        let oldAlpha = this.ctx.globalAlpha;
        if (forGhost == true) {
            this.ctx.globalAlpha = 0.3;
        } else {
            const shadowInScreen = sub(character.getShadowIsoPosition(), this.view_origin_iso);
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

    renderTile(item) {
        if (item.opacity !== 1) this.ctx.globalAlpha = item.opacity;
        const img = this.imageLibrary.get(item.info.imageName);
        this.ctx.drawImage(img,
            item.info.sx, item.info.sy,
            item.info.sw, item.info.sh,
            Math.floor(item.screen_pos_ul.x),
            Math.floor(item.screen_pos_ul.y),
            item.info.sw, item.info.sh);
        if (item.opacity !== 1) this.ctx.globalAlpha = 1;
    }

    drawIsoTileOutline(screen_pos_ul) {
        const x = Math.floor(screen_pos_ul.x);
        const y = Math.floor(screen_pos_ul.y);

        this.ctx.save();
        this.ctx.strokeStyle = "#ffaa0065";
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = "#ff5500";
        this.ctx.shadowBlur = 4;
        this.ctx.lineJoin = "round";

        this.ctx.beginPath();
        this.ctx.moveTo(x + 64, y);           // top
        this.ctx.lineTo(x + 128, y + 32);     // right
        this.ctx.lineTo(x + 64, y + 64);      // bottom
        this.ctx.lineTo(x, y + 32);           // left
        this.ctx.closePath();
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawWaypointPath(characters) {
        this.ctx.save();
        this.ctx.strokeStyle = "#00ffcc";
        this.ctx.lineWidth = 3;
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";
        this.ctx.shadowColor = "#00ffcc";
        this.ctx.shadowBlur = 8;

        for (const character of characters) {
            if (character.waypoints && character.waypoints.length >= 2) {
                this.ctx.beginPath();

                let first = true;
                for (const wp of character.waypoints) {
                    // Convert world (x,y,z) → screen iso position
                    const isoPos = cartesianToIso(wp.x, wp.y, wp.z);
                    const screenPos = sub(isoPos, this.view_origin_iso);

                    if (first) {
                        this.ctx.moveTo(screenPos.x, screenPos.y);
                        first = false;
                    } else {
                        this.ctx.lineTo(screenPos.x, screenPos.y);
                    }
                }
                this.ctx.stroke();
            }

            for (const wp of character.waypoints) {
                const isoPos = cartesianToIso(wp.x, wp.y, wp.z);
                const screenPos = sub(isoPos, this.view_origin_iso);

                this.ctx.fillStyle = "#ff0088";
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.restore();
    }
}