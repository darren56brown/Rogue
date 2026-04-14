
import {SplitUI} from "./split_ui.js";

export class SlotGridUI {
    constructor(is_for_player, grid_element_name, gold_amount_name,
        item_desc_elem_name, refresh_grids_func) {
        this.character = null;
        this.trade_partner_ui = null;
        this.slot_grid = document.getElementById(grid_element_name);
        this.gold_element = document.getElementById(gold_amount_name);
        this.itemDescEl = document.getElementById(item_desc_elem_name);
        this.refresh_grids_func = refresh_grids_func

        this.split_ui = null;
        this.is_for_player = is_for_player;

        this.orig_gold = 0;
        this.orig_inventory_slots = [];
        this.orig_fungible_items = null;
        this.orig_regular_items = null;
    }

    activate(character, trade_partner_ui) {
        this.character = character;
        this.trade_partner_ui = trade_partner_ui;

        this.orig_gold = this.character.gold;
        this.orig_inventory_slots = [];
        this.orig_regular_items = new Set();
        for (const item_instance of this.character.inventorySlots) {
            this.orig_inventory_slots.push(item_instance);
            if (!item_instance || item_instance.isFungible()) continue;
            this.orig_regular_items.add(item_instance);
        }
        this.orig_fungible_items = this.character.getFungibleItemCounts();
    }

    resetInventory() {
        this.character.gold = this.orig_gold;

        this.character.inventorySlots = [];
        for (const slot of this.orig_inventory_slots) {
            this.character.inventorySlots.push(slot);
        }
    }

    getPendingNonFungibleItems(other_grid_ui) {
        const new_items_in_inventory = this.character.inventorySlots.filter(
            item => !this.orig_regular_items.has(item)
        );
        return new_items_in_inventory.filter(
            item => other_grid_ui.orig_regular_items.has(item)
        );
    }

    isPendingNonFungibleItem(item_instance, other_grid_ui) {
        const pending_items = this.getPendingNonFungibleItems(other_grid_ui);
        return pending_items.includes(item_instance);
    }

    getPendingFungibleItemDeltas() {
        const cur_fungible_items = this.character.getFungibleItemCounts();
        for (const [map_key, count] of this.orig_fungible_items) {
            let prev_count = 0;
            if (cur_fungible_items.has(map_key)) {
                prev_count = cur_fungible_items.get(map_key);
            }
            cur_fungible_items.set(map_key, prev_count - count);
        }
        return cur_fungible_items;
    }

    getPendingFungibleItemDelta(item_instance) {
        const fungibleItemDeltas = this.getPendingFungibleItemDeltas();
        if (!fungibleItemDeltas.has(item_instance.def)) return 0;
        return fungibleItemDeltas.get(item_instance.def);
    }

    deactivate() {
        this.character = null;
        this.trade_partner_ui = null;

        this.orig_gold = 0;
        this.orig_inventory_slots = [];
        this.orig_fungible_items = null;
        this.orig_regular_items = null;
    }

    refreshGrid() {
        this.slot_grid.innerHTML = '';
        this.slot_grid.addEventListener('contextmenu', e => e.preventDefault(), { once: true });

        for (let i = 0; i < 40; i++) {
            const item_instance = this.character.inventorySlots[i];
            const slotEl = document.createElement('div');

            slotEl.className = `inventory-slot ${i < 10 ? 'hotbar-row' : ''}`;
            slotEl.dataset.index = i;

            if (item_instance) {
                const icon = document.createElement('div');
                icon.className = 'item-icon';
                icon.textContent = item_instance.def.icon;
                slotEl.appendChild(icon);

                if (item_instance.count > 1) {
                    const count_element = document.createElement('span');
                    count_element.className = 'item-count';
                    count_element.textContent = item_instance.count;
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
                this.handleMouseEnter(item_instance);
            });

            this.slot_grid.appendChild(slotEl);
        }

        this.refreshGold();
    }

    handleMouseEnter(item_instance) {
        if (!item_instance) {
            this.itemDescEl.textContent = '<Empty slot>';
            return;
        }

        const name = item_instance.def.name;
        const baseDesc = item_instance.def.description || "";
        let fungible_tag = "";
        if (item_instance.isFungible()) {
            //fungible_tag = "<br>(Fungible)"
        }

        let extraInfo = "";

        if (this.trade_partner_ui) {
            const tradeInfo = this.getTradeHoverInfo(item_instance);
            if (tradeInfo) {
                let priceHTML = `
                    <span style="color:#888;font-weight:bold">${tradeInfo.label}: </span>
                    <span style="color:${tradeInfo.color};font-weight:bold">${tradeInfo.total_price.toLocaleString()}g</span>
                `;

                // Extra per-unit line for stacks
                if (tradeInfo.display_count > 1) {
                    priceHTML += `<br>
                        <span style="color:#888;font-size:0.9em">(${tradeInfo.unitPrice.toLocaleString()}g each)</span>`;
                }

                extraInfo = `<br><br>${priceHTML}`;
            }
        }

        this.itemDescEl.innerHTML = `<strong>${name}</strong><br>${baseDesc}${fungible_tag}${extraInfo}`;
    }

    refreshGold() {
        if (!this.character) return;
        this.gold_element.textContent = this.character.gold.toLocaleString();
        this.gold_element.style.color = (this.character.gold < 0) ? '#ff4444' : '#ffeb3b';
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
        } else if (this.trade_partner_ui) {
            const trade_partner = this.trade_partner_ui.character;
            if (dataObj.character_name == trade_partner.display_name) {
                this.character.swapInventorySlots(to_index, trade_partner, from_index);
            } else {
                alert("Invalid grid drop.");
            }
        }
        this.refresh_grids_func();
    }

    openSplitDialog(index, event) {
        if (!event || index < 0 || index >= 40) return;

        const slotData = this.character.inventorySlots[index];
        if (!slotData || slotData.count <= 1) return;

        if (!this.split_ui) this.split_ui = new SplitUI();

        this.split_ui.setPosition(event.clientX, event.clientY);
        this.split_ui.open(this, index);
    }

    closeSplitDialog() {
        this.split_ui.close();
    }

    performSplit(num_to_split, index) {
        this.character.splitInventoryItem(num_to_split, index);
        this.closeSplitDialog();
        this.refresh_grids_func();
    }

    getTradeHoverInfo(itemInst) {
        if (!itemInst) return null;

        let display_count = 1;
        let is_pending = false;
        if (itemInst.isFungible()) {
            const delta = this.getPendingFungibleItemDelta(itemInst);
            is_pending = delta > 0;
            display_count = is_pending ? Math.abs(delta) : itemInst.count;
        } else {
            is_pending = this.isPendingNonFungibleItem(itemInst, this.trade_partner_ui);
        }

        let label, unitPrice, color;
        if (this.is_for_player) {
            if (is_pending) {
                label = "Buying";
                unitPrice = itemInst.def.ask;
                color = "rgb(128, 128, 128)";
            } else {
                label = "Sell";
                unitPrice = itemInst.def.bid;
                color = "#ffeb3b";
            }
        } else {
            if (is_pending) {
                label = "Selling";
                unitPrice = itemInst.def.bid;
                color = "rgb(128, 128, 128)";
            } else {
                label = "Buy";
                unitPrice = itemInst.def.ask;
                color = "#ffeb3b";
            }
        }

        const total_price = unitPrice * display_count;
        if (is_pending){
            if (this.character.gold < 0) color = "#ff4444";
        } else {
            if (this.trade_partner_ui.character.gold - total_price < 0) color = "#ff4444";
        }

        return { label, total_price, display_count, unitPrice, color };
    }

    hasChanges() {
        const num_slots = this.character.inventorySlots.length;
        if (this.orig_inventory_slots.length != num_slots) return true;
        for (let i = 0; i < num_slots; ++i)
        {
            if (this.character.inventorySlots[i] !=
                this.orig_inventory_slots[i]) return true;
        }
        return false;
    }
}

