// Shared constants used by both client and server
// Keep in sync — this is the single source of truth for game balance

const GAME_VERSION = '3.0.0';

const WEATHER = {
    sunny: { mult: 1.2, icon: '\u2600\uFE0F', name: 'SUNNY' },
    cloudy: { mult: 1.0, icon: '\u2601\uFE0F', name: 'CLOUDY' },
    rainy: { mult: 0.6, icon: '\uD83C\uDF27\uFE0F', name: 'RAINY' },
    heatwave: { mult: 1.8, icon: '\uD83D\uDD25', name: 'HEATWAVE' }
};

const WEATHER_POOL = ['sunny', 'sunny', 'cloudy', 'rainy', 'heatwave'];

const CATASTROPHES = [
    { name: "Equipment Breakdown", minCost: 20, maxCostPercent: 0.15, repLoss: 5, message: "Equipment broke down!" },
    { name: "Health Inspection", minCost: 30, maxCostPercent: 0.20, repLoss: 8, message: "Failed health inspection!" },
    { name: "Theft", minCost: 15, maxCostPercent: 0.12, repLoss: 0, message: "Someone stole from your register!" },
    { name: "Spoiled Inventory", minCost: 0, maxCostPercent: 0, repLoss: 5, inventoryPercent: 0.20, message: "20% of inventory spoiled!" },
    { name: "Storm Damage", minCost: 40, maxCostPercent: 0.25, repLoss: 3, message: "Storm damaged property!" }
];

const UPGRADES = [
    {
        id: 'marketing',
        name: 'Marketing',
        desc: '+15% customers per level',
        tooltip: 'Increases the number of customers who visit your stand each day. More customers = more potential sales!',
        baseCost: 50,
        effect: 0.15
    },
    {
        id: 'quality',
        name: 'Quality',
        desc: '+10% effective price per level',
        tooltip: 'Improves your product quality. Customers pay MORE for the same price you set (automatic bonus revenue)!',
        baseCost: 75,
        effect: 0.10
    },
    {
        id: 'efficiency',
        name: 'Efficiency',
        desc: '-10% material costs per level',
        tooltip: 'Reduces how much you pay when buying inventory. Save money on every purchase!',
        baseCost: 60,
        effect: 0.10
    },
    {
        id: 'storage',
        name: 'Storage',
        desc: '+50 max inventory per level',
        tooltip: 'Increases your maximum inventory capacity. Hold more stock to serve more customers!',
        baseCost: 40,
        effect: 50
    },
    {
        id: 'market_research',
        name: 'Market Research',
        desc: 'Reveals avg competitor price',
        tooltip: 'Unlocks the Market Intel panel. Shows you what competitors are charging so you can price strategically!',
        baseCost: 150,
        effect: 1
    },
    {
        id: 'intel_network',
        name: 'Intel Network',
        desc: 'Shows estimated customer demand',
        tooltip: 'Reveals how many customers are likely to visit today based on weather and your reputation!',
        baseCost: 200,
        effect: 1
    },
    {
        id: 'supply_insight',
        name: 'Supply Insight',
        desc: 'Shows rival stock levels (approx)',
        tooltip: 'Reveals whether city competitors are likely to run out of stock \u2014 your opportunity to capture their customers!',
        baseCost: 250,
        effect: 1
    }
];

// Named NPC rival businesses for solo mode flavor
const NPC_RIVALS = [
    { name: "Karen's Fresh Squeeze", catchphrase: 'undercutting everyone' },
    { name: 'FreshCo Beverages', catchphrase: 'always well-stocked' },
    { name: 'The Citrus Cartel', catchphrase: 'dominating the corner' },
    { name: "Dave's Discount Stand", catchphrase: 'fighting for the price floor' }
];

// City-wide events that affect all players in a city
const CITY_EVENTS = [
    { id: 'festival', name: 'City Festival', mult: 1.5, duration: 3, message: '+50% customers for 3 days!', icon: '\uD83C\uDF89' },
    { id: 'recession', name: 'Economic Recession', mult: 0.7, duration: 5, message: '-30% customer pool for 5 days!', icon: '\uD83D\uDCC9' },
    { id: 'supply_shortage', name: 'Supply Shortage', materialMult: 2.0, duration: 2, message: 'Material costs doubled for 2 days!', icon: '\uD83D\uDEA8' },
    { id: 'health_scare', name: 'Health Scare', repLoss: 10, duration: 1, message: 'All businesses lose 10 reputation!', icon: '\u26A0\uFE0F' },
    { id: 'tourist_season', name: 'Tourist Season', mult: 1.8, priceSensitivity: 1.5, duration: 4, message: '+80% customers but they\'re pickier about price!', icon: '\uD83C\uDFD6\uFE0F' }
];

// Challenge templates for daily challenge generation
const CHALLENGE_TYPES = [
    { type: 'max_revenue', title: 'Big Earner', desc: 'Earn ${target} revenue in a single day', baseLine: 200 },
    { type: 'max_customers', title: 'Crowd Pleaser', desc: 'Serve {target} customers in one day', baseLine: 50 },
    { type: 'profit_streak', title: 'Consistency King', desc: 'Maintain a {target}-day profit streak', baseLine: 5 },
    { type: 'low_price_profit', title: 'Bargain Master', desc: 'Profit with price at or below ${target}', baseLine: 0.50 },
    { type: 'survive_catastrophe', title: 'Storm Survivor', desc: 'End profitable on a day with a catastrophe', baseLine: 0 }
];

// Validation limits for anti-cheat
const VALIDATION = {
    MAX_PRICE: 10000,
    MIN_PRICE: 0.10,
    MAX_CUSTOMERS_PER_LOCATION: 100,
    MAX_QUALITY_MULTIPLIER: 1.5,
    MAX_DAY_SUBMISSIONS_PER_MINUTE: 20,
    MIN_DAY_INTERVAL_MS: 3000
};

// City configuration
const CITY_CONFIG = {
    MIN_PLAYERS: 5,
    MAX_PLAYERS: 30,
    BASE_CUSTOMER_POOL: 100,
    CITY_EVENT_CHANCE: 0.08,  // 8% per city day
    ECONOMY_MIN: 0.7,
    ECONOMY_MAX: 1.3
};

// Achievements — unlocked by meeting conditions, grant one-time cash rewards
// Conditions use function(g) style to receive game state as parameter (safe for server-side)
const ACHIEVEMENTS = [
    {
        id: 'first_profit',
        name: 'First Dollar',
        icon: '\uD83D\uDCB0',
        desc: 'Earn your first profit day',
        condition: function(g) { return g.totalRevenue > 0 && g.streak >= 1; },
        reward: { cash: 10 }
    },
    {
        id: 'reputation_50',
        name: 'Getting Known',
        icon: '\u2B50',
        desc: 'Reach 50 reputation',
        condition: function(g) { return g.reputation >= 50; },
        reward: { cash: 25 }
    },
    {
        id: 'reputation_200',
        name: 'Local Legend',
        icon: '\uD83C\uDF1F',
        desc: 'Reach 200 reputation',
        condition: function(g) { return g.reputation >= 200; },
        reward: { cash: 100 }
    },
    {
        id: 'second_location',
        name: 'Expanding Empire',
        icon: '\uD83C\uDFE2',
        desc: 'Buy your second location',
        condition: function(g) { return g.locations && g.locations.length >= 2; },
        reward: { cash: 50 }
    },
    {
        id: 'streak_5',
        name: 'On a Roll',
        icon: '\uD83D\uDD25',
        desc: 'Achieve a 5-day profit streak',
        condition: function(g) { return g.streak >= 5; },
        reward: { cash: 30 }
    },
    {
        id: 'streak_10',
        name: 'Unstoppable',
        icon: '\uD83D\uDE80',
        desc: 'Achieve a 10-day profit streak',
        condition: function(g) { return g.streak >= 10; },
        reward: { cash: 75 }
    },
    {
        id: 'total_revenue_500',
        name: 'Half-Grand',
        icon: '\uD83D\uDCB5',
        desc: 'Earn $500 total revenue',
        condition: function(g) { return g.totalRevenue >= 500; },
        reward: { cash: 50 }
    },
    {
        id: 'level_5',
        name: 'Level Up',
        icon: '\u26A1',
        desc: 'Reach Level 5',
        condition: function(g) { return g.level >= 5; },
        reward: { cash: 100 }
    }
];

// Make available globally (client) or via module.exports (server)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_VERSION, WEATHER, WEATHER_POOL, CATASTROPHES, UPGRADES,
        CITY_EVENTS, CHALLENGE_TYPES, VALIDATION, CITY_CONFIG, NPC_RIVALS, ACHIEVEMENTS
    };
}
