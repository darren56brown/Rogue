export class ImageLibrary {
    constructor() {
        this.images = {};
        this.pending = 0;
        this.resolve_func = null;
    }

    loadImage(name, path) {
        this.pending++;
        const img = new Image();
        this.images[name] = { img: img, loaded: false };

        img.onload = () => {
            this.images[name].loaded = true;
            this.pending--;
            this._checkAllLoaded();
        };

        img.onerror = () => {
            console.warn(`Image failed: ${name}`);
            this.pending--;
            this._checkAllLoaded();
        };

        img.src = path;
    }

    _checkAllLoaded() {
        if (this.pending == 0) {
            const temp_resolve = this.resolve_func;
            this.resolve_func = null; 
            temp_resolve(); 
        }
    }

    get(name) {
        const entry = this.images[name];
        return entry?.loaded ? entry.img : null;
    }

    loadAll() {
        return new Promise((resolve_func) => {
            this.resolve_func = resolve_func;

            this.loadImage('player_base', '../images/player_base.png');
            this.loadImage('orc_base', '../images/orc_base.png');
            this.loadImage('player_shadow', '../images/player_shadow.png');
            this.loadImage('iso_tiles', '../maps/tilesets/iso_tiles.png');
            this.loadImage('paper_doll', '../images/paper_doll.png');

            this._checkAllLoaded();
        });
    }
}
