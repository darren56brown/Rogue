import {vec2D} from './vec2D.js';

export class SpriteViewer {
    constructor(image, onOpen, onClose) {
        this.container = document.getElementById('spriteViewer');
        this.canvas = document.getElementById('viewerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Use the image passed from the ImageLibrary
        this.spriteSheet = image;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // ====================== ANIMATION DATA ======================
        this.animations = [
            // Example – replace / expand with your full sprite sheet
            { action: "Idle",   direction: "Down",  isIdle: true,  frames: 4, row: 0,  startCol: 0 },

            // Walk (idle at col 0, animation at col 1+ on same row)
            { action: "Walk",   direction: "Right", isIdle: true,  frames: 1, row: 11, startCol: 0 },
            { action: "Walk",   direction: "Right", isIdle: false, frames: 8, row: 11, startCol: 1 },
            { action: "Walk",   direction: "Left",  isIdle: true,  frames: 1, row: 9,  startCol: 0 },
            { action: "Walk",   direction: "Left",  isIdle: false, frames: 8, row: 9,  startCol: 1 },
            { action: "Walk",   direction: "Up",    isIdle: true,  frames: 1, row: 8,  startCol: 0 },
            { action: "Walk",   direction: "Up",    isIdle: false, frames: 8, row: 8,  startCol: 1 },
            { action: "Walk",   direction: "Down",  isIdle: true,  frames: 1, row: 10, startCol: 0 },
            { action: "Walk",   direction: "Down",  isIdle: false, frames: 8, row: 10, startCol: 1 },

            // Attack (no idle variant in your original sheet)
            { action: "Attack", direction: "Right", isIdle: false, frames: 4, row: 5,  startCol: 0 },
            { action: "Attack", direction: "Left",  isIdle: false, frames: 4, row: 6,  startCol: 0 },
            { action: "Attack", direction: "Up",    isIdle: false, frames: 4, row: 7,  startCol: 0 },
            { action: "Attack", direction: "Down",  isIdle: false, frames: 4, row: 8,  startCol: 0 },

            // Death / Hurt / Spell etc. – add idle variants only if your sheet has them
            { action: "Death",  direction: null,    isIdle: false, frames: 5, row: 9,  startCol: 0 },
            { action: "Hurt",   direction: null,    isIdle: false, frames: 2, row: 10, startCol: 0 },
            { action: "Spell",  direction: null,    isIdle: false, frames: 7, row: 11, startCol: 0 },
            { action: "Pick Up",direction: null,    isIdle: false, frames: 3, row: 12, startCol: 0 },
            { action: "Jump",   direction: null,    isIdle: false, frames: 5, row: 13, startCol: 0 },
            { action: "Emote",  direction: null,    isIdle: false, frames: 4, row: 14, startCol: 0 },
        ];

        // Build list of unique actions (in order of first appearance)
        const actionSet = new Set();
        this.uniqueActions = [];
        for (const anim of this.animations) {
            if (!actionSet.has(anim.action)) {
                actionSet.add(anim.action);
                this.uniqueActions.push(anim.action);
            }
        }

        // Current selection state
        this.currentActionIndex = this.uniqueActions.indexOf("Walk");
        if (this.currentActionIndex === -1) this.currentActionIndex = 0;

        this.currentDirection = "Right";
        this.isIdle = false;
        this.currentFrame = 0;

        this.spriteSize = vec2D(64, 64);
        this.lastUpdate = 0;
        this.frameInterval = 100; // ms per frame
        this.isActive = false;

        this.initUIEvents();
    }

    initUIEvents() {
        document.getElementById('closeViewer').onclick = () => this.close();

        // Action cycling
        document.getElementById('prevAnim').onclick = () => this.changeAction(-1);
        document.getElementById('nextAnim').onclick = () => this.changeAction(1);

        // Direction pad (sticky – only one arrow active)
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

        // Idle toggle
        this.idleBtn.onclick = () => this.toggleIdle();
    }

    toggle() {
        this.isActive ? this.close() : this.open();
    }

    open() {
        this.isActive = true;
        this.container.classList.add('is-active');
        if (this.onOpen) this.onOpen();

        this.updateDirectionUI();
        this.updateIdleUI();
        this.updateUI();
        this.animate();
    }

    close() {
        if (!this.isActive) return;
        this.isActive = false;
        this.container.classList.remove('is-active');
        if (this.onClose) this.onClose();
    }

    // ====================== DIRECTION & IDLE ======================
    setDirection(dir) {
        this.currentDirection = dir;
        this.currentFrame = 0;
        this.updateDirectionUI();
        this.updateUI();
        this.draw();
    }

    toggleIdle() {
        this.isIdle = !this.isIdle;
        this.currentFrame = 0;
        this.updateIdleUI();
        this.updateUI();
        this.draw();
    }

    updateDirectionUI() {
        Object.values(this.dirButtons).forEach(btn => btn.classList.remove('active'));
        const activeBtn = this.dirButtons[this.currentDirection];
        if (activeBtn) activeBtn.classList.add('active');
    }

    updateIdleUI() {
        this.isIdle ? this.idleBtn.classList.add('active') : this.idleBtn.classList.remove('active');
    }

    // ====================== ACTION CYCLING ======================
    changeAction(dir) {
        this.currentActionIndex = (this.currentActionIndex + dir + this.uniqueActions.length) % this.uniqueActions.length;
        this.currentFrame = 0;
        this.updateUI();
        this.updateDirectionUI();
        this.updateIdleUI();
        this.draw();
    }

    // ====================== FIND CORRECT ANIMATION ======================
    getCurrentAnimation() {
        const action = this.uniqueActions[this.currentActionIndex];

        // Exact match (action + direction + idle state)
        let match = this.animations.find(a =>
            a.action === action &&
            (a.direction === this.currentDirection || a.direction === null) &&
            a.isIdle === this.isIdle
        );

        // Fallback: any entry for this action
        if (!match) {
            match = this.animations.find(a => a.action === action && a.isIdle === this.isIdle) ||
                    this.animations.find(a => a.action === action);
        }

        return match || this.animations[0];
    }

    updateUI() {
        const anim = this.getCurrentAnimation();
        const actionName = this.uniqueActions[this.currentActionIndex];

        let displayName = actionName;

        // Only append direction if this animation actually uses direction
        if (anim.direction !== null && this.currentDirection) {
            displayName += ` ${this.currentDirection}`;
        }
        if (this.isIdle) {
            displayName += ` (idle)`;
        }

        document.getElementById('animNameText').innerText = displayName;
        document.getElementById('animDetailsText').innerText = `Row ${anim.row} | ${anim.frames} Frames`;
    }

    animate(timestamp = 0) {
        if (!this.isActive) return;

        if (timestamp - this.lastUpdate > this.frameInterval) {
            this.currentFrame = (this.currentFrame + 1) % this.getCurrentAnimation().frames;
            this.lastUpdate = timestamp;
            this.draw();
        }
        requestAnimationFrame((t) => this.animate(t));
    }

    draw() {
        const anim = this.getCurrentAnimation();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const sx = (anim.startCol + this.currentFrame) * this.spriteSize.x;
        const sy = anim.row * this.spriteSize.y;

        this.ctx.drawImage(
            this.spriteSheet,
            sx, sy, this.spriteSize.x, this.spriteSize.y,
            0, 0, this.canvas.width, this.canvas.height
        );
    }
}
