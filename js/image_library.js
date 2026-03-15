export class ImageLibrary {
    constructor(){
        this.images = {};
        this.pending = 0;
        this.allLoadedCallback = null;
    }

    load(name, path) {
        this.pending++;
        const img = new Image();
        img.src = path;

        this.images[name] = { img, loaded: false };

        img.onload = () => {
            this.images[name].loaded = true;
            //console.log(`Image loaded: ${name}`);
            this.pending--;
            this._checkAllLoaded();
        };

        img.onerror = () => {
            console.log(`Image failed: ${name} (will use fallback)`);
            this.pending--;
            this._checkAllLoaded();
        };
    }

    _checkAllLoaded() {
        if (this.pending === 0 && this.allLoadedCallback) {
            this.allLoadedCallback();
            this.allLoadedCallback = null; // one-shot
        }
    }

    get(name){
        const entry = this.images[name];
        return entry?.loaded ? entry.img : null;
    }

    loadAll(){
        this.load('player_base',    '../images/player_base.png');
        this.load('player_shadow',  '../images/player_shadow.png');
        this.load('dirt_to_water',  '../tilesets/dirt_to_water.png');
        this.load('grass_to_dirt',  '../tilesets/grass_to_dirt.png');
        this.load('water',          '../tilesets/water.png');
    }

    onAllLoaded(callback) {
        if (this.pending === 0) {
            callback();
        } else {
            this.allLoadedCallback = callback;
        }
    }
}