/* FULLY UPDATED inventory_ui.js - replace your entire file with this */

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

        this.equipmentOrder = [
            { key: 'head', label: 'Head' },
            { key: 'neck', label: 'Neck' },
            { key: 'chest',  label: 'Chest' },
            { key: 'legs',   label: 'Legs' },
            { key: 'feet',  label: 'Feet' },
            { key: 'hand_1',  label: 'Hand' },
            { key: 'hand_2',  label: 'Hand' }
        ];

        this.paperDollSlots = {
            head: { left: 46, top: -3,  size: 36 },
            neck:  { left: 46, top: 28,  size: 36 },
            chest:  { left: 46, top: 59,  size: 36 },
            legs:   { left: 46, top: 93, size: 36 },
            feet:  { left: 46, top: 159, size: 36 },
            hand_1:  { left: 5, top: 97, size: 36 },
            hand_2:  { left: 87, top: 97, size: 36 }
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

    // ====================== PAPER DOLL (single 128x192 image) ======================
    setupPaperDoll() {
        const equipmentPanel = this.container.querySelector('.equipment-panel');
        const equipGrid = equipmentPanel.querySelector('.equipment-grid'); // reuse the existing div
        
        const oldPaperDoll = equipGrid.querySelector('.paper-doll-container');
        if (oldPaperDoll) {
            oldPaperDoll.remove();
        }

        // Create the paper doll container (relative positioning parent)
        const paperDollContainer = document.createElement('div');
        paperDollContainer.className = 'paper-doll-container';

        // Insert the 128x192 paper doll image
        const dollImgData = this.imageLibrary.get('paper_doll');
        if (dollImgData) {
            const imgEl = document.createElement('img');
            imgEl.src = dollImgData.src;
            imgEl.alt = 'Paper Doll';
            paperDollContainer.appendChild(imgEl);
        } else {
            console.warn('Paper doll image not found in ImageLibrary');
        }

        // Create invisible equipment slots at your chosen coordinates
        for (const eq of this.equipmentOrder) {
            const pos = this.paperDollSlots[eq.key];
            if (!pos) continue;

            const slotEl = document.createElement('div');
            slotEl.className = `inventory-slot equip-slot paper-doll-slot`;
            slotEl.dataset.slotType = eq.key;

            // Position exactly where you specified on the doll
            slotEl.style.position = 'absolute';
            slotEl.style.left = `${pos.left}px`;
            slotEl.style.top = `${pos.top}px`;
            slotEl.style.width = `${pos.size}px`;
            slotEl.style.height = `${pos.size}px`;

            // Item icon overlay
            const iconDiv = document.createElement('div');
            iconDiv.className = 'item-icon';
            slotEl.appendChild(iconDiv);

            // === DRAG & DROP (exactly the same behavior as before) ===
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

            // Hover description (exactly the same)
            slotEl.addEventListener('mouseenter', () => {
                const item = this.player.equipment[eq.key];
                if (item) {
                    this.itemDescEl.innerHTML = `<strong>${item.name}</strong><br>${item.description || 'No description.'}`;
                } else {
                    this.itemDescEl.textContent = `${eq.label} (empty)`;
                }
            });

            paperDollContainer.appendChild(slotEl);
        }

        // Add the finished paper doll to the equipment panel
        equipGrid.appendChild(paperDollContainer);
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

        if (!droppedItem) return;

        // === NEW: Flexible matching (up to first underscore) ===
        const itemSlotType = droppedItem.equipSlot;
        const slotBaseType = targetType.includes('_') ? targetType.split('_')[0] : targetType;

        if (itemSlotType !== slotBaseType) return;
        // =======================================================

        // Swap logic
        if (fromInventoryIndex !== null) {
            const fromSlot = this.player.inventorySlots[fromInventoryIndex];
            const oldItem = this.player.equipment[targetType];

            this.player.equipment[targetType] = droppedItem;
            fromSlot.item = oldItem;
            fromSlot.count = oldItem ? 1 : 0;
        } 
        else if (fromEquipType && fromEquipType !== targetType) {
            const temp = this.player.equipment[targetType];
            this.player.equipment[targetType] = this.player.equipment[fromEquipType];
            this.player.equipment[fromEquipType] = temp;
        }

        this.refreshGrid();
        this.refreshPaperDoll();
    }

    refreshPaperDoll() {
        const slotEls = this.container.querySelectorAll('.equip-slot');
        
        slotEls.forEach(slotEl => {
            const slotType = slotEl.dataset.slotType;
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

    // ====================== MAIN INVENTORY GRID (unchanged) ======================
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

            slotEl.draggable = true;
            slotEl.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', i.toString()));
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

        const fromIndex = parseInt(data);
        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            this.player.swapInventorySlots(fromIndex, toIndex);
            this.refreshGrid();
        }
    }
}