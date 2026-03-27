
import {PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN} from "./constants.js";
import {PLAYER_ANIM_FPS, MOVE_TARGET_TOL} from "./constants.js";
import {vec2D, add, sub, mult, setAdd, norm, div, intersect, dist} from './vec2D.js';
import {cartesianToIso, getTileCoordFromXY, isoCompare} from './util.js';

const AnimWalkSequence = Object.freeze({
    neutral_1: 0,
    left_half_1: 1,
    left_forward: 2,
    left_half_2: 3,
    neutral_2: 4,
    right_half_1: 5,
    right_forward : 6,
    right_half_2: 7,
    num_frames: 8
});

export const PlayerFacing = Object.freeze({
    face_up: 0,
    face_lt: 1,
    face_dn: 2,
    face_rt: 3
});

const PlayerImageRow = new Map([
  [PlayerFacing.face_up, 8],
  [PlayerFacing.face_lt, 9],
  [PlayerFacing.face_dn, 10],
  [PlayerFacing.face_rt, 11]
]);

const AnimWalkSequenceOffset = new Map([
  [PlayerFacing.face_up, 0],
  [PlayerFacing.face_lt, 2],
  [PlayerFacing.face_dn, 0],
  [PlayerFacing.face_rt, 6]
]);

export class Character {
    #pos_xy = {x: 0, y: 0};
    #z = 0;

    constructor(posXY, z) {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        };

        this.origin = {
            x: PLAYER_TILE_ORIGIN.x,
            y: PLAYER_TILE_ORIGIN.y
        };

        this.speed = .7;
        this.fall_speed = 1.0;

        this.curFacing = PlayerFacing.face_dn;
        this.curWalkFrame = AnimWalkSequence.num_frames;
        this.animTimer = 0;

        this.imageCoord = {row: 0, col:0};

        this.setPositionXY(posXY);
        this.setZ(z);

        this.waypoints = [];
        this.currentWaypointIndex = 0;
    }

    getZ() {
        return this.#z;
    }
    getPositionXY() {
        return { x: this.#pos_xy.x, y: this.#pos_xy.y};
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
    };

    compareToSortInfo(xy_sort, z_sort) {
        return isoCompare(this.#pos_xy, this.#z + 0.5, xy_sort, z_sort);
    };

    getIsoPosition() {
        return cartesianToIso(this.#pos_xy.x, this.#pos_xy.y, this.#z);
    }

    getShadowIsoPosition() {
        const zOnGround = Math.floor(this.#z);
        return cartesianToIso(this.#pos_xy.x, this.#pos_xy.y, zOnGround);
    }

    updatePhysics(dt, game_map) {
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
                world_move_vec.z * world_move_vec.z);

            if (world_move_mag < MOVE_TARGET_TOL) {
                world_move_vec = {x: 0, y: 0, z: 0};
                world_move_mag = 0;
                this.currentWaypointIndex++;
                if (this.currentWaypointIndex >= this.waypoints.length) this.clearPath();
            }
        }

        if (world_move_mag > 0) {
            const unit_move_vec = {
                x: world_move_vec.x / world_move_mag,
                y: world_move_vec.y / world_move_mag,
                z: world_move_vec.z / world_move_mag
            };

            // Set facing based on screen direction (fall doesn't effect facing)
            const iso_move_vec = cartesianToIso(unit_move_vec.x, unit_move_vec.y, 0);
            if (Math.abs(iso_move_vec.x) > Math.abs(iso_move_vec.y)) {
                this.curFacing = iso_move_vec.x > 0 ? PlayerFacing.face_rt : PlayerFacing.face_lt;
            } else {
                this.curFacing = iso_move_vec.y > 0 ? PlayerFacing.face_dn : PlayerFacing.face_up;
            }

            const actual_move_mag = Math.min(world_move_mag, this.speed * dt);
            const delta_vec = {
                x: unit_move_vec.x * actual_move_mag,
                y: unit_move_vec.y * actual_move_mag,
                z: unit_move_vec.z * actual_move_mag
            };
            this.moveXYZ(delta_vec.x, delta_vec.y, delta_vec.z);

            // Was not moving, go to first animation frame
            if (this.curWalkFrame === AnimWalkSequence.num_frames) {
                this.curWalkFrame = AnimWalkSequence.neutral_1;
                this.animTimer = 0;
            }
        } else {
            // No longer moving but don't stop animating unless on neutral frame
            if (this.curWalkFrame === AnimWalkSequence.neutral_1 ||
                this.curWalkFrame === AnimWalkSequence.neutral_2) {
                this.curWalkFrame = AnimWalkSequence.num_frames;
                this.animTimer = 0;
            }
        }

        this.imageCoord.row = PlayerImageRow.get(this.curFacing);

        if (this.curWalkFrame !== AnimWalkSequence.num_frames) {
            this.animTimer += dt;
            if (this.animTimer > 1 / PLAYER_ANIM_FPS) {
                this.animTimer = 0;
                this.curWalkFrame = (this.curWalkFrame + 1) % AnimWalkSequence.num_frames;
            }
            const colOffset = AnimWalkSequenceOffset.get(this.curFacing);
            //One of the sequence of 8 walking images
            this.imageCoord.col = 1 + (this.curWalkFrame + colOffset) % 8;
        } else {
            //Standing image
            this.imageCoord.col = 0;
        }
    }

    setWaypoints(waypoints) {
        this.waypoints = waypoints || [];
        this.currentWaypointIndex = 1;
    }

    clearPath() {
        this.waypoints = [];
        this.currentWaypointIndex = 0;
    }

    buildPathToPosition(game_map, goal_pos_xy, goal_z) {
        const start_pos_xy = this.getPositionXY();
        const startZ = this.getZ();

        const tilePath = game_map.findPath(start_pos_xy, startZ,
            goal_pos_xy, goal_z);

        if (!tilePath.length) {
            this.clearPath();
            return;
        }

        let waypoints = [];
        this._pushWaypoint(waypoints, start_pos_xy.x, start_pos_xy.y, startZ);
        for (let i = 1; i < tilePath.length - 1; ++i)
        {
            const pathPoint = tilePath[i];
            this._pushWaypoint(waypoints, pathPoint.x + 0.5,
                pathPoint.y + 0.5, pathPoint.z);
        }
        this._pushWaypoint(waypoints, goal_pos_xy.x, goal_pos_xy.y, goal_z);
        this.setWaypoints(waypoints);
    }
    
    _pushWaypoint(waypoints, x, y, z) {
        if (waypoints.length == 0) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const last_waypoint = waypoints[waypoints.length - 1];
        const step_down = last_waypoint.z - z;
        if (Math.abs(step_down) < 0.1) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }
        const from_tile_center = add(getTileCoordFromXY(last_waypoint.x, last_waypoint.y),
            vec2D(0.5, 0.5));
        const to_tile_center = add(getTileCoordFromXY(x, y), vec2D(0.5, 0.5));
        const unit_tile_to_tile_dir = norm(sub(to_tile_center, from_tile_center));
        const along_edge = vec2D(-unit_tile_to_tile_dir.y, unit_tile_to_tile_dir.x);
        const tile_to_tile_midpoint = div(add(from_tile_center, to_tile_center), 2.0);

        const xy_pos = vec2D(x, y);
        const cliff_edge_point = intersect(last_waypoint, xy_pos,
            tile_to_tile_midpoint, add(tile_to_tile_midpoint, along_edge));
        
        if (step_down > .1) {
            const step_xy_dist = dist(cliff_edge_point, xy_pos);
            if (step_xy_dist < .45) {
                waypoints.push({x: tile_to_tile_midpoint.x,
                    y: tile_to_tile_midpoint.y, z: last_waypoint.z});
                waypoints.push({x: to_tile_center.x,
                    y: to_tile_center.y, z: z});
                waypoints.push({x: x, y: y, z: z});
                return;
            }

            waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: last_waypoint.z});
            if (step_xy_dist > .55)
            {
                const along_unit = norm(sub(xy_pos, cliff_edge_point));
                const extra_point = add(cliff_edge_point, mult(along_unit, 0.5));
                waypoints.push({x: extra_point.x, y: extra_point.y, z: z}); 
            }
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const step_xy_dist = dist(last_waypoint, cliff_edge_point);
        if (step_xy_dist < .45) {
            waypoints.push({x: from_tile_center.x,
                y: from_tile_center.y, z: last_waypoint.z});
            waypoints.push({x: tile_to_tile_midpoint.x,
                y: tile_to_tile_midpoint.y, z: z});
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        if (step_xy_dist > .55)
        {
            const along_unit = norm(sub(last_waypoint, cliff_edge_point));
            const jump_point = add(cliff_edge_point, mult(along_unit, 0.5));
            waypoints.push({x: jump_point.x, y: jump_point.y, z: last_waypoint.z}); 
        }
        waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: z});
        waypoints.push({x: x, y: y, z: z}); 
    }
}
