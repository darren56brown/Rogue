export class SlotGridUI {
    constructor(grid_element_name, gold_amount_name, item_desc_name,
        refresh_grids_func) {
        this.character = null;
        this.trade_partner = null;
        this.slot_grid = document.getElementById(grid_element_name);
        this.gold_value = document.getElementById(gold_amount_name);
        this.itemDescEl = document.getElementById(item_desc_name);
        this.refresh_grids_func = refresh_grids_func

        this.splitDialog = document.getElementById('splitDialog');
        this.split_from_index = -1;
        this.split_amount_element = null;
    }

    activate(character, trade_partner = null) {
        this.character = character;
        this.trade_partner = trade_partner;
        this.initSplitDialog()
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

            if (slotData?.item) {
                const icon = document.createElement('div');
                icon.className = 'item-icon';
                icon.textContent = slotData.item.icon;
                slotEl.appendChild(icon);

                if (slotData.count > 1) {
                    const count = document.createElement('span');
                    count.className = 'item-count';
                    count.textContent = slotData.count;
                    slotEl.appendChild(count);
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
                const item = slotData?.item;
                if (item) {
                    this.itemDescEl.innerHTML = `<strong>${item.name}</strong><br>${item.description || 'No description.'}`;
                } else {
                    this.itemDescEl.textContent = 'Empty slot';
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
            const fromEquipType = from_data.slice(6);
            const itemToMove = this.character.equipment[fromEquipType];
            if (!itemToMove) return;

            const targetSlot = this.character.inventorySlots[to_index];

            if (!targetSlot.item) {
                targetSlot.item = itemToMove;
                targetSlot.count = 1;
                this.character.equipment[fromEquipType] = null;
            } else if (targetSlot.item.equipSlot === fromEquipType) {
                const temp = targetSlot.item;
                targetSlot.item = itemToMove;
                targetSlot.count = 1;
                this.character.equipment[fromEquipType] = temp;
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

    initSplitDialog() {
        this.split_amount_element = document.getElementById('splitAmountInput');
        const confirmBtn = document.getElementById('confirmSplit');
        const cancelBtn = document.getElementById('cancelSplit');
        const closeBtn = document.getElementById('closeSplitDialog');

        this.split_amount_element.addEventListener('input', () => {
            let value = parseInt(this.split_amount_element.value);

            // Clamp to valid range
            //if (isNaN(value)) value = 1;
            //if (value < 1) value = 1;
            //if (value > parseInt(this.split_amount_element.max)) {
            //    value = parseInt(this.split_amount_element.max);
            //}

            this.setSplitAmountValue(value);
        });

        // Quick buttons
        document.querySelectorAll('.quick-split-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.amount;
                const slotData = this.character.inventorySlots[this.split_from_index];
                const max = slotData.count;

                let newValue = 1;
                if (type === '1') newValue = 1;
                else if (type === 'half') newValue = Math.floor(max / 2);
                else if (type === 'max') newValue = max - 1;

                this.setSplitAmountValue(newValue);
            });
        });

        confirmBtn.onclick = () => this.performSplit();
        cancelBtn.onclick = closeBtn.onclick = () => this.closeSplitDialog();
    }

    setSplitAmountValue(value) {
        if (!this.split_amount_element) return;

        const max = parseInt(this.split_amount_element.max) || 1;
        value = Math.max(1, Math.min(max, value));   // clamp

        if (parseInt(this.split_amount_element.value) !== value) {
            this.split_amount_element.value = value;
        }

        const slotData = this.character.inventorySlots[this.split_from_index];
        if (!slotData?.item) return;

        const left_slot_grid = document.getElementById('splitItemGridL');
        const right_slot_grid = document.getElementById('splitItemGridR');

        this.replaceSlotVisual(left_slot_grid, slotData.item, value);
        this.replaceSlotVisual(right_slot_grid, slotData.item, slotData.count - value);
    }

    openSplitDialog(index, event) {
        const slotData = this.character.inventorySlots[index];
        if (!slotData.item || slotData.count <= 1) return;

        this.split_from_index = index;

        this.split_amount_element.max = slotData.count - 1;
        this.setSplitAmountValue(Math.floor(slotData.count / 2));

        this.positionSplitDialog(event);

        this.splitDialog.style.display = 'block';
        this.split_amount_element.focus();
        this.split_amount_element.select();
    }

    positionSplitDialog(event) {
        const dlg = this.splitDialog;
        const content = dlg.querySelector('.modal-content');
        if (!content) return;

        if (!event) {
            dlg.style.alignItems = 'center';
            dlg.style.justifyContent = 'center';
            content.style.position = '';
            content.style.left = '';
            content.style.top = '';
            return;
        }

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

        let left = event.clientX;
        let top = event.clientY;
        if (left < 0) left = 0;
        if (left + width > window.innerWidth)
            left = window.innerWidth - width;
        if (top + height > window.innerHeight)
            top = window.innerHeight - height;
        if (top < 0) top = 0;

        content.style.left = `${left}px`;
        content.style.top = `${top}px`;
    }

    replaceSlotVisual(slot_grid, item, count) {
        slot_grid.innerHTML = '';
        const slot_elem = document.createElement('div');
        slot_elem.className = `item-icon-large`;
        if (item) {
            const icon = document.createElement('div');
            icon.className = 'item-icon';
            icon.textContent = item.icon;
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

    closeSplitDialog() {
        const modal = this.splitDialog;
        const content = modal.querySelector('.modal-content');

        modal.style.display = 'none';

        modal.style.alignItems = '';
        modal.style.justifyContent = '';
        content.style.position = '';
        content.style.left = '';
        content.style.top = '';

        this.split_from_index = -1;
    }

    performSplit() {
        const amount = parseInt(this.split_amount_element.value);
        if (!amount || this.split_from_index < 0) return;

        const slotData = this.character.inventorySlots[this.split_from_index];
        if (!slotData?.item || amount < 1 || amount >= slotData.count) {
            this.closeSplitDialog();
            return;
        }

        // Find first empty slot in THIS grid
        let targetIndex = -1;
        for (let i = 0; i < 40; i++) {
            if (!this.character.inventorySlots[i].item) {
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
        const item = slotData.item;
        slotData.count -= amount;

        this.character.inventorySlots[targetIndex].item = item;
        this.character.inventorySlots[targetIndex].count = amount;

        this.closeSplitDialog();
        this.refresh_grids_func();
    }
}

