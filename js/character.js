
import {PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN} from "./constants.js";
import {PLAYER_ANIM_FPS, MOVE_TARGET_TOL} from "./constants.js";
import {vec2D, add, sub, mult, setAdd, setDiv, mag} from './vec2D.js';
import {cartesianToIso, isoToCartesian} from './util.js';

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

const PlayerFacing = Object.freeze({
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
    #y_sort = 0;
    #z_sort = 0;

    constructor(posXY, z) {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        };

        this.origin = {
            x: PLAYER_TILE_ORIGIN.x,
            y: PLAYER_TILE_ORIGIN.y
        };

        this.speed = .35;
        this.fall_speed = .5;

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
        this.#computeSortInfo();
    }
    setZ(z) {
        this.#z = z;
        this.#computeSortInfo();
    }
    
    moveX(dx) {
        this.#pos_xy.x += dx;
        this.#computeSortInfo();
    }
    moveY(dy) {
        this.#pos_xy.y += dy;
        this.#computeSortInfo();
    }
    moveZ(dz) {
        this.#z += dz;
        this.#computeSortInfo();
    }
    moveXYZ(dx, dy, dz) {
        this.#pos_xy.x += dx;
        this.#pos_xy.y += dy;
        this.#z += dz;
        this.#computeSortInfo();
    }
    movePosition(delta) {
        setAdd(this.#pos_xy, delta);
        this.#computeSortInfo();
    }

    #computeSortInfo() {
        const y_sort_point = this.getIsoPosition();
        this.#y_sort = y_sort_point.y;
        this.#z_sort = this.#z + 0.5; //character center is up in z
    }

    compareToOther(other) {
        return this.compareToSortInfo(other.#y_sort, other.#z_sort);
    };

    compareToSortInfo(y_sort, z_sort) {
        //If we are close to one layer apart, sort by z
        if (Math.abs(this.#z_sort - z_sort) > 0.99) {
            return this.#z_sort - z_sort;
        }
        return this.#y_sort - y_sort;
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
}