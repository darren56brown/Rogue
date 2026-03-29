import { APP_SIZE } from "./constants.js";
import { sub, vec2D } from './vec2D.js';
import { cartesianToIso } from './util.js';

export class Renderer {
    constructor(canvas, imageLibrary) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.imageLibrary = imageLibrary;

     
        this.highlighted_character = null;
        this.selected_character = null;
        this.highlighted_tile = null;
    }

    render(current_map, view_origin, characters, highlighted_tile,
        highlighted_character, selected_character) {
        this.current_map = current_map;
        this.highlighted_tile = highlighted_tile;
        this.highlighted_character = highlighted_character;
        this.selected_character = selected_character;

        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);

        this.view_origin_iso = cartesianToIso(view_origin.x, view_origin.y, 0);
        
        this.renderGameMap(characters);
    }

    renderGameMap(characters) {
        if (!this.current_map || !this.current_map.isLoaded) return;

        characters.sort((a, b) => a.compareToOther(b));

        let nextCharacterIdx = 0;

        for (const drawItem of this.current_map.drawList) {
            const screen_pos_ul = sub(cartesianToIso(drawItem.x - 0.5, drawItem.y + 0.5,
                drawItem.layer.zHeight), this.view_origin_iso);

            const info = this.current_map.getTileInfoForLayer(drawItem.x, drawItem.y, drawItem.layer);
            if (!info) continue;

            if (screen_pos_ul.x <= -info.sw ||
                screen_pos_ul.x >= this.canvas.width + info.sw ||
                screen_pos_ul.y <= -info.sh ||
                screen_pos_ul.y >= this.canvas.height + info.sh) {
                continue;
            }

            const img = this.imageLibrary.get(info.imageName);
            if (!img) continue;

            const xy_sort = vec2D(drawItem.x + 0.5, drawItem.y + 0.5);
            const z_sort = drawItem.layer.zHeight - 0.5;

            while (nextCharacterIdx < characters.length) {
                const nextCharacter = characters[nextCharacterIdx];
                if (nextCharacter.compareToSortInfo(xy_sort, z_sort) > 0) break;
                this.renderCharacter(nextCharacter, false);
                nextCharacterIdx++;
            }

            const opacity = drawItem.layer.opacity || 1;
            if (opacity !== 1) this.ctx.globalAlpha = opacity;
            this.ctx.drawImage(img,
                info.sx, info.sy, info.sw, info.sh,
                Math.floor(screen_pos_ul.x), Math.floor(screen_pos_ul.y),
                info.sw, info.sh);
            if (opacity !== 1) this.ctx.globalAlpha = 1;

            if (this.highlighted_tile &&
                drawItem.x === this.highlighted_tile.tileCoord.x &&
                drawItem.y === this.highlighted_tile.tileCoord.y &&
                Math.abs(drawItem.layer.zHeight - this.highlighted_tile.layerZ) < 0.1) {
                this.drawIsoTileOutline(screen_pos_ul);
            }
        }

        while (nextCharacterIdx < characters.length) {
            const nextCharacter = characters[nextCharacterIdx];
            this.renderCharacter(nextCharacter, false);   // ← updated
            nextCharacterIdx++;
        }

        // Ghost pass (behind walls) – never glow
        for (const character of characters) {
            this.renderCharacter(character, true);
        }
    }

    renderCharacter(character, forGhost) {
        const highlighted = character == this.highlighted_character ||
            character == this.selected_character;
        const characterInScreen = sub(character.getIsoPosition(), this.view_origin_iso);
        const character_ul = sub(characterInScreen, character.origin);
        const oldAlpha = this.ctx.globalAlpha;

        if (forGhost) {
            this.ctx.globalAlpha = 0.3;
        } else {
            // Draw normal shadow
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

        const character_base = this.imageLibrary.get(character.sprite_image_name);
        if (!character_base) {
            this.ctx.globalAlpha = oldAlpha;
            return;
        }

        const sx = character.size.w * character.imageCoord.col;
        const sy = character.size.h * character.imageCoord.row;
        const sw = character.size.w;
        const sh = character.size.h;

        if (!this.offscreen) {
            this.offscreen = document.createElement('canvas');
            this.offCtx = this.offscreen.getContext('2d');
        }

        if (highlighted && !forGhost) {
            const double_highlighted = character == this.highlighted_character &&
                character == this.selected_character;

            const x_thickness = double_highlighted ? 4.5 : 3;
            const y_thickness = double_highlighted ? 4.5 : 3;
            this.offscreen.width = sw + (x_thickness * 2);
            this.offscreen.height = sh + (y_thickness * 2);

            // 1. Draw the sprite to the TINY offscreen canvas
            this.offCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
            this.offCtx.drawImage(character_base, sx, sy, sw, sh, 0, 0, this.offscreen.width, this.offscreen.height);

            // 2. Color it orange (only affects the tiny canvas)
            const oldComposite = this.ctx.globalCompositeOperation;
            this.offCtx.globalCompositeOperation = 'source-in';
            this.offCtx.fillStyle = "#ffaa00";
            this.offCtx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
            this.offCtx.globalCompositeOperation = oldComposite;

            // 3. Draw that colored "silhouette" back to the main game
            this.ctx.drawImage(this.offscreen, 
                character_ul.x - x_thickness, 
                character_ul.y - y_thickness - 1);
        }

        this.ctx.drawImage(character_base,
            sx, sy, sw, sh,
            character_ul.x, character_ul.y,
            sw, sh);

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
        return;

        const x = Math.floor(screen_pos_ul.x);
        const y = Math.floor(screen_pos_ul.y);

        this.ctx.save();
        this.ctx.strokeStyle = "#ffaa00";
        this.ctx.lineWidth = 2;
        //this.ctx.shadowColor = "#ff5500";
        //this.ctx.shadowBlur = 4;
        this.ctx.lineJoin = "round";

        this.ctx.beginPath();
        this.ctx.moveTo(x + 32, y);           // top
        this.ctx.lineTo(x + 64, y + 16);     // right
        this.ctx.lineTo(x + 32, y + 32);      // bottom
        this.ctx.lineTo(x, y + 16);           // left
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