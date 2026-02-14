// Player actions — buying stock, locations, upgrades, starting days

function buyStock(amt) {
    const cost = amt * game.marketPrices.materials;
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

    addLog('PLAYER', '\uD83D\uDCE6 Bought ' + amt + ' units for $' + cost.toFixed(2));
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

    addLog('BUSINESS', '\uD83C\uDFE2 BOUGHT Location #' + locationNum + ' for $' + price.toFixed(0));
    addLog('BUSINESS', '\uD83D\uDCCD Rent: $' + rentPerDay.toFixed(0) + '/day (+10 rep, +20 storage)');
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

    game.cash -= cost;
    game.upgrades[upgradeId] = currentLevel + 1;

    if (upgradeId === 'storage') {
        game.maxInventory += 50;
    }

    showFloatingText('\u2B06 UPGRADE!', window.innerWidth / 2, window.innerHeight / 2, '#ff0');
    showFloatingText('-$' + cost, window.innerWidth / 2, window.innerHeight / 2 + 40, '#f00');

    addLog('UPGRADE', '\u26A1 ' + upg.name + ' upgraded to level ' + (currentLevel + 1) + '!');
    showNotif(upg.name + ' upgraded!', 'success');

    updateUI();
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
    addLog('PLAYER', '\uD83D\uDCB0 Price changed to $' + game.price.toFixed(2));
    updateUI();
}

function toggleAutoBuy() {
    const toggle = document.getElementById('autoBuyToggle');
    const settings = document.getElementById('autoBuySettings');

    if (toggle.checked) {
        settings.classList.remove('hidden');
        game.autoBuy = true;
        showNotif('\uD83E\uDD16 Auto-buy enabled!', 'success');
        addLog('SYSTEM', '\uD83E\uDD16 Auto-buy inventory: ON');
    } else {
        settings.classList.add('hidden');
        game.autoBuy = false;
        showNotif('Auto-buy disabled', 'warning');
        addLog('SYSTEM', '\uD83E\uDD16 Auto-buy inventory: OFF');
    }
    saveGame();
}

function doAutoBuy() {
    if (!game.autoBuy) return;

    const threshold = parseInt(document.getElementById('autoBuyThreshold').value) || 20;
    const targetPercent = parseInt(document.getElementById('autoBuyTarget').value) || 80;
    const targetAmount = Math.floor(game.maxInventory * (targetPercent / 100));

    if (game.inventory < threshold) {
        const toBuy = Math.max(0, targetAmount - game.inventory);
        if (toBuy > 0) {
            const cost = toBuy * game.marketPrices.materials * (1 - (game.upgrades.efficiency || 0) * 0.10);

            if (game.cash >= cost && game.inventory + toBuy <= game.maxInventory) {
                game.cash -= cost;
                game.inventory += toBuy;
                addLog('SYSTEM', '\uD83E\uDD16 AUTO-BUY: Purchased ' + toBuy + ' units for $' + cost.toFixed(2));
                showNotif('\uD83E\uDD16 Auto-bought ' + toBuy + ' units', 'success');
            } else if (game.cash < cost) {
                addLog('WARNING', '\uD83E\uDD16 AUTO-BUY: Not enough cash (need $' + cost.toFixed(2) + ')');
            }
        }
    }
}

function startDay() {
    if (game.inventory === 0) {
        addLog('ERROR', '\u26A0 No inventory!');
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

    setTimeout(function() { processDay(); }, 1000);
}

function nextDay() {
    document.getElementById('reportPanel').classList.add('hidden');
    document.getElementById('setupPanel').classList.remove('hidden');
    document.getElementById('startBtn').disabled = false;
    document.getElementById('playerAction').value = '';
    addLog('SYSTEM', '\u2550\u2550\u2550 DAY ' + game.day + ' BEGINS \u2550\u2550\u2550');
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
    addLog('PLAYER', '\u270F\uFE0F Business renamed to: ' + game.businessName);
    showNotif('Renamed to: ' + game.businessName, 'success');
    updateUI();
};

function togglePlan() {
    const section = document.getElementById('planSection');
    const btn = document.getElementById('togglePlanBtn');
    section.classList.toggle('hidden');
    btn.textContent = section.classList.contains('hidden') ? '\uD83D\uDCDD Strategy' : '\uD83D\uDCDD Hide';
}

function showTutorial() {
    document.getElementById('welcomeModal').classList.remove('hidden');
}

function closeWelcome() {
    document.getElementById('welcomeModal').classList.add('hidden');
    localStorage.setItem('hasPlayedBefore', 'true');
    showNotif('Good luck! \uD83C\uDF40', 'success');
}

function showExpansionPanel() {
    document.getElementById('expansionPanel').classList.toggle('hidden');
    if (!document.getElementById('expansionPanel').classList.contains('hidden')) {
        updateLocationsList();
    }
}

function showUpgradesModal() {
    switchTab('upgrades');
}

function closeUpgradesModal() {
    switchTab('dashboard');
}

function toggleLog() {
    switchTab('log');
}

function toggleMarket() {
    switchTab('business');
}

function resetGame() {
    if (resetStep === 0) {
        resetStep = 1;
        document.getElementById('resetBtn').textContent = '\uD83D\uDD04 CLICK AGAIN!';
        document.getElementById('resetBtn').style.animation = 'pulse 0.5s infinite';
        showNotif('\u26A0\uFE0F Click again!', 'warning');
        setTimeout(function() {
            resetStep = 0;
            document.getElementById('resetBtn').textContent = '\uD83D\uDD04 RESET';
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
        document.getElementById('resetBtn').textContent = '\uD83D\uDD04 RESET';
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
