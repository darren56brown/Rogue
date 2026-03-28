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

        this.animations = [
            { action: "Cast",   direction: "Up",    hasIdle: true,  numColumns: 7, row: 0 },
            { action: "Cast",   direction: "Left",  hasIdle: true,  numColumns: 7, row: 1 },
            { action: "Cast",   direction: "Down",  hasIdle: true,  numColumns: 7, row: 2 },
            { action: "Cast",   direction: "Right", hasIdle: true,  numColumns: 7, row: 3 },

            { action: "Thrust",   direction: "Up",    hasIdle: true,  numColumns: 8, row: 4 },
            { action: "Thrust",   direction: "Left",  hasIdle: true,  numColumns: 8, row: 5 },
            { action: "Thrust",   direction: "Down",  hasIdle: true,  numColumns: 8, row: 6 },
            { action: "Thrust",   direction: "Right", hasIdle: true,  numColumns: 8, row: 7 },

            { action: "Walk",   direction: "Up",    hasIdle: true,  numColumns: 9, row: 8 },
            { action: "Walk",   direction: "Left",  hasIdle: true,  numColumns: 9, row: 9 },
            { action: "Walk",   direction: "Down",  hasIdle: true,  numColumns: 9, row: 10 },
            { action: "Walk",   direction: "Right", hasIdle: true,  numColumns: 9, row: 11 },

            { action: "Slash",   direction: "Up",    hasIdle: true,  numColumns: 6, row: 12 },
            { action: "Slash",   direction: "Left",  hasIdle: true,  numColumns: 6, row: 13 },
            { action: "Slash",   direction: "Down",  hasIdle: true,  numColumns: 6, row: 14 },
            { action: "Slash",   direction: "Right", hasIdle: true,  numColumns: 6, row: 15 },

            { action: "Shoot",   direction: "Up",    hasIdle: true,  numColumns: 13, row: 16 },
            { action: "Shoot",   direction: "Left",  hasIdle: true,  numColumns: 13, row: 17 },
            { action: "Shoot",   direction: "Down",  hasIdle: true,  numColumns: 13, row: 18 },
            { action: "Shoot",   direction: "Right", hasIdle: true,  numColumns: 13, row: 19 },

            { action: "Die",   direction: "Down", hasIdle: false,  numColumns: 6, row: 20 },
            { action: "Climb",   direction: "Up", hasIdle: false,  numColumns: 6, row: 21 },

            { action: "Stand",   direction: "Up",    hasIdle: false,  numColumns: 2, row: 22 },
            { action: "Stand",   direction: "Left",  hasIdle: false,  numColumns: 2, row: 23 },
            { action: "Stand",   direction: "Down",  hasIdle: false,  numColumns: 2, row: 24 },
            { action: "Stand",   direction: "Right", hasIdle: false,  numColumns: 2, row: 25 },

            { action: "Jump",   direction: "Up",    hasIdle: false,  numColumns: 5, row: 26 },
            { action: "Jump",   direction: "Left",  hasIdle: false,  numColumns: 5, row: 27 },
            { action: "Jump",   direction: "Down",  hasIdle: false,  numColumns: 5, row: 28 },
            { action: "Jump",   direction: "Right", hasIdle: false,  numColumns: 5, row: 29 }
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