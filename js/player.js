import { Character } from "./character.js";
import { GameItemInst } from "./game_item.js";

export class Player extends Character {
    constructor(world_pos, image_library, item_library, sprite_image_name) {
        super(world_pos, "Player");

        this.selectedSlot = 0;
        this.gold = 200;
        this.item_library = item_library;

        this.initializeSprite(image_library, sprite_image_name);
        this.initializeDefaultItems();
    }

    initializeDefaultItems() {
        const getInst = (id, qty = 1, curDur = null) => {
            const def = this.item_library.get(id);
            if (!def) throw new Error(`Missing item definition: ${id}`);
            return new GameItemInst(def, qty, curDur);
        };

        this.inventorySlots[0] = getInst("wooden_sword");
        this.inventorySlots[1] = getInst("stone_pickaxe");
        this.inventorySlots[2] = getInst("iron_axe");
        this.inventorySlots[3] = null;
        this.inventorySlots[4] = getInst("bow");
        this.inventorySlots[5] = null;
        this.inventorySlots[6] = getInst("apple", 23);
        this.inventorySlots[7] = null;
        this.inventorySlots[8] = getInst("torch");
        this.inventorySlots[9] = null;

        // backpack
        this.inventorySlots[10] = getInst("apple", 12);
        this.inventorySlots[11] = getInst("wooden_sword");
        this.inventorySlots[12] = getInst("stone", 64);
        this.inventorySlots[13] = getInst("plain_shirt");
        this.inventorySlots[14] = getInst("helmet");
        this.inventorySlots[15] = getInst("boots");
        this.inventorySlots[16] = getInst("pants");
        this.inventorySlots[17] = getInst("cool_ring");
        this.inventorySlots[18] = getInst("crown");
        this.inventorySlots[19] = getInst("necklace");
        this.inventorySlots[20] = getInst("lame_ring");
    }

    swapHotbarSlots(index1, index2) {
        if (index1 >= 0 && index1 < 10 || index2 >= 0 || index2 < 10)
            this.tradeInventorySlots(index1, this, index2);
    }
}