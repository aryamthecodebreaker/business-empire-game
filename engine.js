// Core game logic — day processing, catastrophes, level-ups, pricing

function getRandomWeather() {
    return WEATHER_POOL[Math.floor(Math.random() * WEATHER_POOL.length)];
}

function shouldTriggerCatastrophe() {
    const days = game.day - game.lastCatastropheDay;
    if (days >= 15) return true;
    if (days >= 13) return Math.random() < 0.75;
    if (days >= 10) return Math.random() < 0.5;
    return Math.random() < 0.03;
}

function triggerCatastrophe() {
    const c = CATASTROPHES[Math.floor(Math.random() * CATASTROPHES.length)];
    let cashLoss = 0, invLoss = 0;

    if (c.maxCostPercent > 0) {
        const maxLoss = Math.min(game.cash * c.maxCostPercent, game.cash * 0.45);
        cashLoss = Math.max(c.minCost, Math.floor(Math.random() * maxLoss));
        cashLoss = Math.min(cashLoss, game.cash * 0.45);
    }

    if (c.inventoryPercent) invLoss = Math.floor(game.inventory * c.inventoryPercent);

    game.cash = Math.max(0, game.cash - cashLoss);
    game.inventory = Math.max(0, game.inventory - invLoss);
    game.reputation = Math.max(0, game.reputation - c.repLoss);
    game.lastCatastropheDay = game.day;

    addLog('CATASTROPHE', '\uD83D\uDCA5 ' + c.name + '! ' + c.message);
    let impacts = [];
    if (cashLoss > 0) impacts.push('-$' + cashLoss.toFixed(2));
    if (invLoss > 0) impacts.push('-' + invLoss + ' units');
    if (c.repLoss > 0) impacts.push('-' + c.repLoss + ' rep');
    if (impacts.length > 0) addLog('CATASTROPHE', impacts.join(', '));

    return { name: c.name, message: c.message, cashLoss, invLoss, repLoss: c.repLoss };
}

function calculateTotalRent() {
    if (!game.locations || !Array.isArray(game.locations)) {
        game.locations = [{ id: 1, name: "Main Stand", purchasePrice: 0, rentPerDay: 0, dayPurchased: 0 }];
        return 0;
    }
    return game.locations.reduce((sum, loc) => sum + (loc.rentPerDay || 0), 0);
}

function getNextLocationPrice() {
    const basedOnCash = Math.min(game.cash * 3.5, 999999);
    const locationCount = game.locations.length;
    const basePrice = 2500;
    const priceIncrease = basePrice * Math.pow(1.5 + (Math.random() * 0.5), locationCount - 1);
    return Math.max(basePrice, Math.min(basedOnCash, priceIncrease));
}

function calculatePriceFactors() {
    const materialCost = game.marketPrices.materials;
    const minFairPrice = materialCost * 1.3;
    const idealPrice = materialCost * 3;
    const maxReasonablePrice = Math.max(3, (game.reputation / 8) + idealPrice);
    const tooExpensivePrice = maxReasonablePrice * 2;
    return { materialCost, minFairPrice, idealPrice, maxReasonablePrice, tooExpensivePrice };
}

function calculatePriceImpact() {
    const { minFairPrice, idealPrice, maxReasonablePrice, tooExpensivePrice } = calculatePriceFactors();

    let priceImpact = 1.0;
    let priceReason = '';

    if (game.price < minFairPrice) {
        priceImpact = 0.5;
        priceReason = '\u26A0\uFE0F Your price ($' + game.price.toFixed(2) + ') is too low! Customers think it\'s poor quality. Min recommended: $' + minFairPrice.toFixed(2);
    } else if (game.price > tooExpensivePrice) {
        priceImpact = 0;
        priceReason = '\uD83D\uDEAB Your price ($' + game.price.toFixed(2) + ') is WAY TOO HIGH! Almost no customers at this price. Max reasonable: $' + maxReasonablePrice.toFixed(2);
    } else if (game.price > maxReasonablePrice) {
        const excessPercent = (game.price - maxReasonablePrice) / maxReasonablePrice;
        priceImpact = Math.max(0.1, 1.0 - excessPercent);
        priceReason = '\u26A0\uFE0F Your price ($' + game.price.toFixed(2) + ') is too high for your reputation (' + game.reputation + '). Recommended max: $' + maxReasonablePrice.toFixed(2);
    } else if (game.price > idealPrice * 1.5) {
        priceImpact = 0.7;
        priceReason = '\uD83D\uDCCA Your price ($' + game.price.toFixed(2) + ') is on the high side. Some customers are deterred.';
    } else if (game.price >= minFairPrice && game.price <= idealPrice * 1.3) {
        priceImpact = 1.0;
        priceReason = '\u2705 Your price ($' + game.price.toFixed(2) + ') is in the sweet spot!';
    }

    return { priceImpact, priceReason, maxReasonablePrice };
}

async function processDay() {
    let catastrophe = null, catastropheCost = 0;

    if (shouldTriggerCatastrophe()) {
        catastrophe = triggerCatastrophe();
        catastropheCost = catastrophe.cashLoss;
        showNotif('\uD83D\uDCA5 ' + catastrophe.name + '!', 'error');
    }

    let customers;
    let cityData = null;
    const { priceImpact, priceReason, maxReasonablePrice } = calculatePriceImpact();

    if (typeof mpState !== 'undefined' && mpState.mode === 'city' && mpState.connected) {
        // MULTIPLAYER: Submit to server, get customer allocation from city economy
        try {
            cityData = await api.submitCityDay(mpState.cityId, {
                playerId: mpState.playerId,
                price: game.price,
                inventory: game.inventory,
                reputation: game.reputation,
                upgrades: game.upgrades,
                locations: game.locations
            });

            customers = cityData.customerPoolShare;
            game.weather = cityData.cityWeather || game.weather;

            // Update city state
            if (cityData.cityAvgPrice) mpState.cityAvgPrice = cityData.cityAvgPrice;
            if (cityData.competitorPrices) mpState.competitorPrices = cityData.competitorPrices;
            if (cityData.cityRank) mpState.cityRank = cityData.cityRank;
        } catch (err) {
            console.warn('City sync failed, falling back to solo calculation:', err);
            customers = calculateLocalCustomers(priceImpact);
        }
    } else {
        // SOLO: Original local calculation
        customers = calculateLocalCustomers(priceImpact);
    }

    const served = Math.min(customers, game.inventory);
    const effectivePrice = game.price * (1 + (game.upgrades.quality || 0) * 0.10);
    const revenue = served * effectivePrice;

    const rentCost = calculateTotalRent();
    const utilitiesCost = game.marketPrices.utilities;
    const totalExpenses = rentCost + utilitiesCost;
    const profit = revenue - totalExpenses;

    game.cash += profit;
    game.inventory -= served;
    game.totalRevenue += revenue;
    game.totalCustomers += served;
    game.xp += Math.floor(served * 2 + (profit > 0 ? 10 : 0));

    let repChange = profit > 0 ? 1 : -2;
    if (game.reputation < 25 && profit > 0) {
        repChange += 3;
        if (game.day <= 5) addLog('ANALYSIS', '\uD83C\uDF1F NEW BUSINESS BONUS!');
    }
    if (served < customers) {
        repChange -= 5;
        addLog('ANALYSIS', '\u274C STOCKOUT: Lost ' + (customers - served) + ' customers! (-5 rep)');
    }
    if (served > game.bestDay) {
        game.bestDay = served;
        repChange += 3;
        addLog('ANALYSIS', '\u2728 NEW RECORD: ' + served + ' customers! (+3 rep)');
    }

    game.reputation = Math.max(0, game.reputation + repChange);
    game.streak = profit > 0 ? game.streak + 1 : 0;

    // Log price impact if significant
    const customersBeforePricing = customers; // approximate
    if (priceImpact < 0.95) {
        addLog('ANALYSIS', priceReason);
        if (customers === 0) {
            addLog('ERROR', '\uD83D\uDC94 ZERO CUSTOMERS due to pricing!');
        }
    }

    let reason = buildDayReason(customers, priceImpact, maxReasonablePrice);
    addLog('ANALYSIS', '\uD83D\uDCA1 ' + reason);

    // Fluctuate market prices for next day
    game.marketPrices.materials = Math.max(0.15, Math.min(0.50, game.marketPrices.materials + (Math.random() * 0.1 - 0.05)));
    game.marketPrices.utilities = game.day > 5 ? 5 : 0;

    showReport(customers, served, revenue, totalExpenses, profit, reason, catastrophe, {
        rent: rentCost,
        utilities: utilitiesCost,
        catastrophe: catastropheCost
    });

    checkLevelUp();
    if (game.cash < 0) game.cash = 0;
    game.day++;
    updateUI();
    // End-of-day auto-restock (after sales, before next day)
    if (typeof doAutoBuy === 'function') doAutoBuy();
    checkDayTip();
    saveGame();

    // Submit day result for leaderboard
    if (typeof mpState !== 'undefined' && mpState.connected && typeof api !== 'undefined' && typeof api.submitDayResult === 'function') {
        api.submitDayResult({
            day: game.day - 1,
            customers: served,
            revenue: revenue,
            profit: profit,
            price: game.price,
            weather: game.weather,
            catastrophe: catastrophe ? catastrophe.name : null
        }).then(result => {
            if (result && result.rank) {
                showNotif('Ranked #' + result.rank + ' today!', 'success');
                if (result.rankChange && result.rankChange > 0) {
                    showFloatingText('\u2B06 UP ' + result.rankChange + ' ranks!', window.innerWidth / 2, 100, '#0f0');
                }
            }
        }).catch(() => {});
    }
}

function calculateLocalCustomers(priceImpact) {
    const base = Math.floor((5 + Math.random() * 15) * WEATHER[game.weather].mult);
    const repMult = 1.0 + (game.reputation / 50);
    let customers = Math.floor(base * repMult);
    customers = Math.floor(customers * (1 + (game.upgrades.marketing || 0) * 0.15));
    customers = Math.floor(customers * (1 + (game.locations.length - 1) * 0.3));
    customers = Math.floor(customers * priceImpact);
    return customers;
}

function buildDayReason(customers, priceImpact, maxReasonablePrice) {
    const rival = typeof NPC_RIVALS !== 'undefined' ? NPC_RIVALS[Math.floor(Math.random() * NPC_RIVALS.length)] : null;
    if (customers === 0) {
        if (priceImpact < 0.1) {
            return 'NO CUSTOMERS! Your price ($' + game.price.toFixed(2) + ') is far too high. Recommended: $' + maxReasonablePrice.toFixed(2);
        } else if (game.weather === 'rainy') {
            return 'NO CUSTOMERS due to terrible weather.';
        } else {
            return 'NO CUSTOMERS. Low reputation (' + game.reputation + ') and poor conditions.';
        }
    } else if (customers < 3) {
        if (priceImpact < 0.5) {
            return 'Very few customers (' + customers + ') \u2014 price too high.' + (rival ? ' ' + rival.name + ' is ' + rival.catchphrase + ' nearby.' : '');
        } else {
            return 'Low traffic.' + (rival ? ' ' + rival.name + ' is ' + rival.catchphrase + ' nearby.' : ' Reputation (' + game.reputation + ') needs work.');
        }
    } else if (customers > 15) {
        return WEATHER[game.weather].mult > 1.5 ? 'Excellent weather brought crowds!' : 'Great reputation (' + game.reputation + ') attracting customers!';
    } else {
        return 'Steady customer flow. ' + (priceImpact < 0.95 ? 'Price is limiting some customers.' : 'Keep growing!');
    }
}

function checkLevelUp() {
    if (game.xp >= game.xpToNext) {
        game.level++;
        const overflow = game.xp - game.xpToNext;
        game.xp = overflow;
        game.xpToNext = Math.floor(game.xpToNext * 1.5);
        game.maxInventory += 20;
        const repBonus = game.level * 2;
        game.reputation += repBonus;
        showNotif('\u26A1 LEVEL ' + game.level + '!', 'success');
        addLog('SYSTEM', '\u25B2 LEVEL ' + game.level + '! +' + repBonus + ' rep, +20 inventory');
    }
}
