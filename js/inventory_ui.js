// inventory_ui.js
export class InventoryUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.container = document.getElementById('inventoryPanel');
        this.gridContainer = document.getElementById('inventoryGrid');
        this.itemDescEl = document.getElementById('itemDescription');
        this.closeBtn = document.getElementById('closeInventory');

        this.isActive = false;
        this.initEvents();
    }

    initEvents() {
        this.closeBtn.onclick = () => this.deactivate();
    }

    activate(player) {
        if (this.isActive) return;
        this.player = player;
        this.isActive = true;
        this.container.classList.add('is-active');
        this.onOpen();
        this.refreshGrid();
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.container.classList.remove('is-active');
        this.onClose();
    }

    refreshGrid() {
        this.gridContainer.innerHTML = '';
        for (let i = 0; i < 40; i++) {
            const slotData = this.player.inventorySlots[i];
            const slotEl = document.createElement('div');
            //slotEl.className = `inventory-slot ${i < 10 ? 'hotbar-row' : ''}`;
            slotEl.className = `inventory-slot`;
            slotEl.dataset.index = i;

            if (slotData.item) {
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

            // Drag & Drop
            slotEl.draggable = true;
            slotEl.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', i.toString());
            });
            slotEl.addEventListener('dragover', e => e.preventDefault());
            slotEl.addEventListener('drop', e => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData('text/plain'));
                const to = parseInt(slotEl.dataset.index);
                if (from !== to) {
                    this.player.swapInventorySlots(from, to);
                    this.refreshGrid();
                }
            });

            // Hover info
            slotEl.addEventListener('mouseenter', () => {
                if (slotData.item) {
                    this.itemDescEl.innerHTML = `
                        <strong>${slotData.item.name}</strong><br>
                        ${slotData.item.description || 'No description.'}
                    `;
                } else {
                    this.itemDescEl.textContent = 'Empty slot';
                }
            });

            this.gridContainer.appendChild(slotEl);
        }
    }
}
