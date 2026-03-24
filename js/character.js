import { ISO } from "./constants.js";
import { PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN } from "./constants.js";
import { PLAYER_ANIM_FPS, MOVE_TARGET_TOL } from "./constants.js";
import { vec2D, add, sub, mult, setAdd, setDiv, mag } from './vec2D.js';
import { cartesianToIso, isoToCartesian } from './util.js';

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
        this.falling = true;
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

    updatePhysics(dt, keys, game_map) {
        if (this.falling) {
            const drop_distance = game_map.getDropDistance(this.getPositionXY(), this.#z);
            if (drop_distance === 0) {
                this.falling = false;
            } else {
                const gravity_distance = this.fall_speed * dt;
                if (gravity_distance >= drop_distance) {
                    this.moveZ(-drop_distance);
                    this.falling = false;
                } else {
                    this.moveZ(-gravity_distance);
                }  
            }
        }

        let world_move_vec = vec2D(0, 0);
        let world_move_mag = 0;
        let iso_move_vec =  vec2D(0, 0);
        
        const hasKeyboardInput = keys && (
            keys['a'] || keys['arrowleft'] ||
            keys['d'] || keys['arrowright'] ||
            keys['w'] || keys['arrowup'] ||
            keys['s'] || keys['arrowdown']
        );

        let max_move_mag = Infinity;
        if (hasKeyboardInput) {
            this.clearPath();

            if (keys['a'] || keys['arrowleft']) iso_move_vec.x -= 1;
            if (keys['d'] || keys['arrowright']) iso_move_vec.x += 1;
            if (keys['w'] || keys['arrowup']) iso_move_vec.y -= 1;
            if (keys['s'] || keys['arrowdown']) iso_move_vec.y += 1;

            //Diagonal presses are world moves but
            //single presses are iso screen moves.
            if (iso_move_vec.x !== 0 && iso_move_vec.y !== 0) {
                if (iso_move_vec.x > 0 && iso_move_vec.y > 0) {
                    world_move_vec = vec2D(1, 0);
                } else if (iso_move_vec.x > 0 && iso_move_vec.y < 0) {
                    world_move_vec = vec2D(0, -1);
                } else if (iso_move_vec.x < 0 && iso_move_vec.y > 0) {
                    world_move_vec = vec2D(0, 1);
                } else if (iso_move_vec.x < 0 && iso_move_vec.y < 0) {
                    world_move_vec = vec2D(-1, 0);
                }
            } else {
                world_move_vec = isoToCartesian(iso_move_vec.x, iso_move_vec.y);
            }
        } 
        else if (this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length) {
            const targetPos = this.waypoints[this.currentWaypointIndex];
            const to_target_pos = sub(targetPos, this.getPositionXY());
            max_move_mag = mag(to_target_pos);
            if (max_move_mag < MOVE_TARGET_TOL) {
                this.currentWaypointIndex++;
                if (this.currentWaypointIndex >= this.waypoints.length) this.clearPath();
            } else {
                world_move_vec = to_target_pos;
            }
        }

        world_move_mag = mag(world_move_vec);
        if (world_move_mag > 0) {
            setDiv(world_move_vec, world_move_mag);
            world_move_mag = 1;
        }
        iso_move_vec = cartesianToIso(world_move_vec.x, world_move_vec.y, 0);

        if (world_move_mag > 0) {
            // Set facing based on screen direction
            if (Math.abs(iso_move_vec.x) > Math.abs(iso_move_vec.y)) {
                this.curFacing = iso_move_vec.x > 0 ? PlayerFacing.face_rt : PlayerFacing.face_lt;
            } else {
                this.curFacing = iso_move_vec.y > 0 ? PlayerFacing.face_dn : PlayerFacing.face_up;
            }

            const move_mag = Math.min(this.speed * dt, max_move_mag);
            const delta_vec = mult(world_move_vec, move_mag);
            const new_2D_pos = add(this.getPositionXY(), delta_vec);

            if (game_map.getTileCoordFromPosition(new_2D_pos) ==
                game_map.getTileCoordFromPosition(this.getPositionXY())) {
                //If we're on the same tile, no change to falling or obstruction
                this.movePosition(delta_vec);
            } else {
                if (!this.falling &&
                    game_map.getDropDistance(new_2D_pos, this.#z) > 0) {
                        this.falling = true;
                }

                //Add some bounce energy by reversing velocity from obstructions
                const move_only_x = add(this.getPositionXY(), vec2D(delta_vec.x, 0));
                if (game_map.isObstructed(move_only_x, this.#z)) delta_vec.x *= -1.5;
                const move_only_y = add(this.getPositionXY(), vec2D(0, delta_vec.y));
                if (game_map.isObstructed(move_only_y, this.#z)) delta_vec.y *= -1.5;

                this.movePosition(delta_vec);
            }

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
        this.currentWaypointIndex = 0;
    }

    clearPath() {
        this.waypoints = [];
        this.currentWaypointIndex = 0;
    }
}