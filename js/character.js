import {PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN, MOVE_TARGET_TOL} from "./constants.js";
import {vec2D, add, sub, mult, setAdd, norm, div, intersect, dist, mag, dot} from './vec2D.js';
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

const FACING_VECTORS = Object.freeze({
    [PlayerFacing.face_e]: vec2D(1, 0),
    [PlayerFacing.face_se]: vec2D(.7071, .7071),
    [PlayerFacing.face_s]: vec2D(0, 1),
    [PlayerFacing.face_sw]: vec2D(-.7071, .7071),
    [PlayerFacing.face_w]: vec2D(-1, 0),
    [PlayerFacing.face_nw]: vec2D(-.7071, -.7071),
    [PlayerFacing.face_n]: vec2D(0, -1),
    [PlayerFacing.face_ne]: vec2D(.7071, -.7071)
});

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
        this.follow_target = null;
        this.last_computed_path_seed = null;
        this.follow_success = false;

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

    isWalking() {
        return this.waypoints.length > 0;
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
        if (!this.spriteSheet || !game_map) return;

        if (this.follow_target) this._updateFollow(dt, game_map);

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

            this.curFacing = this._getNearestFacing(unit_move_vec);
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
        this.last_computed_path_seed = null;
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
        if (!target || target == this || target == this.follow_target) return;
        this.clearPath();
        this.follow_target = target;
        this.follow_success = false;
    }

    stopFollowing() {
        this.clearPath();
        this.follow_target = null;
        this.follow_success = false;
    }

    moveTo(game_map, world_pos) {
        this.stopFollowing();
        this.buildPathToPosition(game_map, vec2D(world_pos.x, world_pos.y), world_pos.z);
    }

    _updateFollow(dt, game_map) {
        const target_xy = this.follow_target.getPositionXY();
        const target_z = this.follow_target.getZ();
        const target_facing = this.follow_target.curFacing;

        if (this.last_computed_path_seed) {
            const xy_change = sub(target_xy, this.last_computed_path_seed.target_xy);
            const z_change = target_z - this.last_computed_path_seed.target_z;
            if (target_facing == this.last_computed_path_seed.target_facing &&
                Math.hypot(xy_change.x, xy_change.y, z_change) <= 0.1) {

                if (!this.isWalking()) {
                    this.curFacing = this._getFacingToward(this.follow_target);
                }
                return;
            }
        }

        this.last_computed_path_seed = null;
        this.follow_success = false;

        const assumed_dirs = [
            target_facing,
            (target_facing + 1) % 8,
            (target_facing + 7) % 8,   // -1
            (target_facing + 2) % 8,
            (target_facing + 6) % 8,
            (target_facing + 3) % 8,
            (target_facing + 5) % 8,
            (target_facing + 4) % 8    // opposite last
        ];

        for (const assumed_dir of assumed_dirs) {
            if (this._updateFollowTry(dt, game_map, assumed_dir)) break;
        }

        //Store even on failure
        this.last_computed_path_seed = {
            target_xy: target_xy,
            target_z: target_z,
            target_facing: target_facing
        };

        //If we aren't trying to walk, change facing
        if (!this.isWalking()) {
            this.curFacing = this._getFacingToward(this.follow_target);
        }
    }

    _updateFollowTry(dt, game_map, npc_facing) {
        const target_xy = this.follow_target.getPositionXY();
        const target_z = this.follow_target.getZ();

        const target_is_walking = this.follow_target.isWalking();
        if (target_is_walking) {
            const to_target_xy = sub(target_xy, this.getPositionXY());
            const to_target_z = target_z - this.getZ();
            //If target is walking and we are close, just hold still.
            if (Math.hypot(to_target_xy.x, to_target_xy.y, to_target_z) <= 1.5) {
                this.clearPath();
                return true;
            }
        }

        if (target_is_walking) npc_facing = (npc_facing + 4) % 8;
        const offset = mult(FACING_VECTORS[npc_facing], 0.9);
        const desired_xy = add(target_xy, offset);

        const xy_error = sub(this.getPositionXY(), desired_xy);
        const z_error = this.getZ() - target_z;
        if (Math.hypot(xy_error.x, xy_error.y, z_error) <= 0.05) {
            this.clearPath();
            if (!target_is_walking) this.follow_success = true;
            return true;
        }

        this.buildPathToPosition(game_map, desired_xy, target_z);
        return this.isWalking();
    }

    _getNearestFacing(move_vec) {
        let best_proj = -Infinity;
        let best_facing = this.curFacing;
        for (const [facing, face_vec] of Object.entries(FACING_VECTORS)) {
            const proj = dot(move_vec, face_vec);
            if (proj > best_proj) {
                best_proj = proj;
                best_facing = facing;
            }
        }
        return best_facing;
    }

    _getFacingToward(target) {
        const to_target = sub(target.getPositionXY(), this.getPositionXY());
        return this._getNearestFacing(to_target);
    }
}

