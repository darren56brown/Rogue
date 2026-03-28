import {vec2D} from './vec2D.js';

export class SpriteViewer {
    constructor(image, onOpen, onClose) {
        this.container = document.getElementById('spriteViewer');
        this.canvas = document.getElementById('viewerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.spriteSheet = image;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // ====================== SIMPLIFIED ANIMATION DATA ======================
        // New structure:
        // action, direction, hasIdle, numColumns, row
        // - hasIdle: true  → Idle is always column 0, animation starts at column 1
        // - hasIdle: false → No idle, animation starts at column 0
        // - numColumns = total sprites in this row for the action
        this.animations = [
            // Example – update with your actual sprite sheet
            { action: "Idle",   direction: "Down",  hasIdle: true,  numColumns: 4, row: 0 },

            // Walk rows – most have idle at col 0
            { action: "Walk",   direction: "Right", hasIdle: true,  numColumns: 9, row: 11 }, // 1 idle + 8 walk
            { action: "Walk",   direction: "Left",  hasIdle: true,  numColumns: 9, row: 9 },
            { action: "Walk",   direction: "Up",    hasIdle: true,  numColumns: 9, row: 8 },
            { action: "Walk",   direction: "Down",  hasIdle: true,  numColumns: 9, row: 10 },

            // Attack – no idle frame
            { action: "Attack", direction: "Right", hasIdle: false, numColumns: 4, row: 5 },
            { action: "Attack", direction: "Left",  hasIdle: false, numColumns: 4, row: 6 },
            { action: "Attack", direction: "Up",    hasIdle: false, numColumns: 4, row: 7 },
            { action: "Attack", direction: "Down",  hasIdle: false, numColumns: 4, row: 8 },

            // Other actions without direction or idle
            { action: "Death",  direction: null,    hasIdle: false, numColumns: 5, row: 9 },
            { action: "Hurt",   direction: null,    hasIdle: false, numColumns: 2, row: 10 },
            { action: "Spell",  direction: null,    hasIdle: false, numColumns: 7, row: 11 },
            { action: "Pick Up",direction: null,    hasIdle: false, numColumns: 3, row: 12 },
            { action: "Jump",   direction: null,    hasIdle: false, numColumns: 5, row: 13 },
            { action: "Emote",  direction: null,    hasIdle: false, numColumns: 4, row: 14 },
        ];

        // Build unique actions
        const actionSet = new Set();
        this.uniqueActions = [];
        for (const anim of this.animations) {
            if (!actionSet.has(anim.action)) {
                actionSet.add(anim.action);
                this.uniqueActions.push(anim.action);
            }
        }

        this.currentActionIndex = this.uniqueActions.indexOf("Walk") ?? 0;
        this.currentDirection = "Right";
        this.isIdle = false;
        this.currentFrame = 0;

        this.spriteSize = vec2D(64, 64);
        this.lastUpdate = 0;
        this.frameInterval = 100;
        this.isActive = false;

        this.initUIEvents();
    }

    initUIEvents() {
        document.getElementById('closeViewer').onclick = () => this.close();

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

    toggle() {
        this.isActive ? this.close() : this.open();
    }

    open() {
        this.isActive = true;
        this.container.classList.add('is-active');
        if (this.onOpen) this.onOpen();

        this.updateAllUI();
        this.animate();
    }

    close() {
        if (!this.isActive) return;
        this.isActive = false;
        this.container.classList.remove('is-active');
        if (this.onClose) this.onClose();
    }

    setDirection(dir) {
        this.currentDirection = dir;
        this.currentFrame = 0;
        this.updateAllUI();
        this.draw();
    }

    toggleIdle() {
        const current = this.getCurrentAnimation();
        if (!current.hasIdle) return; // prevent toggling when no idle exists

        this.isIdle = !this.isIdle;
        this.currentFrame = 0;
        this.updateAllUI();
        this.draw();
    }

    changeAction(dir) {
        this.currentActionIndex = (this.currentActionIndex + dir + this.uniqueActions.length) % this.uniqueActions.length;
        this.currentFrame = 0;
        // Reset idle to false when changing action (safer default)
        this.isIdle = false;
        this.updateAllUI();
        this.draw();
    }

    // ====================== GET CURRENT ANIMATION ======================
    getCurrentAnimation() {
        const action = this.uniqueActions[this.currentActionIndex];

        // Find best match
        let match = this.animations.find(a =>
            a.action === action &&
            (a.direction === this.currentDirection || a.direction === null)
        );

        return match || this.animations[0];
    }

    // ====================== UI UPDATES ======================
    updateAllUI() {
        this.updateDirectionUI();
        this.updateIdleUI();
        this.updateActionUI();
    }

    updateDirectionUI() {
        Object.values(this.dirButtons).forEach(btn => btn.classList.remove('active'));
        const activeBtn = this.dirButtons[this.currentDirection];
        if (activeBtn) activeBtn.classList.add('active');
    }

    updateIdleUI() {
        const current = this.getCurrentAnimation();
        const canIdle = current.hasIdle;

        if (canIdle) {
            this.idleBtn.classList.toggle('active', this.isIdle);
            this.idleBtn.disabled = false;
            this.idleBtn.style.opacity = "1";
        } else {
            this.idleBtn.classList.remove('active');
            this.idleBtn.disabled = true;
            this.idleBtn.style.opacity = "0.4";
        }
    }

    updateActionUI() {
        const anim = this.getCurrentAnimation();
        const actionName = this.uniqueActions[this.currentActionIndex];

        let displayName = actionName;
        if (anim.direction !== null) {
            displayName += ` ${this.currentDirection}`;
        }

        document.getElementById('animNameText').innerText = displayName;
        document.getElementById('animDetailsText').innerText = 
            `Row ${anim.row} | ${anim.numColumns} columns`;
    }

    // ====================== ANIMATION ======================
    animate(timestamp = 0) {
        if (!this.isActive) return;

        if (timestamp - this.lastUpdate > this.frameInterval) {
            const anim = this.getCurrentAnimation();
            const numFrames = this.isIdle && anim.hasIdle ? 1 : anim.numColumns - (anim.hasIdle ? 1 : 0);
            
            this.currentFrame = (this.currentFrame + 1) % Math.max(1, numFrames);
            this.lastUpdate = timestamp;
            this.draw();
        }
        requestAnimationFrame((t) => this.animate(t));
    }

    draw() {
        const anim = this.getCurrentAnimation();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let col;
        if (this.isIdle && anim.hasIdle) {
            col = 0;                    // idle is always first frame
        } else {
            col = anim.hasIdle ? 1 + this.currentFrame : this.currentFrame;
        }

        const sx = col * this.spriteSize.x;
        const sy = anim.row * this.spriteSize.y;

        this.ctx.drawImage(
            this.spriteSheet,
            sx, sy, this.spriteSize.x, this.spriteSize.y,
            0, 0, this.canvas.width, this.canvas.height
        );
    }
}