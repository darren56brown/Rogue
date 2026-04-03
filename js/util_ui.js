
const templates = {
    'sprite_viewer':  'templates/sprite_viewer.html',
    'conversation':   'templates/conversation.html',
    'inventory':   'templates/inventory.html'
};

export async function loadAllUITemplates() {
    const parent_container = document.getElementById('mainContainer');
    if (!parent_container) {
        console.error("parent_container not found in DOM");
        return;
    }

    const promises = Object.entries(templates).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to load ${path}`);
            
            const html = await response.text();
            parent_container.insertAdjacentHTML('beforeend', html);
            //console.log(`✅ Loaded UI template: ${key}`);
        } catch (err) {
            console.error(`❌ Failed to load template ${key}:`, err);
        }
    });

    await Promise.all(promises);
}
