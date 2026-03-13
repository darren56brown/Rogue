export class ImageLibrary {
    constructor(){
        this.images = {};
    }

    load(name, path) {
        const img = new Image();
        img.src = path;

        this.images[name] = { img, loaded:false };

        img.onload = () => {
            this.images[name].loaded = true;
            console.log(`Image loaded: ${name}`);
        };

        img.onerror = () => {
            console.log(`Image failes: ${name} (will use fallback)`);
        }
    }

    get(name){
        return this.images[name]?.loaded ? this.images[name].img : null;
    }

    loadAll(){
        this.load('player-base', '../images/player-base.png');
    }
}