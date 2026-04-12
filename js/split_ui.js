
export class SplitUI {
    constructor() {
        this.owner = null;
        this.slot_index = -1;
        this.split_dialog = document.getElementById('splitDialog');
        this.split_amount_element = document.getElementById('splitAmountInput');
        this.split_amount = 0;

        this.split_amount_element.addEventListener('input', () => {
            const value = parseInt(this.split_amount_element.value);
            this.setSplitAmountValue(value);
        });
    }

    open(owner, slot_index) {
        this.owner = owner;
        this.slot_index = slot_index;
        const split_item_instance = this.getSplitItemInstance();
        const num_split_items = split_item_instance.count;

        this.split_amount_element.max = num_split_items - 1;
        this.setSplitAmountValue(Math.floor(num_split_items / 2));

        const confirmBtn = document.getElementById('confirmSplit');
        const cancelBtn = document.getElementById('cancelSplit');
        const closeBtn = document.getElementById('closeSplitDialog');

        // Quick buttons
        document.querySelectorAll('.quick-split-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.amount;
                const max = num_split_items;

                let newValue = 1;
                if (type === '1') newValue = 1;
                else if (type === 'half') newValue = Math.floor(max / 2);
                else if (type === 'max') newValue = max - 1;

                this.setSplitAmountValue(newValue);
            });
        });

        confirmBtn.onclick = () => this.owner.performSplit(this.split_amount, this.slot_index);
        cancelBtn.onclick = closeBtn.onclick = () => this.owner.closeSplitDialog();
        
        this.split_dialog.style.display = 'block';
        this.split_amount_element.focus();
        this.split_amount_element.select();
    }

    getSplitItemInstance() {
        return this.owner.character.inventorySlots[this.slot_index];
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
        const split_item_instance = this.getSplitItemInstance();
        const num_split_items = split_item_instance.count;

        const max = parseInt(this.split_amount_element.max) || 1;
        value = Math.max(1, Math.min(max, value));

        if (value != this.split_amount) {
            this.split_amount = value;

            const left_slot_grid = document.getElementById('splitItemGridL');
            this.replaceSlotVisual(left_slot_grid, split_item_instance, this.split_amount);

            const right_slot_grid = document.getElementById('splitItemGridR');
            this.replaceSlotVisual(right_slot_grid, split_item_instance,
                num_split_items - this.split_amount);
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