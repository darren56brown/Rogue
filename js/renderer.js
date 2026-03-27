import { APP_SIZE } from "./constants.js";
import { sub, vec2D } from './vec2D.js';
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

        for (const drawItem of this.current_map.drawList) {
            //Upper left of tile in iso is not upper left of tile in Cartesian
            const screen_pos_ul = sub(cartesianToIso(drawItem.x - 0.5, drawItem.y + 0.5,
                drawItem.layer.zHeight), this.view_origin_iso);

            const info = this.current_map.getTileInfoForLayer(drawItem.x,
                drawItem.y, drawItem.layer);
            if (!info) continue;

            if (screen_pos_ul.x <= -info.sw ||
                screen_pos_ul.x >= this.canvas.width + info.sw ||
                screen_pos_ul.y <= -info.sh  ||
                screen_pos_ul.y >= this.canvas.height + info.sh) {
                continue;
            }

            const img = this.imageLibrary.get(info.imageName);
            if (!img) continue;

            //This has to match sorting in game_map
            const xy_sort = vec2D(drawItem.x + 0.5, drawItem.y + 0.5);
            const z_sort = drawItem.layer.zHeight - 0.5;

            //Draw any characters left to draw which must be drawn before this tile
            while (nextCharacterIdx < characters.length) {
                const nextCharacter = characters[nextCharacterIdx];
                if (nextCharacter.compareToSortInfo(xy_sort, z_sort) > 0) break;
                const sortVal = nextCharacter.compareToSortInfo(xy_sort, z_sort);
                this.renderCharacter(nextCharacter);
                nextCharacterIdx++;
            }

            const opacity = drawItem.layer.opacity || 1;

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
                drawItem.x === this.hoveredTile.tileCoord.x &&
                drawItem.y === this.hoveredTile.tileCoord.y &&
                Math.abs(drawItem.layer.zHeight - this.hoveredTile.layerZ) < 0.1) {
                //Is a distance check for z appropriate?
                this.drawIsoTileOutline(screen_pos_ul);
            }
        }        

        //Draw any left over characters
        while (nextCharacterIdx < characters.length) {
            const nextCharacter = characters[nextCharacterIdx];
            this.renderCharacter(nextCharacter);
            nextCharacterIdx++;
        }

        //this.drawWaypointPath(characters);

        //Redraw all characters so that they appear as ghosts behind walls
        for (const character of characters) {
            this.renderCharacter(character, true);
        }
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