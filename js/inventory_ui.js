
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

        this.equipContainer = null; // will hold the 4 equipment slots

        this.isActive = false;

        this.equipmentOrder = [
            { key: 'helmet', label: 'Helmet' },
            { key: 'chest',  label: 'Chest' },
            { key: 'legs',   label: 'Legs' },
            { key: 'boots',  label: 'Boots' }
        ];

        this.defaultEquipIcons = {
            helmet: '🪖',
            chest:  '🛡️',
            legs:   '👖',
            boots:  '🥾'
        };
        
        this.equipBackgrounds = {
            helmet: { row: 0, col: 0 },
            chest:  { row: 1, col: 0 },
            legs:   { row: 2, col: 0 },
            boots:  { row: 3, col: 0 }
        };

        this.initEvents();
    }

    initEvents() {
        this.closeBtn.onclick = () => this.deactivate();
    }

    activate(player) {
        if (this.isActive) return;
        this.player = player;

        const headerTitle = document.querySelector('#inventoryPanel .viewer-header h2');
        headerTitle.textContent = this.player.display_name;

        this.isActive = true;
        this.container.classList.add('is-active');
        this.onOpen();

        this.setupPaperDoll();
        this.refreshGrid();
        this.refreshPaperDoll();
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.container.classList.remove('is-active');
        this.onClose();
        this.player = null;
    }

    // ====================== PAPER DOLL (4x1) ======================
    setupPaperDoll() {
        const paperDollDiv = this.container.querySelector('.equipment-panel');
        this.equipContainer = paperDollDiv.querySelector('.equipment-grid');
        this.equipContainer.innerHTML = ''; // Clear old content

        const slotsImg = this.imageLibrary.get('slots');

        for (const eq of this.equipmentOrder) {
            const slotEl = document.createElement('div');
            slotEl.className = `inventory-slot equip-slot`;
            slotEl.dataset.slotType = eq.key;

            // Set background from slots.png
            const bg = this.equipBackgrounds[eq.key];
            if (slotsImg && bg) {
                slotEl.style.backgroundImage = `url('${slotsImg.src}')`;
                slotEl.style.backgroundPosition = `-${bg.col * 32}px -${bg.row * 32}px`;
                slotEl.style.backgroundSize = '128px 128px';
            }

            // Item icon (on top)
            const iconDiv = document.createElement('div');
            iconDiv.className = 'item-icon';
            slotEl.appendChild(iconDiv);

            // Drag & Drop
            slotEl.draggable = true;
            slotEl.addEventListener('dragstart', e => {
                const item = this.player.equipment[eq.key];
                if (item) {
                    e.dataTransfer.setData('text/plain', `equip:${eq.key}`);
                } else {
                    e.preventDefault();
                }
            });

            slotEl.addEventListener('dragover', e => e.preventDefault());
            slotEl.addEventListener('drop', e => this.handleEquipDrop(e, slotEl));

            // Hover description
            slotEl.addEventListener('mouseenter', () => {
                const item = this.player.equipment[eq.key];
                if (item) {
                    this.itemDescEl.innerHTML = `<strong>${item.name}</strong><br>${item.description || 'No description.'}`;
                } else {
                    this.itemDescEl.textContent = `${eq.label} (empty)`;
                }
            });

            this.equipContainer.appendChild(slotEl);
        }
    }

    handleEquipDrop(e, slotEl) {
        e.preventDefault();
        const targetType = slotEl.dataset.slotType;
        const data = e.dataTransfer.getData('text/plain');

        let droppedItem = null;
        let fromInventoryIndex = null;
        let fromEquipType = null;

        if (data.startsWith('equip:')) {
            fromEquipType = data.slice(6);
            droppedItem = this.player.equipment[fromEquipType];
        } else {
            fromInventoryIndex = parseInt(data);
            if (!isNaN(fromInventoryIndex)) {
                droppedItem = this.player.inventorySlots[fromInventoryIndex]?.item;
            }
        }

        if (!droppedItem || droppedItem.equipSlot !== targetType) return;

        // Swap logic
        if (fromInventoryIndex !== null) {
            const fromSlot = this.player.inventorySlots[fromInventoryIndex];
            const oldItem = this.player.equipment[targetType];

            this.player.equipment[targetType] = droppedItem;
            fromSlot.item = oldItem;
            fromSlot.count = oldItem ? 1 : 0;
        } 
        else if (fromEquipType && fromEquipType !== targetType) {
            // Swap two equipment slots
            const temp = this.player.equipment[targetType];
            this.player.equipment[targetType] = this.player.equipment[fromEquipType];
            this.player.equipment[fromEquipType] = temp;
        }

        this.refreshGrid();
        this.refreshPaperDoll();
    }

    refreshPaperDoll() {
        if (!this.equipContainer) return;

        const slotEls = this.equipContainer.querySelectorAll('.inventory-slot');
        
        slotEls.forEach((slotEl, i) => {
            const slotType = this.equipmentOrder[i].key;
            const item = this.player.equipment[slotType];
            const iconDiv = slotEl.querySelector('.item-icon');

            if (item) {
                iconDiv.textContent = item.icon;
                iconDiv.style.opacity = "1";
            } else {
                iconDiv.textContent = '';
                iconDiv.style.opacity = "0";
            }
        });
    }

    // ====================== MAIN INVENTORY GRID ======================
    refreshGrid() {
        this.gridContainer.innerHTML = '';
        for (let i = 0; i < 40; i++) {
            const slotData = this.player.inventorySlots[i];
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

            // Drag & Drop
            slotEl.draggable = true;
            slotEl.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', i.toString()));
            slotEl.addEventListener('dragover', e => e.preventDefault());
            slotEl.addEventListener('drop', e => this.handleGridDrop(e, slotEl));

            // Hover
            slotEl.addEventListener('mouseenter', () => {
                const item = slotData?.item;
                if (item) {
                    this.itemDescEl.innerHTML = `<strong>${item.name}</strong><br>${item.description || 'No description.'}`;
                } else {
                    this.itemDescEl.textContent = 'Empty slot';
                }
            });

            this.gridContainer.appendChild(slotEl);
        }
    }

    handleGridDrop(e, slotEl) {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        const toIndex = parseInt(slotEl.dataset.index);

        if (data.startsWith('equip:')) {
            const fromEquipType = data.slice(6);
            const itemToMove = this.player.equipment[fromEquipType];
            if (!itemToMove) return;

            const targetSlot = this.player.inventorySlots[toIndex];

            if (!targetSlot.item) {
                targetSlot.item = itemToMove;
                targetSlot.count = 1;
                this.player.equipment[fromEquipType] = null;
            } else if (targetSlot.item.equipSlot === fromEquipType) {
                // Swap
                const temp = targetSlot.item;
                targetSlot.item = itemToMove;
                targetSlot.count = 1;
                this.player.equipment[fromEquipType] = temp;
            } else {
                return;
            }

            this.refreshGrid();
            this.refreshPaperDoll();
            return;
        }

        // Normal inventory slot swap
        const fromIndex = parseInt(data);
        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            this.player.swapInventorySlots(fromIndex, toIndex);
            this.refreshGrid();
        }
    }
}
