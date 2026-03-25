import { Character } from "./character.js";
import { PlayerFacing } from "./character.js";
import { getTileCoordFromPosition } from './util.js';

const NPC_STATES = Object.freeze({
    ENGAGED:  'engaged',
    STANDING: 'standing',
    TURNING:  'turning',
    WALKING:  'walking',
    READY:    'ready'
});

export class Npc extends Character {
    constructor(posXY, z) {
        super(posXY, z);

        this.currentState = NPC_STATES.STANDING;
        this.timeInState = 0;
        this.targetTimeInState = 0;

        // Start in a nice idle state
        this._transitionTo(NPC_STATES.STANDING);
    }

    // Called automatically every frame from App.updatePhysics()
    updatePhysics(dt, game_map) {
        super.updatePhysics(dt, game_map);   // movement + animation still works exactly as before
        this._updateAI(dt, game_map);
    }

    _updateAI(dt, game_map) {
        this.timeInState += dt;

        switch (this.currentState) {
            case NPC_STATES.ENGAGED:
                // locked until you externally call npc._transitionTo(NPC_STATES.ENGAGED) again
                return;

            case NPC_STATES.STANDING:
                if (this.timeInState >= this.targetTimeInState) {
                    this._transitionTo(NPC_STATES.READY);
                }
                break;

            case NPC_STATES.TURNING:
                if (this.timeInState >= this.targetTimeInState) {
                    this.curFacing = this._randomFacing();
                    this._transitionTo(NPC_STATES.STANDING);
                }
                break;

            case NPC_STATES.WALKING:
                // super.updatePhysics already handles waypoint following and clearPath()
                if (this.waypoints.length === 0) {   // path finished
                    this._transitionTo(NPC_STATES.STANDING);
                }
                break;

            case NPC_STATES.READY:
                if (this.timeInState >= this.targetTimeInState) {
                    this._decideNextAction(game_map);
                }
                break;
        }
    }

    _transitionTo(newState) {
        this.currentState = newState;
        this.timeInState = 0;

        switch (newState) {
            case NPC_STATES.STANDING:
                this.targetTimeInState = 2 + Math.random() * 6;   // 2–8 seconds idle
                break;
            case NPC_STATES.TURNING:
                this.targetTimeInState = 0.2 + Math.random() * 0.6; // quick "thinking" turn
                break;
            case NPC_STATES.WALKING:
                this.targetTimeInState = 999; // timer ignored — we check waypoints instead
                break;
            case NPC_STATES.READY:
                this.targetTimeInState = 0.05; // almost instant decision
                break;
            case NPC_STATES.ENGAGED:
                this.targetTimeInState = 999;
                break;
        }
    }

    _decideNextAction(game_map) {
        const roll = Math.random();

        if (roll < 0.35) {
            // just keep standing a bit longer
            this._transitionTo(NPC_STATES.STANDING);
        } else if (roll < 0.65) {
            // look around
            this._transitionTo(NPC_STATES.TURNING);
        } else {
            // go for a little wander
            this._attemptWander(game_map);
        }
    }

    _attemptWander(game_map) {
        const pos = this.getPositionXY();
        const z = this.getZ();
        const currentTileX = Math.floor(pos.x);
        const currentTileY = Math.floor(pos.y);

        const SEARCH_RADIUS = 4;
        const MAX_ATTEMPTS = 30;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const tx = currentTileX + (Math.floor(Math.random() * (SEARCH_RADIUS * 2 + 1)) - SEARCH_RADIUS);
            const ty = currentTileY + (Math.floor(Math.random() * (SEARCH_RADIUS * 2 + 1)) - SEARCH_RADIUS);

            if (tx === currentTileX && ty === currentTileY) continue;
            if (!game_map.isTileWalkable(tx, ty, z)) continue;

            const goalPos = { x: tx + 0.5, y: ty + 0.5 };

            const path = game_map.findPath(pos, z, goalPos, z);
            if (path.length < 2 || path.length > 9) continue; // keep walks short & sweet

            // Build waypoint list exactly like the player click handler does
            const waypoints = [];
            waypoints.push({ x: pos.x, y: pos.y, z }); // exact current position

            for (let i = 1; i < path.length; i++) {
                const tile = path[i];
                waypoints.push({ x: tile.x + 0.5, y: tile.y + 0.5, z: tile.z });
            }

            this.setWaypoints(waypoints);
            this._transitionTo(NPC_STATES.WALKING);
            return;
        }

        // couldn’t find a good spot — just stand
        this._transitionTo(NPC_STATES.STANDING);
    }

    _randomFacing() {
        return Math.floor(Math.random() * 4); // 0=up, 1=left, 2=down, 3=right (matches PlayerFacing)
    }

    // Optional helper you can call from App if you ever want to make an NPC "talk"
    engage() {
        this._transitionTo(NPC_STATES.ENGAGED);
    }
}