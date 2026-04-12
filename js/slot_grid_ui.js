
import {SplitUI} from "./split_ui.js";

export class SlotGridUI {
    constructor(grid_element_name, gold_amount_name, item_desc_name,
        refresh_grids_func) {
        this.character = null;
        this.trade_partner = null;
        this.slot_grid = document.getElementById(grid_element_name);
        this.gold_value = document.getElementById(gold_amount_name);
        this.itemDescEl = document.getElementById(item_desc_name);
        this.refresh_grids_func = refresh_grids_func

        this.split_ui = null;
        this.isTradeGrid = false;
        this.isNpcSide = false;

        this.orig_inventory_slots = [];
    }

    activate(character, trade_partner = null, tradeUI = null) {
        this.character = character;
        this.trade_partner = trade_partner;
        this.tradeUI = tradeUI;

        this.isTradeGrid = trade_partner !== null;
        this.isNpcSide = this.slot_grid.id === "npcSlotGrid";

        this.orig_inventory_slots = [];
        for (const slot of character.inventorySlots) {
            this.orig_inventory_slots.push(slot);
        }
    }

    resetInventory() {
        this.character.inventorySlots = [];
        for (const slot of this.orig_inventory_slots) {
            this.character.inventorySlots.push(slot);
        }
    }

    getNewItemsInInventory() {
        const oldSet = new Set(this.orig_inventory_slots);
        return this.character.inventorySlots.filter(item => !oldSet.has(item));
    }

    getMissingItemsInInventory() {
        const newSet = new Set(this.character.inventorySlots);
        return this.orig_inventory_slots.filter(item => !newSet.has(item));
    }

    deactivate() {
        this.character = null;
        this.trade_partner = null;
        this.orig_inventory_slots = [];
    }

    refreshGrid() {
        this.slot_grid.innerHTML = '';
        this.slot_grid.addEventListener('contextmenu', e => e.preventDefault(), { once: true });

        for (let i = 0; i < 40; i++) {
            const slotData = this.character.inventorySlots[i];
            const slotEl = document.createElement('div');

            slotEl.className = `inventory-slot ${i < 10 ? 'hotbar-row' : ''}`;
            slotEl.dataset.index = i;

            if (slotData) {
                const icon = document.createElement('div');
                icon.className = 'item-icon';
                icon.textContent = slotData.def.icon;
                slotEl.appendChild(icon);

                if (slotData.count > 1) {
                    const count_element = document.createElement('span');
                    count_element.className = 'item-count';
                    count_element.textContent = slotData.count;
                    slotEl.appendChild(count_element);
                }
            }

            slotEl.draggable = true;
            slotEl.addEventListener('contextmenu', e => {
                e.preventDefault();
               this.openSplitDialog(i, e);
            });

            slotEl.addEventListener('dragstart', e => {
                const dataObj = {
                    character_name: this.character.display_name,
                    index: i
                };
                e.dataTransfer.setData('text/plain', JSON.stringify(dataObj))
            });
            slotEl.addEventListener('dragover', e => e.preventDefault());
            slotEl.addEventListener('drop', e => this.handleGridDrop(e, slotEl));

            slotEl.addEventListener('mouseenter', () => {
                if (!slotData) {
                    this.itemDescEl.textContent = '<Empty slot>';
                    return;
                }

                const name = slotData.def.name;
                const baseDesc = slotData.def.description || "";

                let extraInfo = "";

                if (this.isTradeGrid && this.tradeUI) {
                    const tradeInfo = this.tradeUI.getTradeHoverInfo(slotData, this.isNpcSide);

                    if (tradeInfo) {
                        const canAfford = this.canTradeItem(slotData, this.isNpcSide);
                        const priceColor = canAfford ? tradeInfo.color : '#ff4444';

                        let priceHTML = `
                            <span style="color:#888;font-weight:bold">${tradeInfo.label}: </span>
                            <span style="color:${priceColor};font-weight:bold">${tradeInfo.totalPrice.toLocaleString()}g</span>
                        `;

                        // Extra per-unit line for stacks
                        if (slotData.count > 1) {
                            priceHTML += `<br>
                                <span style="color:#888;font-size:0.9em">(${tradeInfo.unitPrice.toLocaleString()}g each)</span>`;
                        }

                        extraInfo = `<br><br>${priceHTML}`;
                    }
                }

                this.itemDescEl.innerHTML = `<strong>${name}</strong><br>${baseDesc}${extraInfo}`;
            });

            this.slot_grid.appendChild(slotEl);
        }

        this.refreshGold();
    }

    refreshGold() {
        if (!this.character) return;
        this.gold_value.textContent = this.character.gold.toLocaleString();
    }

    handleGridDrop(e, slotEl) {
        e.preventDefault();
        const from_data = e.dataTransfer.getData('text/plain');
        const to_index = parseInt(slotEl.dataset.index);

        if (from_data.startsWith('equip:')) {
            const from_equip_slot_name = from_data.slice(6);
            const itemToMove = this.character.equipment[from_equip_slot_name];
            if (!itemToMove) return;

            this.character.swapInventoryAndEquipmentSlots(to_index, from_equip_slot_name)
            this.refresh_grids_func();
            return;
        }

        let dataObj;
        try {
            dataObj = JSON.parse(from_data);
        } catch (err) {
            console.warn('Invalid drag data');
            return;
        }
        const from_index = parseInt(dataObj.index);
        if (dataObj.character_name == this.character.display_name) {
            this.character.swapInventorySlots(to_index, this.character, from_index);
        } else if (this.trade_partner) {
            this.character.swapInventorySlots(to_index, this.trade_partner, from_index);
        }
        this.refresh_grids_func();
    }

    openSplitDialog(index, event) {
        if (!event || index < 0 || index >= 40) return;

        const slotData = this.character.inventorySlots[index];
        if (!slotData || slotData.count <= 1) return;

        if (!this.split_ui) this.split_ui = new SplitUI();

        this.split_ui.setPosition(event.clientX, event.clientY);
        this.split_ui.open(this, slotData);
    }

    closeSplitDialog() {
        this.split_ui.close();
    }

    performSplit(num_to_split, slot_data) {
        if (!num_to_split || !slot_data) {
            alert("Invalid split info.");
            this.closeSplitDialog();
            return;
        }

        if (!slot_data || num_to_split < 1 ||
            num_to_split >= slot_data.count) {
            this.closeSplitDialog();
            return;
        }

        // Find first empty slot
        let targetIndex = -1;
        for (let i = 0; i < 40; i++) {
            if (!this.character.inventorySlots[i]) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex === -1) {
            alert("No empty slots available to split into.");
            this.closeSplitDialog();
            return;
        }

        // Do the split
        slot_data.count -= num_to_split;

        this.character.inventorySlots[targetIndex] = slot_data.clone();
        this.character.inventorySlots[targetIndex].count = num_to_split;

        this.closeSplitDialog();
        this.refresh_grids_func();
    }

    canTradeItem(itemInst, isBuying) {
        if (!itemInst || !this.character) return false;

        const count = itemInst.count;

        if (isBuying) {
            // Player buying from NPC → check PLAYER's gold
            const totalCost = itemInst.def.ask * count;
            return this.character.gold >= totalCost;
        } else {
            // Player selling to NPC → check NPC's gold
            if (!this.trade_partner) return true;
            const totalValue = itemInst.def.bid * count;
            return this.trade_partner.gold >= totalValue;
        }
    }
}

