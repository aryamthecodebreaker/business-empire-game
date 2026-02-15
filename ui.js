// UI updates — DOM manipulation, log rendering, report display

function updateUI() {
    const nameEl = document.getElementById('businessName');
    nameEl.textContent = '\u2588\u2593\u2592\u2591 ' + game.businessName + ' \u2591\u2592\u2593\u2588';

    document.getElementById('headerInfo').textContent =
        'Level ' + game.level + ' \u2022 Day ' + game.day + ' \u2022 ' + WEATHER[game.weather].icon + ' ' + WEATHER[game.weather].name + ' \u2022 ' + game.locations.length + ' Location' + (game.locations.length > 1 ? 's' : '');

    document.getElementById('cash').textContent = '$' + game.cash.toFixed(2);
    document.getElementById('stock').textContent = game.inventory + '/' + game.maxInventory;

    const priceInput = document.getElementById('priceInput');
    if (priceInput) priceInput.value = game.price.toFixed(2);

    const dayNumEl = document.getElementById('dayNum');
    const dayNumBtnEl = document.getElementById('dayNumBtn');
    if (dayNumEl) dayNumEl.textContent = game.day;
    if (dayNumBtnEl) dayNumBtnEl.textContent = game.day;

    // Restore autoBuy toggle state
    const autoBuyToggle = document.getElementById('autoBuyToggle');
    if (autoBuyToggle && game.autoBuy) {
        autoBuyToggle.checked = true;
        document.getElementById('autoBuySettings').classList.remove('hidden');
    }

    document.getElementById('reputation').textContent = game.reputation;
    document.getElementById('locationCount').textContent = game.locations.length;
    document.getElementById('totalRev').textContent = game.totalRevenue.toFixed(2);
    document.getElementById('totalCust').textContent = game.totalCustomers;
    document.getElementById('bestDay').textContent = game.bestDay;

    const repMult = 1.0 + (game.reputation / 50);
    document.getElementById('repMult').textContent = 'Mult: ' + repMult.toFixed(2) + 'x';

    let repStatus = game.reputation < 25 ? 'New business' :
                   game.reputation < 50 ? 'Building brand' :
                   game.reputation < 100 ? 'Getting known!' :
                   game.reputation < 200 ? 'Well-known!' :
                   game.reputation < 400 ? 'Famous!' : 'LEGENDARY!';
    document.getElementById('repStatus').textContent = repStatus;

    if (game.streak > 0) {
        document.getElementById('streakDiv').classList.remove('hidden');
        document.getElementById('streak').textContent = game.streak;
    } else {
        document.getElementById('streakDiv').classList.add('hidden');
    }

    const xpPct = Math.min(100, (game.xp / game.xpToNext) * 100);
    document.getElementById('xpFill').style.width = xpPct + '%';

    const matCost = game.marketPrices.materials;
    document.getElementById('matCost').textContent = matCost.toFixed(2);
    document.getElementById('cost10').textContent = (10 * matCost).toFixed(2);
    document.getElementById('cost25').textContent = (25 * matCost).toFixed(2);
    document.getElementById('cost50').textContent = (50 * matCost).toFixed(2);
    document.getElementById('cost100').textContent = (100 * matCost).toFixed(2);

    const totalRent = calculateTotalRent();
    const totalFixed = totalRent + game.marketPrices.utilities;
    document.getElementById('rentCost').textContent = totalRent.toFixed(2);
    document.getElementById('utilCost').textContent = game.marketPrices.utilities.toFixed(2);
    document.getElementById('totalFixed').textContent = totalFixed.toFixed(2);

    // Expansion panel
    const nextPrice = getNextLocationPrice();
    const nextRent = Math.floor(nextPrice * 0.10);
    document.getElementById('nextLocationPrice').textContent = nextPrice.toFixed(0);
    document.getElementById('nextLocationRent').textContent = nextRent.toFixed(0);
    document.getElementById('nextLocationNum').textContent = game.locations.length + 1;
    document.getElementById('buyLocationPrice').textContent = nextPrice.toFixed(0);
    document.getElementById('buyLocationBtn').disabled = game.cash < nextPrice;

    updateBuyButtons();
    updateMarketPanel();
    updatePriceMonitor();
    updateLog();

    // Update multiplayer UI if available
    if (typeof updateMultiplayerUI === 'function') {
        updateMultiplayerUI();
    }

    // Update market intel panel if upgrades purchased
    updateMarketIntelPanel();

    saveGame();
}

function updateBuyButtons() {
    [10, 25, 50, 100].forEach(function(amt) {
        const cost = amt * game.marketPrices.materials;
        const btn = document.getElementById('buy' + amt);
        if (btn) btn.disabled = game.inventory + amt > game.maxInventory || game.cash < cost;
    });
}

function updateMarketPanel() {
    const totalRent = calculateTotalRent();
    const html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; font-size: 0.9rem;">' +
        '<div>Materials: $' + game.marketPrices.materials.toFixed(2) + '/unit</div>' +
        '<div>Total Rent: $' + totalRent.toFixed(2) + '/day</div>' +
        '<div>Utilities: $' + game.marketPrices.utilities.toFixed(2) + '/day</div>' +
    '</div>' +
    '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #0a0; color: #0a0; font-size: 0.8rem;">' +
        '\uD83D\uDCA1 Location prices scale with your cash (max 350%). Rent = 10% of purchase price.' +
    '</div>';
    document.getElementById('marketPrices').innerHTML = html;
}

function updatePriceMonitor() {
    const monitor = document.getElementById('priceMonitor');
    const text = document.getElementById('priceMonitorText');
    const { materialCost, minFairPrice, idealPrice, maxReasonablePrice, tooExpensivePrice } = calculatePriceFactors();

    if (game.price < materialCost) {
        monitor.classList.remove('hidden');
        text.innerHTML = '\uD83D\uDEAB LOSING MONEY! Price is below material cost ($' + materialCost.toFixed(2) + ')!';
        text.style.color = '#f00';
    } else if (game.price < minFairPrice) {
        monitor.classList.remove('hidden');
        text.innerHTML = '\u26A0\uFE0F TOO CHEAP! Customers will think it\'s low quality. Min: $' + minFairPrice.toFixed(2);
        text.style.color = '#f00';
    } else if (game.price > tooExpensivePrice) {
        monitor.classList.remove('hidden');
        text.innerHTML = '\uD83D\uDEAB WAY TOO HIGH! You\'ll get almost 0 customers! Max: $' + maxReasonablePrice.toFixed(2);
        text.style.color = '#f00';
    } else if (game.price > maxReasonablePrice) {
        monitor.classList.remove('hidden');
        text.innerHTML = '\u26A0\uFE0F TOO HIGH! Losing lots of customers. Recommended max: $' + maxReasonablePrice.toFixed(2);
        text.style.color = '#ff0';
    } else if (game.price > idealPrice * 1.3) {
        monitor.classList.remove('hidden');
        text.innerHTML = '\u26A0\uFE0F A bit high. Some customers deterred. Sweet spot: $' + minFairPrice.toFixed(2) + '-$' + idealPrice.toFixed(2);
        text.style.color = '#ff0';
    } else {
        monitor.classList.add('hidden');
    }
}

function updateLog() {
    const colors = { SYSTEM: '#ff0', PLAYER: '#0f0', ANALYSIS: '#ff0', ERROR: '#f00', INFO: '#0a0', CATASTROPHE: '#f00', WARNING: '#ff0', BUSINESS: '#0ff', UPGRADE: '#ff0', CITY: '#0ff', MP: '#0ff' };
    const html = logs.map(function(log) {
        return '<div class="log-entry" style="color: ' + (colors[log.type] || '#0f0') + ';">[' + log.type + '] ' + log.text + '</div>';
    }).join('');
    document.getElementById('activityLog').innerHTML = html || '<div style="color: #0a0;">No logs yet...</div>';
    document.getElementById('activityLog').scrollTop = 999999;
}

function addLog(type, text) {
    logs.push({ type: type, text: text });
    if (logs.length > 100) logs.shift();
    updateLog();
}

function updateLocationsList() {
    if (!game.locations || !Array.isArray(game.locations)) {
        game.locations = [{ id: 1, name: "Main Stand", purchasePrice: 0, rentPerDay: 0, dayPurchased: 0 }];
    }

    const totalRent = calculateTotalRent();
    let html = '<div style="margin-bottom: 0.5rem; color: #ff0;">Total Rent: $' + totalRent.toFixed(2) + '/day</div>';

    game.locations.forEach(function(loc) {
        const isFree = loc.purchasePrice === 0;
        html += '<div style="padding: 0.5rem; margin: 0.25rem 0; border: 1px solid ' + (isFree ? '#0ff' : '#0a0') + '; background: rgba(0,255,0,0.05);">' +
            '<div style="font-weight: bold; color: ' + (isFree ? '#0ff' : '#0f0') + ';">' + loc.name + (isFree ? ' \u2B50' : '') + '</div>' +
            '<div style="font-size: 0.8rem; color: #0a0;">' +
                (loc.purchasePrice > 0 ? 'Bought: $' + loc.purchasePrice.toFixed(0) + ' (Day ' + loc.dayPurchased + ')' : '\uD83C\uDF81 Starting Location (FREE!)') +
            '</div>' +
            '<div style="font-size: 0.8rem; color: ' + (loc.rentPerDay > 0 ? '#f00' : '#0f0') + ';">' +
                'Rent: $' + loc.rentPerDay.toFixed(2) + '/day ' + (loc.rentPerDay === 0 ? '\u2728' : '') +
            '</div>' +
        '</div>';
    });

    document.getElementById('locationsContent').innerHTML = html;
}

function updateUpgradesTab() {
    let html = '';
    UPGRADES.forEach(function(upg) {
        const currentLevel = game.upgrades[upg.id] || 0;
        const cost = Math.floor(upg.baseCost * Math.pow(1.5, currentLevel));
        const canAfford = game.cash >= cost;

        html += '<div style="border: 1px solid ' + (canAfford ? '#0f0' : '#0a0') + '; padding: 1rem; margin-bottom: 1rem; background: rgba(0,255,0,0.05);">' +
            '<div style="font-weight: bold; font-size: 1.1rem; color: #0ff; margin-bottom: 0.5rem;">' +
                upg.name + ' (Level ' + currentLevel + ')' +
            '</div>' +
            '<div style="font-size: 0.85rem; color: #0a0; margin-bottom: 0.3rem;">' + upg.desc + '</div>' +
            '<div style="font-size: 0.8rem; color: #ff0; margin-bottom: 0.5rem; font-style: italic; border-left: 2px solid #ff0; padding-left: 0.5rem;">' +
                '\u2139\uFE0F ' + upg.tooltip +
            '</div>' +
            '<div style="margin-bottom: 0.5rem; color: #ff0;">' +
                'Cost: $' + cost + ' ' + (canAfford ? '\u2705' : '\u274C Not enough cash!') +
            '</div>' +
            '<button onclick="buyUpgradeFromTab(\'' + upg.id + '\')" ' + (!canAfford ? 'disabled' : '') + ' id="upgrade-' + upg.id + '">' +
                '\u2B06 UPGRADE TO LEVEL ' + (currentLevel + 1) +
            '</button>' +
        '</div>';
    });
    document.getElementById('upgradesContentTab').innerHTML = html;
}

function showReport(customers, served, revenue, expenses, profit, reason, catastrophe, breakdown) {
    const panel = document.getElementById('reportPanel');
    panel.classList.remove('hidden');

    // Hide all sections initially for staged reveal
    const revealIds = ['reportCust', 'reportRev', 'reportExp', 'reportProfit', 'expenseBreakdown', 'reportEvent', 'reportReason'];
    revealIds.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; }
    });

    // Step 1 (immediate): Day number + catastrophe event reveal
    document.getElementById('reportDay').textContent = game.day;
    if (catastrophe) {
        const evEl = document.getElementById('reportEvent');
        evEl.classList.remove('hidden');
        let txt = catastrophe.message;
        if (catastrophe.cashLoss > 0) txt += ' -$' + catastrophe.cashLoss.toFixed(2);
        if (catastrophe.invLoss > 0) txt += ' -' + catastrophe.invLoss + ' units';
        if (catastrophe.repLoss > 0) txt += ' -' + catastrophe.repLoss + ' rep';
        document.getElementById('eventText').textContent = txt;
        setTimeout(function() { evEl.style.opacity = '1'; }, 50);
    } else {
        document.getElementById('reportEvent').classList.add('hidden');
    }

    // Step 2 (600ms): Revenue / profit numbers
    setTimeout(function() {
        document.getElementById('reportCust').textContent = served === customers ? served : served + '/' + customers;
        document.getElementById('reportRev').textContent = '$' + revenue.toFixed(2);
        document.getElementById('reportExp').textContent = '$' + expenses.toFixed(2);
        const profitEl = document.getElementById('reportProfit');
        profitEl.textContent = (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2);
        profitEl.style.color = profit >= 0 ? '#0f0' : '#f00';
        ['reportCust', 'reportRev', 'reportExp', 'reportProfit'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el) el.style.opacity = '1';
        });
        if (profit > 0) showFloatingText('+$' + profit.toFixed(2), window.innerWidth / 2, 200, '#0f0');
        else if (profit < 0) showFloatingText('-$' + Math.abs(profit).toFixed(2), window.innerWidth / 2, 200, '#f00');
    }, 600);

    // Step 3 (1200ms): Expense breakdown
    setTimeout(function() {
        document.getElementById('rentUsed').textContent = (breakdown.rent || 0).toFixed(2);
        document.getElementById('utilUsed').textContent = (breakdown.utilities || 0).toFixed(2);
        if (catastrophe && breakdown.catastrophe > 0) {
            document.getElementById('catastropheCostDiv').classList.remove('hidden');
            document.getElementById('catastropheCost').textContent = breakdown.catastrophe.toFixed(2);
        } else {
            document.getElementById('catastropheCostDiv').classList.add('hidden');
        }
        const bkEl = document.getElementById('expenseBreakdown');
        if (bkEl) bkEl.style.opacity = '1';
    }, 1200);

    // Step 4 (1800ms): Analysis reason
    setTimeout(function() {
        if (reason) {
            const rEl = document.getElementById('reportReason');
            rEl.classList.remove('hidden');
            document.getElementById('reasonText').textContent = reason;
            rEl.style.opacity = '1';
        }
        if (typeof mpState !== 'undefined' && mpState.mode === 'city' && mpState.cityRank) {
            addLog('MP', '\uD83C\uDFE2 City rank: #' + mpState.cityRank);
        }
    }, 1800);
}

// Market intel panel — shows info based on purchased intel upgrades
function updateMarketIntelPanel() {
    const panel = document.getElementById('marketIntelPanel');
    if (!panel) return;

    const mrLevel = game.upgrades.market_research || 0;
    const intelLevel = game.upgrades.intel_network || 0;
    const supplyLevel = game.upgrades.supply_insight || 0;

    if (mrLevel === 0 && intelLevel === 0 && supplyLevel === 0) {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');

    let html = '<div style="color:#0ff; font-weight:bold; margin-bottom:0.5rem;">\uD83D\uDCCA MARKET INTEL</div>';

    if (mrLevel > 0) {
        const avgPrice = (typeof mpState !== 'undefined' && mpState.connected && mpState.cityAvgPrice > 0)
            ? mpState.cityAvgPrice
            : game.marketPrices.materials * 3;
        html += '<div style="margin-bottom:0.3rem;">\uD83D\uDD0D Avg Market Price: <strong style="color:#0ff;">$' + avgPrice.toFixed(2) + '</strong></div>';
        if (mrLevel >= 2) {
            const cmp = game.price < avgPrice ? '<span style="color:#0f0">UNDERCUT \u2713</span>' : '<span style="color:#f00">ABOVE MARKET</span>';
            html += '<div style="margin-bottom:0.3rem;">\uD83D\uDCC8 Your price vs market: <strong>' + cmp + '</strong></div>';
        }
        if (mrLevel >= 3) {
            const { idealPrice } = calculatePriceFactors();
            html += '<div style="margin-bottom:0.3rem;">\uD83C\uDFAF Ideal price estimate: <strong style="color:#0ff;">$' + idealPrice.toFixed(2) + '</strong></div>';
        }
    }

    if (intelLevel > 0) {
        const weatherMult = WEATHER[game.weather].mult;
        const repMult = 1.0 + (game.reputation / 50);
        const minEst = Math.floor(5 * weatherMult);
        const maxEst = Math.floor(20 * weatherMult * repMult * (1 + (game.upgrades.marketing || 0) * 0.15));
        html += '<div style="margin-bottom:0.3rem;">\uD83D\uDC65 Est. customer demand: <strong style="color:#ff0;">~' + minEst + '\u2013' + maxEst + ' visitors</strong></div>';
        if (intelLevel >= 2) {
            const priceOk = game.price <= calculatePriceFactors().maxReasonablePrice;
            html += '<div style="margin-bottom:0.3rem;">\uD83D\uDCB0 Price attractiveness: <strong style="color:' + (priceOk ? '#0f0' : '#f00') + '">' + (priceOk ? 'GOOD \u2713' : 'TOO HIGH \u26A0') + '</strong></div>';
        }
    }

    if (supplyLevel > 0 && typeof mpState !== 'undefined' && mpState.competitorPrices && mpState.competitorPrices.length > 0) {
        const stockOutChance = Math.random() > 0.55;
        html += '<div style="margin-bottom:0.3rem;">\uD83D\uDCE6 Rivals likely to stock out: <strong style="color:' + (stockOutChance ? '#0f0' : '#ff0') + '">' + (stockOutChance ? 'YES \u2014 opportunity!' : 'No') + '</strong></div>';
    }

    panel.innerHTML = html;
}

// Progressive day-based tips (shown once per milestone via toast)
const DAY_TIPS = {
    2: '\uD83D\uDCA1 TIP: Buy inventory BEFORE starting your day to avoid running out of stock!',
    3: '\uD83D\uDCA1 TIP: Check the UPGRADES tab \u2014 Marketing gives +15% more customers every day!',
    4: '\uD83D\uDCA1 TIP: Join the MULTIPLAYER tab to compete with real players in a shared city!',
    7: '\uD83D\uDCA1 TIP: Reputation grows with profit. Higher rep = more customers + higher max price.',
    10: '\uD83D\uDCA1 TIP: Expand! Buy a second location (BUSINESS tab) for +30% more customers.',
    15: '\uD83D\uDCA1 TIP: Enable Auto-Buy in the restock panel to automatically restock between days.'
};

function checkDayTip() {
    const tip = DAY_TIPS[game.day];
    if (tip && !localStorage.getItem('tip_day_' + game.day)) {
        setTimeout(function() { showNotif(tip, 'success'); }, 1500);
        localStorage.setItem('tip_day_' + game.day, '1');
    }
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(function(tab) { tab.classList.remove('active'); });

    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(function(btn) { btn.classList.remove('active'); });

    const selectedTab = document.getElementById('tab-' + tabName);
    if (selectedTab) selectedTab.classList.add('active');

    // Find the button that matches this tab
    buttons.forEach(function(btn) {
        if (btn.getAttribute('data-tab') === tabName || btn.textContent.toLowerCase().includes(tabName.substring(0, 4))) {
            btn.classList.add('active');
        }
    });

    if (tabName === 'upgrades') {
        updateUpgradesTab();
    }
    if (tabName === 'multiplayer' && typeof updateMultiplayerUI === 'function') {
        updateMultiplayerUI();
    }
}
