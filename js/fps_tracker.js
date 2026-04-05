export class FPSTracker {
    constructor() {
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.currentFps = 0;
        this.lastUpdateTime = 0;
    }

    init(startTime) {
        this.lastFpsTime = startTime;
        this.lastUpdateTime = startTime;
    }

    compute(currentTime) {
        this.frameCount++;

        const timeSinceLast = currentTime - this.lastFpsTime;

        if (timeSinceLast >= 1000) {
            this.currentFps = Math.round(this.frameCount * 1000 / timeSinceLast);
            this.frameCount = 0;
            this.lastFpsTime = currentTime;
        }

        this.lastUpdateTime = currentTime;
    }

    show() {
        const fpsElement = document.getElementById("fps");
        if (fpsElement) {
            fpsElement.classList.add("is-active");
        }
    }

    hide() {
        const fpsElement = document.getElementById("fps");
        if (fpsElement) {
            fpsElement.classList.remove("is-active");
        }
    }

    draw() {
        const fpsElement = document.getElementById("fps");
        if (!fpsElement) return;
        fpsElement.textContent = `FPS: ${this.currentFps}`;
    }
}
