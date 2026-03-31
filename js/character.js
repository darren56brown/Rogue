import {PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN, MOVE_TARGET_TOL} from "./constants.js";
import {vec2D, add, sub, mult, setAdd, norm, div, intersect, dist} from './vec2D.js';
import {cartesianToIso, getTileCoordFromXY, isoCompare} from './util.js';
import {SpriteSheet} from './sprite_sheet.js';

export const PlayerFacing = Object.freeze({
    face_nw: 0,   // North-West
    face_n:  1,   // North
    face_ne: 2,   // North-East
    face_e:  3,   // East
    face_se: 4,   // South-East
    face_s:  5,   // South
    face_sw: 6,   // South-West
    face_w:  7    // West
});

const FACING_DIRECTIONS = Object.freeze([
    {facing: PlayerFacing.face_e,  vec: {x:  1, y:  0}},
    {facing: PlayerFacing.face_se, vec: {x:  1, y:  1}},
    {facing: PlayerFacing.face_s,  vec: {x:  0, y:  1}},
    {facing: PlayerFacing.face_sw, vec: {x: -1, y:  1}},
    {facing: PlayerFacing.face_w,  vec: {x: -1, y:  0}},
    {facing: PlayerFacing.face_nw, vec: {x: -1, y: -1}},
    {facing: PlayerFacing.face_n,  vec: {x:  0, y: -1}},
    {facing: PlayerFacing.face_ne, vec: {x:  1, y: -1}}
]);

export class Character {
    #pos_xy = {x: 0, y: 0};
    #z = 0;

    constructor(world_pos) {
        this.sprite_image_name = null;     // ← Will be set later
        this.spriteSheet = null;           // ← Created only when we have the real image

        this.size = { w: PLAYER_ANIM_FRAME_SIZE.w, h: PLAYER_ANIM_FRAME_SIZE.h };
        this.origin = { x: PLAYER_TILE_ORIGIN.x, y: PLAYER_TILE_ORIGIN.y };

        this.speed = .7;
        this.fall_speed = 1.5;
        this.curFacing = 4; // face_se

        this.imageCoord = {row: 0, col: 0};

        this.waypoints = [];
        this.currentWaypointIndex = 0;

        this.inventory = [];
        this.followTarget = null;
        this.followLastDesiredPos = null;
        this.linedUpOnFollowTarget = false;

        this.setPositionXY(vec2D(world_pos.x, world_pos.y));
        this.setZ(world_pos.z);
    }

    initializeSprite(image_library, sprite_image_name) {
        if (!sprite_image_name) {
            throw new Error("Cannot initialize sprite without sprite_image_name");
        }

        this.sprite_image_name = sprite_image_name;

        const sprite_image = image_library.get(sprite_image_name);
        if (!sprite_image) {
            throw new Error(`Sprite image "${sprite_image_name}" not found in ImageLibrary`);
        }

        this.spriteSheet = new SpriteSheet(sprite_image);
        //console.log(`✅ SpriteSheet initialized for ${sprite_image_name}`);
    }

    getZ() {
        return this.#z;
    }

    getPositionXY() {
        return { x: this.#pos_xy.x, y: this.#pos_xy.y };
    }

    setPositionXY(pos) {
        this.#pos_xy.x = pos.x;
        this.#pos_xy.y = pos.y;
    }

    setZ(z) {
        this.#z = z;
    }
    
    moveX(dx) {
        this.#pos_xy.x += dx;
    }

    moveY(dy) {
        this.#pos_xy.y += dy;
    }

    moveZ(dz) {
        this.#z += dz;
    }

    moveXYZ(dx, dy, dz) {
        this.#pos_xy.x += dx;
        this.#pos_xy.y += dy;
        this.#z += dz;
    }

    movePosition(delta) {
        setAdd(this.#pos_xy, delta);
    }

    compareToOther(other) {
        return this.compareToSortInfo(other.#pos_xy, other.#z + 0.5);
    }

    compareToSortInfo(xy_sort, z_sort) {
        return isoCompare(this.#pos_xy, this.#z + 0.5, xy_sort, z_sort);
    }

    getIsoPosition() {
        return cartesianToIso(this.#pos_xy.x, this.#pos_xy.y, this.#z);
    }

    getShadowIsoPosition() {
        const zOnGround = Math.floor(this.#z);
        return cartesianToIso(this.#pos_xy.x, this.#pos_xy.y, zOnGround);
    }

    updatePhysics(dt, game_map) {
        if (!this.spriteSheet) {
            console.log("no sprite sheet");
            return;
        }

        if (this.followTarget) this._updateFollow(dt, game_map);

        let world_move_vec = {x: 0, y: 0, z: 0};
        let world_move_mag = 0;

        if (this.currentWaypointIndex < this.waypoints.length) {
            const target_xyz = this.waypoints[this.currentWaypointIndex];
            world_move_vec = {
                x: target_xyz.x - this.#pos_xy.x,
                y: target_xyz.y - this.#pos_xy.y,
                z: target_xyz.z - this.#z
            };
            world_move_mag = Math.sqrt(
                world_move_vec.x * world_move_vec.x +
                world_move_vec.y * world_move_vec.y +
                world_move_vec.z * world_move_vec.z
            );

            if (world_move_mag < MOVE_TARGET_TOL) {
                world_move_vec = {x: 0, y: 0, z: 0};
                world_move_mag = 0;
                this.currentWaypointIndex++;
                if (this.currentWaypointIndex >= this.waypoints.length) {
                    this.clearPath();
                }
            }
        }

        if (world_move_mag > 0) {
            const unit_move_vec = {
                x: world_move_vec.x / world_move_mag,
                y: world_move_vec.y / world_move_mag,
                z: world_move_vec.z / world_move_mag
            };

            // Determine facing
            const move_horiz_mag = Math.hypot(unit_move_vec.x, unit_move_vec.y);
            if (move_horiz_mag > 1e-6) {
                let bestDot = -Infinity;
                let bestFacing = this.curFacing;

                for (const dir of FACING_DIRECTIONS) {
                    const len = Math.hypot(dir.vec.x, dir.vec.y) || 1;
                    const ux = dir.vec.x / len;
                    const uy = dir.vec.y / len;
                    const dot = unit_move_vec.x * ux + unit_move_vec.y * uy;
                    if (dot > bestDot) {
                        bestDot = dot;
                        bestFacing = dir.facing;
                    }
                }
                this.curFacing = bestFacing;
            }

            let speed = this.speed;
            if (Math.abs(unit_move_vec.z) > 0.2) speed = this.fall_speed;

            const actual_move_mag = Math.min(world_move_mag, speed * dt);
            const delta_vec = {
                x: unit_move_vec.x * actual_move_mag,
                y: unit_move_vec.y * actual_move_mag,
                z: unit_move_vec.z * actual_move_mag
            };

            this.moveXYZ(delta_vec.x, delta_vec.y, delta_vec.z);

            this.spriteSheet.setAction("Walk");
            this.spriteSheet.setIsIdle(false);
        } else {
            this.spriteSheet.setAction("Walk");
            this.spriteSheet.setIsIdle(true);
        }

        this.spriteSheet.setCharacterFacing(this.curFacing);
        this.spriteSheet.update(dt);

        const coord = this.spriteSheet.getCurrentImageCoord();
        this.imageCoord.row = coord.row;
        this.imageCoord.col = coord.col;
    }

    setWaypoints(waypoints) {
        this.currentWaypointIndex = waypoints.length ? 1 : 0;
        this.waypoints = waypoints;
    }

    clearPath() {
        this.waypoints = [];
        this.currentWaypointIndex = 0;
    }

    buildPathToPosition(game_map, goal_pos_xy, goal_z) {
        const start_pos_xy = this.getPositionXY();
        const startZ = this.getZ();

        const tilePath = game_map.findPath(start_pos_xy, startZ, goal_pos_xy, goal_z);

        if (!tilePath.length) {
            this.clearPath();
            return;
        }

        let waypoints = [];
        this._pushWaypoint(waypoints, start_pos_xy.x, start_pos_xy.y, startZ);
        for (let i = 1; i < tilePath.length - 1; ++i) {
            const pathPoint = tilePath[i];
            this._pushWaypoint(waypoints, pathPoint.x + 0.5, pathPoint.y + 0.5, pathPoint.z);
        }
        this._pushWaypoint(waypoints, goal_pos_xy.x, goal_pos_xy.y, goal_z);
        this.setWaypoints(waypoints);
    }
    
    _pushWaypoint(waypoints, x, y, z) {
        if (waypoints.length === 0) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const last_waypoint = waypoints[waypoints.length - 1];
        const step_down = last_waypoint.z - z;

        if (Math.abs(step_down) < 0.1) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const from_tile_center = add(getTileCoordFromXY(last_waypoint.x, last_waypoint.y), vec2D(0.5, 0.5));
        const to_tile_center = add(getTileCoordFromXY(x, y), vec2D(0.5, 0.5));
        const unit_tile_to_tile_dir = norm(sub(to_tile_center, from_tile_center));
        const along_edge = vec2D(-unit_tile_to_tile_dir.y, unit_tile_to_tile_dir.x);
        const tile_to_tile_midpoint = div(add(from_tile_center, to_tile_center), 2.0);

        const xy_pos = vec2D(x, y);
        const cliff_edge_point = intersect(last_waypoint, xy_pos,
            tile_to_tile_midpoint, add(tile_to_tile_midpoint, along_edge));

        if (!cliff_edge_point) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }
        
        if (step_down > .1) {
            const step_xy_dist = dist(cliff_edge_point, xy_pos);
            if (step_xy_dist < .45) {
                waypoints.push({x: tile_to_tile_midpoint.x, y: tile_to_tile_midpoint.y, z: last_waypoint.z});
                waypoints.push({x: to_tile_center.x, y: to_tile_center.y, z: z});
                waypoints.push({x: x, y: y, z: z});
                return;
            }

            waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: last_waypoint.z});
            if (step_xy_dist > .55) {
                const along_unit = norm(sub(xy_pos, cliff_edge_point));
                const extra_point = add(cliff_edge_point, mult(along_unit, 0.5));
                waypoints.push({x: extra_point.x, y: extra_point.y, z: z}); 
            }
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const step_xy_dist = dist(last_waypoint, cliff_edge_point);
        if (step_xy_dist < .45) {
            waypoints.push({x: from_tile_center.x, y: from_tile_center.y, z: last_waypoint.z});
            waypoints.push({x: tile_to_tile_midpoint.x, y: tile_to_tile_midpoint.y, z: z});
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        if (step_xy_dist > .55) {
            const along_unit = norm(sub(last_waypoint, cliff_edge_point));
            const jump_point = add(cliff_edge_point, mult(along_unit, 0.5));
            waypoints.push({x: jump_point.x, y: jump_point.y, z: last_waypoint.z}); 
        }
        waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: z});
        waypoints.push({x: x, y: y, z: z}); 
    }

    addToInventory(gameItem, count = 1) {
        if (!gameItem) return;

        // Try to stack with existing item
        for (let entry of this.inventory) {
            if (entry.item.id === gameItem.id) {
                entry.count += count;
                return;
            }
        }

        // Add as new entry
        this.inventory.push({ item: gameItem.clone(), count });
    }

    startFollowing(target) {
        if (!target || target == this || target == this.followTarget) return;
        this.clearPath();
        this.followTarget = target;
        this.followLastDesiredPos = null;
    }

    stopFollowing() {
        this.clearPath();
        this.followTarget = null;
        this.followLastDesiredPos = null;
        this.linedUpOnFollowTarget = false;
    }

    moveTo(game_map, world_pos) {
        this.stopFollowing();
        this.buildPathToPosition(game_map, vec2D(world_pos.x, world_pos.y), world_pos.z);
    }

    _updateFollow(dt, game_map) {
        this.linedUpOnFollowTarget = false;
        if (!this.followTarget || !game_map) return;

        const npc = this.followTarget;
        const npcPos = npc.getPositionXY();
        const npcZ   = npc.getZ();
        const facing = npc.curFacing;

        // Offsets = exactly 3/4 tile directly in front of the NPC
        // (based on the same coordinate system the pathfinding and movement use)
        const CARDINAL_OFFSET = 0.75;
        const DIAG_OFFSET = CARDINAL_OFFSET / Math.SQRT2;   // ≈ 0.530

        const offsets = {
            [PlayerFacing.face_nw]: { x: -DIAG_OFFSET, y: -DIAG_OFFSET },
            [PlayerFacing.face_n ]: { x:  0.00,        y: -CARDINAL_OFFSET },
            [PlayerFacing.face_ne]: { x:  DIAG_OFFSET, y: -DIAG_OFFSET },
            [PlayerFacing.face_e ]: { x:  CARDINAL_OFFSET, y:  0.00 },
            [PlayerFacing.face_se]: { x:  DIAG_OFFSET, y:  DIAG_OFFSET },
            [PlayerFacing.face_s ]: { x:  0.00,        y:  CARDINAL_OFFSET },
            [PlayerFacing.face_sw]: { x: -DIAG_OFFSET, y:  DIAG_OFFSET },
            [PlayerFacing.face_w ]: { x: -CARDINAL_OFFSET, y:  0.00 }
        };

        const offset = offsets[facing] || { x: 0, y: 0 };

        const desiredPos = {
            x: npcPos.x + offset.x,
            y: npcPos.y + offset.y
        };
        const desiredZ = npcZ;

        // How close are we to the perfect “in-front” spot?
        const myPos = this.getPositionXY();
        const myZ   = this.getZ();
        const distToDesired = Math.hypot(
            myPos.x - desiredPos.x,
            myPos.y - desiredPos.y,
            myZ   - desiredZ
        );

        const CLOSE_ENOUGH = 0.25;   // once inside this radius we stop moving and just face the NPC

        if (distToDesired <= CLOSE_ENOUGH) {
            this.clearPath();

            // Face directly toward the NPC (opposite of their facing)
            const oppositeFacing = (facing + 4) % 8;
            this.curFacing = oppositeFacing;

            this.linedUpOnFollowTarget = true;
            return;   // we are perfectly positioned — no more movement this frame
        }

        // Not close enough → we need to walk toward the desired spot.
        // Only rebuild the full A* path when the desired spot has moved significantly
        // (this is the performance win you asked for)
        const last = this.followLastDesiredPos;
        let needsRebuild = !last;

        if (last) {
            const moved = Math.hypot(
                desiredPos.x - last.x,
                desiredPos.y - last.y,
                desiredZ   - last.z
            );
            if (moved > 0.25) needsRebuild = true;
        }

        if (needsRebuild) {
            this.buildPathToPosition(game_map, desiredPos, desiredZ);
            this.followLastDesiredPos = { x: desiredPos.x, y: desiredPos.y, z: desiredZ };
        }
    }

}

