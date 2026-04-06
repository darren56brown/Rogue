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
               this.openSplitDialog(i);
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
        const input = document.getElementById('splitAmountInput');
        const confirmBtn = document.getElementById('confirmSplit');
        const cancelBtn = document.getElementById('cancelSplit');
        const closeBtn = document.getElementById('closeSplitDialog');

        // Quick buttons
        document.querySelectorAll('.quick-split-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.amount;
                const max = parseInt(document.getElementById('splitMaxAmount').textContent.replace('/ ', '')) || 1;

                if (type === '1') input.value = 1;
                else if (type === 'half') input.value = Math.ceil(max / 2);
                else if (type === 'max') input.value = max;
            });
        });

        confirmBtn.onclick = () => this.performSplit();
        cancelBtn.onclick = closeBtn.onclick = () => this.closeSplitDialog();
    }

    openSplitDialog(index) {
        const slotData = this.character.inventorySlots[index];
        if (!slotData.item || slotData.count <= 1) return;

        this.split_from_index = index;

        document.getElementById('splitItemIcon').textContent = slotData.item.icon;
        document.getElementById('splitItemName').textContent = slotData.item.name;
        document.getElementById('splitCurrentCount').textContent = `x ${slotData.count}`;
        document.getElementById('splitMaxAmount').textContent = `/ ${slotData.count}`;

        const input = document.getElementById('splitAmountInput');
        input.max = slotData.count - 1;
        input.value = Math.ceil(slotData.count / 2);

        this.splitDialog.style.display = 'flex';
        input.focus();
        input.select();
    }

    closeSplitDialog() {
        this.splitDialog.style.display = 'none';
        this.split_from_index = -1;
    }

    performSplit() {
        const amount = parseInt(document.getElementById('splitAmountInput').value);
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

