// Game state management — save/load with localStorage + server sync

let game = {
    day: 1,
    cash: 5,
    inventory: 10,
    price: 1.0,
    businessName: "LEMONADE STAND",
    totalRevenue: 0,
    totalCustomers: 0,
    reputation: 0,
    level: 1,
    xp: 0,
    xpToNext: 100,
    maxInventory: 50,
    streak: 0,
    bestDay: 0,
    weather: 'sunny',
    marketPrices: {
        materials: 0.20,
        utilities: 0
    },
    upgrades: {
        marketing: 0,
        quality: 0,
        efficiency: 0,
        storage: 0
    },
    locations: [
        { id: 1, name: "Main Stand", purchasePrice: 0, rentPerDay: 0, dayPurchased: 0 }
    ],
    lastCatastropheDay: -20,
    autoBuy: false,
    nextLocationPrice: 2500, // Stable pre-computed next location price (no randomness)
    achievements: {}          // Unlocked achievement IDs: { 'first_profit': true, ... }
};

let logs = [];
let resetStep = 0;

// Debounce timer for server sync
let _serverSyncTimer = null;

function saveGame() {
    try {
        localStorage.setItem('businessEmpire', JSON.stringify(game));
        localStorage.setItem('businessLogs', JSON.stringify(logs.slice(-50)));
    } catch (e) {
        console.error('Save failed:', e);
    }

    // If multiplayer is active, also push to server (debounced)
    if (typeof mpState !== 'undefined' && mpState.connected && mpState.playerId) {
        clearTimeout(_serverSyncTimer);
        _serverSyncTimer = setTimeout(() => {
            if (typeof api !== 'undefined' && typeof api.syncGameState === 'function') {
                api.syncGameState(game);
            }
        }, 2000);
    }
}

function loadGame() {
    try {
        const saved = localStorage.getItem('businessEmpire');
        const savedLogs = localStorage.getItem('businessLogs');

        if (saved) {
            const loaded = JSON.parse(saved);

            if (!loaded.locations || !Array.isArray(loaded.locations) || loaded.locations.length === 0) {
                loaded.locations = [{ id: 1, name: "Main Stand", purchasePrice: 0, rentPerDay: 0, dayPurchased: 0 }];
            }

            if (!loaded.upgrades) {
                loaded.upgrades = { marketing: 0, quality: 0, efficiency: 0, storage: 0 };
            }

            game = {
                ...game,
                ...loaded,
                locations: loaded.locations,
                upgrades: loaded.upgrades,
                lastCatastropheDay: loaded.lastCatastropheDay !== undefined ? loaded.lastCatastropheDay : -20
            };

            // Ensure stable next location price is computed for saves that lack it
            if (!game.nextLocationPrice && typeof computeNextLocationPrice === 'function') {
                game.nextLocationPrice = computeNextLocationPrice();
            }

            // Bootstrap achievements for existing saves: silently mark already-met ones
            // as unlocked WITHOUT granting cash rewards (prevents free money on first load)
            if (!loaded.achievements && typeof ACHIEVEMENTS !== 'undefined') {
                game.achievements = {};
                ACHIEVEMENTS.forEach(function(ach) {
                    try { if (ach.condition(game)) game.achievements[ach.id] = true; }
                    catch (e) {}
                });
            }

            showNotif('💾 Game loaded!', 'success');
        }

        if (savedLogs) logs = JSON.parse(savedLogs);
    } catch (e) {
        console.error('Load failed:', e);
        game.locations = [{ id: 1, name: "Main Stand", purchasePrice: 0, rentPerDay: 0, dayPurchased: 0 }];
        game.upgrades = { marketing: 0, quality: 0, efficiency: 0, storage: 0 };
    }
}

function getDefaultGameState() {
    return {
        day: 1,
        cash: 5,
        inventory: 10,
        price: 1.0,
        businessName: "LEMONADE STAND",
        totalRevenue: 0,
        totalCustomers: 0,
        reputation: 0,
        level: 1,
        xp: 0,
        xpToNext: 100,
        maxInventory: 50,
        streak: 0,
        bestDay: 0,
        weather: 'sunny',
        marketPrices: { materials: 0.20, utilities: 0 },
        upgrades: { marketing: 0, quality: 0, efficiency: 0, storage: 0 },
        locations: [{ id: 1, name: "Main Stand", purchasePrice: 0, rentPerDay: 0, dayPurchased: 0 }],
        lastCatastropheDay: -20,
        autoBuy: false,
        nextLocationPrice: 2500,
        achievements: {}
    };
}
