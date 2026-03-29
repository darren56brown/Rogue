import { SpriteSheet } from './sprite_sheet.js';

export class SpriteViewer {
    constructor(image_library, onOpen, onClose) {
        this.image_library = image_library;

        this.container = document.getElementById('spriteViewer');
        this.canvas = document.getElementById('viewerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.spriteSheet = null;  
        //const sprite_image = this.image_library.get(character.sprite_image_name);
        //this.spriteSheet = new SpriteSheet(sprite_image);
        //this.spriteSheet.setIdle(false);
        //this.spriteSheet.setDirection("Down");

        this.onOpen = onOpen;
        this.onClose = onClose;

        this.isActive = false;

        this.initUIEvents();
    }

    initUIEvents() {
        document.getElementById('closeViewer').onclick = () => this.deactivate();

        document.getElementById('prevAnim').onclick = () => this.changeAction(-1);
        document.getElementById('nextAnim').onclick = () => this.changeAction(1);

        this.dirButtons = {
            Up:    document.getElementById('dirUp'),
            Down:  document.getElementById('dirDown'),
            Left:  document.getElementById('dirLeft'),
            Right: document.getElementById('dirRight')
        };
        this.idleBtn = document.getElementById('idleBtn');

        this.dirButtons.Up.onclick    = () => this.setDirection("Up");
        this.dirButtons.Down.onclick  = () => this.setDirection("Down");
        this.dirButtons.Left.onclick  = () => this.setDirection("Left");
        this.dirButtons.Right.onclick = () => this.setDirection("Right");

        this.idleBtn.onclick = () => this.toggleIdle();
    }

    activate(character) {
        this.deactivate();

        const sprite_image = this.image_library.get(character.sprite_image_name);
        this.spriteSheet = new SpriteSheet(sprite_image);
        this.spriteSheet.setIsIdle(false);
        this.spriteSheet.setDirection("Down");

        this.isActive = true;
        this.container.classList.add('is-active');
        this.onOpen();
        this.updateAllUI();
    }

    deactivate() {
        if (!this.isActive) return;

        this.spriteSheet = null;

        this.isActive = false;
        this.container.classList.remove('is-active');
        this.onClose();
    }

    // Delegate to SpriteSheet + UI refresh
    setDirection(dir) {
        this.spriteSheet.setDirection(dir);
        this.updateAllUI();
    }

    toggleIdle() {
        this.spriteSheet.setIsIdle(!this.spriteSheet.isIdle);
        this.updateAllUI();
    }

    changeAction(dir) {
        this.spriteSheet.changeAction(dir);
        this.updateAllUI();
    }

    updateAllUI() {
        this.updateDirectionUI();
        this.updateIdleUI();
        this.updateActionUI();
    }

    updateDirectionUI() {
        Object.values(this.dirButtons).forEach(btn => btn.classList.remove('active'));
        const activeBtn = this.dirButtons[this.spriteSheet.currentDirection];
        if (activeBtn) activeBtn.classList.add('active');
    }

    updateIdleUI() {
        const current = this.spriteSheet.getCurrentAnimation();
        const canIdle = current.hasIdle;

        if (canIdle) {
            this.idleBtn.classList.toggle('active', this.spriteSheet.isIdle);
            this.idleBtn.disabled = false;
            this.idleBtn.style.opacity = "1";
        } else {
            this.idleBtn.classList.remove('active');
            this.idleBtn.disabled = true;
            this.idleBtn.style.opacity = "0.4";
        }
    }

    updateActionUI() {
        const anim = this.spriteSheet.getCurrentAnimation();
        const actionName = this.spriteSheet.getCurrentAction();

        let displayName = actionName;
        if (anim.direction !== null) {
            displayName += ` ${this.spriteSheet.currentDirection}`;
        }

        document.getElementById('animNameText').innerText = displayName;
        document.getElementById('animDetailsText').innerText = 
            `Row ${anim.row} | ${anim.numColumns} columns`;
    }

    updatePhysics(dt) {
        if (!this.isActive) return;
        this.spriteSheet.update(dt);
    }

    draw() {
        if (!this.isActive) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.spriteSheet.draw(this.ctx, 0, 0, this.canvas.width, this.canvas.height);
    }
}