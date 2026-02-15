// Player actions — buying stock, locations, upgrades, starting days

function buyStock(amt) {
    const cost = amt * game.marketPrices.materials * (1 - (game.upgrades.efficiency || 0) * 0.10);
    if (game.cash < cost) {
        showNotif('Not enough cash!', 'error');
        shakeButton('buy' + amt);
        return;
    }
    if (game.inventory + amt > game.maxInventory) {
        showNotif('Storage full!', 'error');
        shakeButton('buy' + amt);
        return;
    }
    game.cash -= cost;
    game.inventory += amt;

    const btn = document.getElementById('buy' + amt);
    if (btn) {
        const rect = btn.getBoundingClientRect();
        showFloatingText('-$' + cost.toFixed(2), rect.left + rect.width / 2, rect.top, '#f00');
        showFloatingText('+' + amt + ' units', rect.left + rect.width / 2, rect.top + 30, '#0ff');
    }

    addLog('PLAYER', '📦 Bought ' + amt + ' units for $' + cost.toFixed(2));
    updateUI();
}

function buyLocation() {
    const price = getNextLocationPrice();

    if (game.cash < price) {
        showNotif('Need $' + price.toFixed(0) + '!', 'error');
        return;
    }

    const locationNum = game.locations.length + 1;
    const rentPerDay = Math.floor(price * 0.10);

    game.locations.push({
        id: locationNum,
        name: 'Location #' + locationNum,
        purchasePrice: price,
        rentPerDay: rentPerDay,
        dayPurchased: game.day
    });

    game.cash -= price;
    game.reputation += 10;
    game.maxInventory += 20;

    // Pre-compute stable next location price so display doesn't flicker
    if (typeof computeNextLocationPrice === 'function') {
        game.nextLocationPrice = computeNextLocationPrice();
    }

    addLog('BUSINESS', '🏢 BOUGHT Location #' + locationNum + ' for $' + price.toFixed(0));
    addLog('BUSINESS', '📍 Rent: $' + rentPerDay.toFixed(0) + '/day (+10 rep, +20 storage)');
    showNotif('Location #' + locationNum + ' purchased!', 'success');

    updateUI();
    updateLocationsList();
}

function buyUpgrade(upgradeId) {
    const upg = UPGRADES.find(function(u) { return u.id === upgradeId; });
    const currentLevel = game.upgrades[upgradeId] || 0;
    const cost = Math.floor(upg.baseCost * Math.pow(1.5, currentLevel));

    if (game.cash < cost) {
        showNotif('Not enough cash!', 'error');
        return;
    }

    // Soft-lock warning: check if remaining cash covers at least 10 units of inventory
    const cashAfter = game.cash - cost;
    const minRestockCost = 10 * game.marketPrices.materials;
    if (cashAfter < minRestockCost) {
        window._pendingUpgrade = upgradeId;
        const warnCost = document.getElementById('upgradeWarnCost');
        const warnAfter = document.getElementById('upgradeWarnCashAfter');
        const warnMin = document.getElementById('upgradeWarnMinStock');
        if (warnCost) warnCost.textContent = cost.toFixed(2);
        if (warnAfter) warnAfter.textContent = cashAfter.toFixed(2);
        if (warnMin) warnMin.textContent = minRestockCost.toFixed(2);
        const modal = document.getElementById('upgradeWarnModal');
        if (modal) { modal.classList.remove('hidden'); return; }
        // Fallback if modal not in HTML: proceed anyway
    }

    _executeUpgrade(upgradeId);
}

// Returns human-readable description of what an upgrade does at a given new level
function _describeUpgradeEffect(upgradeId, newLevel) {
    switch (upgradeId) {
        case 'marketing':
            return 'Customers +' + (newLevel * 15) + '% total (was +' + ((newLevel - 1) * 15) + '%)';
        case 'quality':
            return 'Effective sell price now $' + (game.price * (1 + newLevel * 0.10)).toFixed(2) + ' (quality bonus +' + (newLevel * 10) + '%)';
        case 'efficiency':
            return 'Material cost reduced by ' + (newLevel * 10) + '% (save $' + (game.marketPrices.materials * newLevel * 0.10).toFixed(3) + '/unit)';
        case 'storage':
            return 'Max inventory now ' + game.maxInventory + ' units';
        case 'market_research':
        case 'intel_network':
        case 'supply_insight':
            return 'Market Intel panel unlocked — check the dashboard!';
        default:
            return 'Effect applied.';
    }
}

function _executeUpgrade(upgradeId) {
    const upg = UPGRADES.find(function(u) { return u.id === upgradeId; });
    const currentLevel = game.upgrades[upgradeId] || 0;
    const cost = Math.floor(upg.baseCost * Math.pow(1.5, currentLevel));

    game.cash -= cost;
    game.upgrades[upgradeId] = currentLevel + 1;

    if (upgradeId === 'storage') {
        game.maxInventory += 50;
    }

    showFloatingText('⬆ UPGRADE!', window.innerWidth / 2, window.innerHeight / 2, '#ff0');
    showFloatingText('-$' + cost, window.innerWidth / 2, window.innerHeight / 2 + 40, '#f00');

    const effectDesc = _describeUpgradeEffect(upgradeId, currentLevel + 1);
    addLog('UPGRADE', '⚡ ' + upg.name + ' upgraded to level ' + (currentLevel + 1) + '!');
    addLog('UPGRADE', '→ ' + effectDesc);
    showNotif(upg.name + ' Lv' + (currentLevel + 1) + ': ' + effectDesc, 'success');

    updateUI();
}

function confirmUpgrade() {
    const modal = document.getElementById('upgradeWarnModal');
    if (modal) modal.classList.add('hidden');
    if (window._pendingUpgrade) {
        _executeUpgrade(window._pendingUpgrade);
        window._pendingUpgrade = null;
    }
}

function cancelUpgrade() {
    const modal = document.getElementById('upgradeWarnModal');
    if (modal) modal.classList.add('hidden');
    window._pendingUpgrade = null;
    showNotif('Upgrade cancelled', 'warning');
}

function buyUpgradeFromTab(upgradeId) {
    buyUpgrade(upgradeId);
    updateUpgradesTab();
}

function updatePrice() {
    const input = document.getElementById('priceInput');
    let newPrice = parseFloat(input.value);

    if (isNaN(newPrice) || newPrice < 0.10) {
        newPrice = 0.10;
        input.value = '0.10';
    }
    if (newPrice > 10000) {
        newPrice = 10000;
        input.value = '10000';
    }

    game.price = newPrice;
    addLog('PLAYER', '💰 Price changed to $' + game.price.toFixed(2));
    updateUI();
}

function toggleAutoBuy() {
    const toggle = document.getElementById('autoBuyToggle');
    const settings = document.getElementById('autoBuySettings');

    if (toggle.checked) {
        settings.classList.remove('hidden');
        game.autoBuy = true;
        showNotif('🤖 Auto-buy enabled!', 'success');
        addLog('SYSTEM', '🤖 Auto-buy inventory: ON');
    } else {
        settings.classList.add('hidden');
        game.autoBuy = false;
        showNotif('Auto-buy disabled', 'warning');
        addLog('SYSTEM', '🤖 Auto-buy inventory: OFF');
    }
    saveGame();
}

function doAutoBuy() {
    if (!game.autoBuy) return;

    const thresholdEl = document.getElementById('autoBuyThreshold');
    const threshold = thresholdEl ? (parseInt(thresholdEl.value) || 20) : 20;
    const targetEl = document.getElementById('autoBuyTarget');
    const targetPercent = targetEl ? (parseInt(targetEl.value) || 80) : 80;
    const targetAmount = Math.floor(game.maxInventory * (targetPercent / 100));

    if (game.inventory < threshold) {
        const toBuy = Math.max(0, targetAmount - game.inventory);
        if (toBuy > 0) {
            const unitCost = game.marketPrices.materials * (1 - (game.upgrades.efficiency || 0) * 0.10);
            // Buy as much as affordable, not all-or-nothing
            const maxAffordable = Math.floor(game.cash / unitCost);
            const maxStorage = game.maxInventory - game.inventory;
            const actualBuy = Math.min(toBuy, maxAffordable, maxStorage);

            if (actualBuy > 0) {
                const cost = actualBuy * unitCost;
                game.cash -= cost;
                game.inventory += actualBuy;
                const partial = actualBuy < toBuy ? ' [partial — low cash]' : '';
                addLog('SYSTEM', '🤖 AUTO-BUY: +' + actualBuy + ' units ($' + cost.toFixed(2) + ')' + partial);
                showNotif('🤖 Auto-bought ' + actualBuy + ' units', 'success');
            } else {
                addLog('WARNING', '🤖 AUTO-BUY: Not enough cash to restock (have $' + game.cash.toFixed(2) + ')');
            }
        }
    }
}

function startDay() {
    if (game.inventory === 0) {
        addLog('ERROR', '⚠ No inventory!');
        showNotif('No inventory!', 'error');
        return;
    }

    doAutoBuy();

    document.getElementById('setupPanel').classList.add('hidden');
    document.getElementById('startBtn').disabled = true;

    // Use city weather if in multiplayer city mode, otherwise random
    if (typeof mpState !== 'undefined' && mpState.mode === 'city' && mpState.cityWeather) {
        game.weather = mpState.cityWeather;
    } else {
        game.weather = getRandomWeather();
    }
    addLog('SYSTEM', WEATHER[game.weather].icon + ' Weather: ' + WEATHER[game.weather].name);

    const action = document.getElementById('playerAction').value.trim();
    if (action) addLog('PLAYER', 'Day ' + game.day + ': ' + action);

    setTimeout(async function() { await processDay(); }, 1000);
}

function nextDay() {
    document.getElementById('reportPanel').classList.add('hidden');
    document.getElementById('setupPanel').classList.remove('hidden');
    document.getElementById('startBtn').disabled = false;
    document.getElementById('playerAction').value = '';
    addLog('SYSTEM', '══ DAY ' + game.day + ' BEGINS ══');
    updateUI();
}

window.editName = function() {
    const currentName = game.businessName;
    const newName = prompt(
        'Enter new business name:\n\n' +
        'Current: ' + currentName + '\n' +
        'Maximum 30 characters',
        currentName
    );

    if (newName === null || newName.trim() === '') return;

    const trimmed = newName.trim();

    if (trimmed.length > 30) {
        alert('Name too long! Maximum 30 characters.');
        return;
    }

    if (trimmed.length < 1) {
        alert('Name cannot be empty!');
        return;
    }

    game.businessName = trimmed.toUpperCase();
    addLog('PLAYER', '✏️ Business renamed to: ' + game.businessName);
    showNotif('Renamed to: ' + game.businessName, 'success');
    updateUI();
};

function togglePlan() {
    const section = document.getElementById('planSection');
    const btn = document.getElementById('togglePlanBtn');
    section.classList.toggle('hidden');
    btn.textContent = section.classList.contains('hidden') ? '📝 Strategy' : '📝 Hide';
}

function showTutorial() {
    document.getElementById('welcomeModal').classList.remove('hidden');
}

function closeWelcome() {
    document.getElementById('welcomeModal').classList.add('hidden');
    localStorage.setItem('hasPlayedBefore', 'true');
    showNotif('Good luck! 🍀', 'success');
}

function showExpansionPanel() {
    document.getElementById('expansionPanel').classList.toggle('hidden');
    if (!document.getElementById('expansionPanel').classList.contains('hidden')) {
        updateLocationsList();
    }
}

function showUpgradesModal() { switchTab('upgrades'); }
function closeUpgradesModal() { switchTab('dashboard'); }
function toggleLog() { switchTab('log'); }
function toggleMarket() { switchTab('business'); }

function resetGame() {
    if (resetStep === 0) {
        resetStep = 1;
        document.getElementById('resetBtn').textContent = '🔄 CLICK AGAIN!';
        document.getElementById('resetBtn').style.animation = 'pulse 0.5s infinite';
        showNotif('⚠️ Click again!', 'warning');
        setTimeout(function() {
            resetStep = 0;
            document.getElementById('resetBtn').textContent = '🔄 RESET';
            document.getElementById('resetBtn').style.animation = '';
        }, 5000);
    } else {
        document.getElementById('resetDay').textContent = game.day;
        document.getElementById('resetCash').textContent = game.cash.toFixed(2);
        document.getElementById('resetLevel').textContent = game.level;
        document.getElementById('resetRep').textContent = game.reputation;
        document.getElementById('resetLocs').textContent = game.locations.length;
        document.getElementById('resetModal').classList.remove('hidden');
        resetStep = 0;
        document.getElementById('resetBtn').textContent = '🔄 RESET';
        document.getElementById('resetBtn').style.animation = '';
    }
}

function closeResetModal() {
    document.getElementById('resetModal').classList.add('hidden');
}

function confirmReset() {
    localStorage.clear();
    location.reload();
}
