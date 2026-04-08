
export class GameItemDef {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type || "misc";
        this.rarity = data.rarity || "common";
        
        this.icon = data.icon;
        this.maxStack = data.maxStack || 1;
        
        this.damage = data.damage || 0;
        this.defense = data.defense || 0;
        this.healAmount = data.healAmount || 0;
        this.maxDurability = data.maxDurability || Infinity;
        
        this.description = data.description || "<None>";
        
        this.bid = data.value || 0;
        this.ask = data.value || 1;
        this.weight = data.weight || 0;
        this.tags = data.tags || [];
        this.equipSlot = data.equipSlot || null;
    }
}

////////////////////////////////
////////////////////////////////


export class GameItemInst {
    constructor(def, count = 1, durability = Infinity) {
        if (!(def instanceof GameItemDef)) {
            throw new Error("GameItemInst requires a valid GameItemDef");
        }
        this.def = def;
        this.count = Math.max(1, count);

        if (def.maxDurability == Infinity) {
            this.durability = Infinity;
        } else {
            this.durability = Math.min(durability, def.maxDurability);
        }
    }

    canStackWith(other) {
        return other && other instanceof GameItemInst && this.def == other.def;
    }

    isStackable() {
        return this.maxStack > 1;
    }

    clone(count = this.count) {
        return new GameItemInst(this.def, count, this.durability);
    }

    toJSON() {
        return {
            id: this.id,
            count: this.count,
            durability: this.durability == Infinity ? undefined : this.durability
        };
    }
}

