
class SplitUI {
    constructor() {
        this.slot_data = null;
        this.split_dialog = document.getElementById('splitDialog');
        this.split_amount_element = document.getElementById('splitAmountInput');
        this.split_amount = 0;

        this.split_amount_element.addEventListener('input', () => {
            const value = parseInt(this.split_amount_element.value);
            this.setSplitAmountValue(value);
        });
    }

    open(owner, slot_data) {
        this.slot_data = slot_data;

        this.split_amount_element.max = this.slot_data.count - 1;
        this.setSplitAmountValue(Math.floor(this.slot_data.count / 2));

        const confirmBtn = document.getElementById('confirmSplit');
        const cancelBtn = document.getElementById('cancelSplit');
        const closeBtn = document.getElementById('closeSplitDialog');

        // Quick buttons
        document.querySelectorAll('.quick-split-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.amount;
                const max = this.slot_data.count;

                let newValue = 1;
                if (type === '1') newValue = 1;
                else if (type === 'half') newValue = Math.floor(max / 2);
                else if (type === 'max') newValue = max - 1;

                this.setSplitAmountValue(newValue);
            });
        });

        confirmBtn.onclick = () => owner.performSplit(this.split_amount, this.slot_data);
        cancelBtn.onclick = closeBtn.onclick = () => owner.closeSplitDialog();
        
        this.split_dialog.style.display = 'block';
        this.split_amount_element.focus();
        this.split_amount_element.select();
    }

    close() {
        const dlg = this.split_dialog;
        const content = dlg.querySelector('.modal-content');

        dlg.style.display = 'none';

        dlg.style.alignItems = 'center';
        dlg.style.justifyContent = 'center';
        content.style.position = '';
        content.style.left = '';
        content.style.top = '';
    }

    setSplitAmountValue(value) {
        if (Number.isNaN(value)) value = 0;
        const split_item = this.slot_data;
        if (!split_item) value = 0;

        const max = parseInt(this.split_amount_element.max) || 1;
        value = Math.max(1, Math.min(max, value));

        if (value != this.split_amount) {
            this.split_amount = value;

            const left_slot_grid = document.getElementById('splitItemGridL');
            this.replaceSlotVisual(left_slot_grid, split_item, this.split_amount);

            const right_slot_grid = document.getElementById('splitItemGridR');
            this.replaceSlotVisual(right_slot_grid, split_item,
                this.slot_data.count - this.split_amount);
        }

        const ui_value = parseInt(this.split_amount_element.value);
        if (this.split_amount != ui_value) {
            this.split_amount_element.value = this.split_amount;
        }
    }

    replaceSlotVisual(slot_grid, item_inst, count) {
        slot_grid.innerHTML = '';
        const slot_elem = document.createElement('div');
        slot_elem.className = `item-icon-large`;
        if (item_inst) {
            const icon = document.createElement('div');
            icon.className = 'item-icon';
            icon.textContent = item_inst.def.icon;
            slot_elem.appendChild(icon);

            if (count > 1) {
                const count_elem = document.createElement('span');
                count_elem.className = 'item-count';
                count_elem.textContent = count;
                slot_elem.appendChild(count_elem);
            }
        }
        slot_grid.appendChild(slot_elem);
    }

    setPosition(left, top) {
        const dlg = this.split_dialog;
        const content = dlg.querySelector('.modal-content');

        dlg.style.alignItems = 'flex-start';
        dlg.style.justifyContent = 'flex-start';

        // Make content absolutely positioned inside the full-screen modal
        content.style.position = 'absolute';

        // Temporarily show off-screen so we can measure real width/height
        const originalLeft = content.style.left;
        const originalTop = content.style.top;
        content.style.left = '-9999px';
        content.style.top = '-9999px';
        dlg.style.display = 'block';   // must be visible to get correct size

        const width = content.offsetWidth;
        const height = content.offsetHeight;

        // Reset temporary off-screen styles
        dlg.style.display = 'none';
        content.style.left = originalLeft;
        content.style.top = originalTop;

        if (left < 0) left = 0;
        if (left + width > window.innerWidth)
            left = window.innerWidth - width;
        if (top + height > window.innerHeight)
            top = window.innerHeight - height;
        if (top < 0) top = 0;

        content.style.left = `${left}px`;
        content.style.top = `${top}px`;
    }
}

/////////////////////////////////
/////////////////////////////////

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
    }

    activate(character, trade_partner = null) {
        this.character = character;
        this.trade_partner = trade_partner;
    }

    deactivate() {
        this.character = null;
        this.trade_partner = null;
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
                if (slotData) {
                    const name = slotData.def.name;
                    const desc = slotData.def.description;
                    this.itemDescEl.innerHTML = `<strong>${name}</strong><br>${desc}`;
                } else {
                    this.itemDescEl.textContent = '<Empty slot>';
                }
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

            const equip_slot_filter = from_equip_slot_name.includes('_') ?
                from_equip_slot_name.split('_')[0] : from_equip_slot_name;
            const target_item = this.character.inventorySlots[to_index];

            if (!target_item) {
                this.character.inventorySlots[to_index] = itemToMove;
                this.character.equipment[from_equip_slot_name] = null;
            } else if (target_item.def.equipSlot == equip_slot_filter) {
                this.character.inventorySlots[to_index] = itemToMove;
                this.character.equipment[from_equip_slot_name] = target_item;
            } else {
                return;
            }

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
            this.character.tradeInventorySlots(to_index, this.character, from_index);
        } else if (this.trade_partner) {
            this.character.tradeInventorySlots(to_index, this.trade_partner, from_index);
        }
        this.refresh_grids_func();
    }

    openSplitDialog(index, event) {
        if (!event || index < 0 ||
            index >= this.character.inventorySlots.length) return;

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
}

