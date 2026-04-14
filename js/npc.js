
import { Character } from "./character.js";
import { Conversation } from "./conversation.js";
import { GameItemInst } from "./game_item.js";

const NPC_STATES = Object.freeze({
    ENGAGED:  'engaged',
    STANDING: 'standing',
    TURNING:  'turning',
    WALKING:  'walking',
    READY:    'ready'
});

export class Npc extends Character {
    constructor(world_pos, image_library, item_library, map_name, base_name) {
        super(world_pos, "Character", item_library);

        this.image_library = image_library;
        this.map_name = map_name;      // e.g. "level_01"
        this.base_name = base_name;    // e.g. "blacksmith_bob"

        this.conversation = new Conversation(map_name, base_name);

        this.currentState = NPC_STATES.STANDING;
        this.timeInState = 0;
        this.targetTimeInState = 0;

        this._transitionTo(NPC_STATES.STANDING);

        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;

        const infoPath = `maps/${this.map_name}/${this.base_name}.json`;

        try {
            const response = await fetch(infoPath);
            if (!response.ok) {
                throw new Error(`Failed to load NPC info: ${infoPath}`);
            }

            const npcInfo = await response.json();

            if (npcInfo.displayName) this.resetDisplayName(npcInfo.displayName);

            const spriteName = npcInfo.spriteImageName;
            if (!spriteName) {
                throw new Error(`NPC JSON missing "spriteImageName" field`);
            }

            // Initialize sprite only when we have real data
            this.initializeSprite(this.image_library, spriteName);

            // Load inventory
            if (npcInfo.inventory && Array.isArray(npcInfo.inventory)) {
                for (const instData of npcInfo.inventory) {
                    const def = this.item_library.get(instData.id);
                    if (!def) {
                        console.warn(`Item def "${instData.id}" not found for NPC ${this.base_name}`);
                        continue;
                    }

                    const item_inst = new GameItemInst(
                        def, instData.count || 1,
                        instData.slot_element !== undefined ? instData.slot_element : null
                    );
                    this.addToInventory(item_inst);
                }
            }

            this.loaded = true;
        } catch (error) {
            console.error(`❌ Failed to load NPC ${this.base_name}:`, error);
            throw error;
        }
    }

    startConversation() {
        if (!this.conversation) return;
        this.engage();
    }

    updatePhysics(dt, game_map) {
        super.updatePhysics(dt, game_map);
        this._updateAI(dt, game_map);
    }

    _updateAI(dt, game_map) {
        this.timeInState += dt;

        switch (this.currentState) {
            case NPC_STATES.ENGAGED:
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
                if (this.waypoints.length === 0) {
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
                this.targetTimeInState = 2 + Math.random() * 6;
                break;
            case NPC_STATES.TURNING:
                this.targetTimeInState = 0.2 + Math.random() * 0.6;
                break;
            case NPC_STATES.WALKING:
                this.targetTimeInState = 999;
                break;
            case NPC_STATES.READY:
                this.targetTimeInState = 0.05;
                break;
            case NPC_STATES.ENGAGED:
                this.targetTimeInState = 999;
                break;
        }
    }

    _decideNextAction(game_map) {
        const roll = Math.random();

        if (roll < 0.35) {
            this._transitionTo(NPC_STATES.STANDING);
        } else if (roll < 0.65) {
            this._transitionTo(NPC_STATES.TURNING);
        } else {
            this._attemptWander(game_map);
        }
    }

    _attemptWander(game_map) {
        const world_pos = this.getWorldPosition();
        const currentTileX = Math.floor(world_pos.x);
        const currentTileY = Math.floor(world_pos.y);

        const SEARCH_RADIUS = 4;
        const MAX_ATTEMPTS = 30;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const tx = currentTileX + (Math.floor(Math.random() * (SEARCH_RADIUS * 2 + 1)) - SEARCH_RADIUS);
            const ty = currentTileY + (Math.floor(Math.random() * (SEARCH_RADIUS * 2 + 1)) - SEARCH_RADIUS);

            if (tx < 0 || tx >= game_map.size.w || ty < 0 || ty >= game_map.size.h) continue;
            if (tx === currentTileX && ty === currentTileY) continue;

            const drop_in_tile_idx = {x: tx, y: ty, z: 1000};
            const drop_distance = game_map.getDropDistance(drop_in_tile_idx);
            if (drop_distance === Infinity || drop_distance < 0) continue;

            const world_pos = {
                x: tx + 0.5,
                y: ty + 0.5,
                z: 1000 - drop_distance};
            this.buildPathToPosition(game_map, world_pos);

            if (this.waypoints.length >= 2) {
                this._transitionTo(NPC_STATES.WALKING);
                return;
            }
        }

        this._transitionTo(NPC_STATES.STANDING);
    }

    _randomFacing() {
        return Math.floor(Math.random() * 8);
    }

    engage() {
        this._transitionTo(NPC_STATES.ENGAGED);
    }
}
