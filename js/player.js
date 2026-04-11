import { Character } from "./character.js";
import { GameItemInst } from "./game_item.js";

export class Player extends Character {
    constructor(world_pos, image_library, item_library, sprite_image_name) {
        super(world_pos, "Player", item_library);

        this.selectedSlot = 0;
        this.gold = 200;

        this.initializeSprite(image_library, sprite_image_name);
        this.initializeDefaultItems();
    }

    initializeDefaultItems() {
        this.makeInventoryItem(0, "wooden_sword");
        this.makeInventoryItem(1, "stone_pickaxe");
        this.makeInventoryItem(2, "iron_axe");
        this.destroyInventoryItem(3);
        this.makeInventoryItem(4, "bow");
        this.destroyInventoryItem(5);
        this.makeInventoryItem(6, "apple", 23);
        this.destroyInventoryItem(7);
        this.makeInventoryItem(8, "torch");
        this.destroyInventoryItem(9);

        // backpack
        this.makeInventoryItem(10, "apple", 12);
        this.makeInventoryItem(11, "wooden_sword");
        this.makeInventoryItem(12, "stone", 64);
        this.makeInventoryItem(13, "plain_shirt");
        this.makeInventoryItem(14, "helmet");
        this.makeInventoryItem(15, "boots");
        this.makeInventoryItem(16, "pants");
        this.makeInventoryItem(17, "cool_ring");
        this.makeInventoryItem(18, "crown");
        this.makeInventoryItem(19, "necklace");
        this.makeInventoryItem(20, "lame_ring");
    }

    swapHotbarSlots(index1, index2) {
        if (index1 >= 0 && index1 < 10 || index2 >= 0 || index2 < 10)
            this.swapInventorySlots(index1, this, index2);
    }
}