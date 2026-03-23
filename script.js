const ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Emerald", "Nightmare"];

// --- BUFFED BOT LUCK CONFIGURATION
const BOT_LUCK_CONFIG = {
    "Bronze": [1.5, 3.0],
    "Silver": [3.5, 5.5],
    "Gold": [6.0, 9.0],
    "Platinum": [10.0, 15.0],
    "Diamond": [18.0, 25.0],
    "Emerald": [30.0, 50.0],
    "Nightmare": [75.0, 250.0] 
};

// DATA
let allAccounts = JSON.parse(localStorage.getItem('crimson_accounts')) || [{name: "Player 1", points: 0, streak: 0, history: []}];
let currentAccIdx = parseInt(localStorage.getItem('crimson_current_acc')) || 0;
let globalHighRolls = JSON.parse(localStorage.getItem('crimson_high_rolls')) || [];
let settings = JSON.parse(localStorage.getItem('crimson_settings')) || { roundNumbers: false };

let lastDiv = null;
let lastRankIdx = null;

let godMode = false;
let botRigged = false;
let playerLuck = 2.0;
let currentBotLuckValue = 1.0; 

if (!allAccounts[currentAccIdx]) currentAccIdx = 0;

let playerSets = 0, botSets = 0, playerRetries = 5, playerRoll = 0, botRoll = 0, isProcessing = false;
let currentBotRank = "Bronze";

function getTime() { return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}); }

function generateRarity(luckFactor) {
    let base = 1 / Math.pow(Math.random(), 1.2);
    let final = base * luckFactor;
    return parseFloat(Math.max(1, final).toFixed(2));
}

function formatRoll(num) { return settings.roundNumbers ? Math.round(num) : num.toFixed(2); }

// --- UI POPUP SYSTEM ---
function showPointPopup(amount, isWin) {
    const container = document.getElementById('rank-container') || document.body;
    const popup = document.createElement('div');
    popup.innerText = (isWin ? "+" : "-") + Math.abs(Math.round(amount)) + " RP";
    popup.style.cssText = `
        position: absolute;
        left: 50%;
        top: 40%;
        transform: translateX(-50%);
        color: ${isWin ? '#22c55e' : '#ef4444'};
        font-weight: bold;
        font-size: 1.5rem;
        pointer-events: none;
        animation: floatUp 1.5s ease-out forwards;
        z-index: 1000;
        text-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;
    
    if (!document.getElementById('popup-anim')) {
        const style = document.createElement('style');
        style.id = 'popup-anim';
        style.innerHTML = `@keyframes floatUp { 
            0% { opacity: 0; transform: translate(-50%, 0); } 
            20% { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%, -50px); } 
        }`;
        document.head.appendChild(style);
    }

    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
}

function updateUI() {
    let acc = allAccounts[currentAccIdx];
    let rIdx = Math.min(6, Math.floor(acc.points / 400));
    let rankName = ranks[rIdx];
    let pointsInRank = acc.points % 400;
    let division = Math.floor(pointsInRank / 100) + 1;

    // Fixed default win rate to 0.5 so new accounts don't get immediate penalties
    let winsInHistory = (acc.history || []).filter(h => h.res === "WIN").length;
    let winRate = acc.history && acc.history.length > 0 ? (winsInHistory / acc.history.length) : 0.5;
    
    const bonusEl = document.getElementById('bonus-display');
    if (winRate >= 0.5) {
        let bonus = (winRate - 0.5) * 200; // Shifted so 50% = 0 bonus, 100% = +100% bonus
        bonusEl.innerText = bonus > 0 ? `+${bonus.toFixed(0)}% RP BONUS` : `NEUTRAL RP RATE`;
        bonusEl.style.color = bonus > 0 ? "#22c55e" : "#9ca3af";
    } else {
        let penalty = Math.min(50, ((0.5 - winRate) * 200));
        bonusEl.innerText = `-${penalty.toFixed(0)}% RP PENALTY`;
        bonusEl.style.color = "#ef4444";
    }

    if (lastRankIdx !== null && rIdx > lastRankIdx) {
        playRankUpCutscene(rankName, rIdx);
    } else if (lastDiv !== null && lastRankIdx === rIdx && division > lastDiv) {
        triggerDivAnim();
    }
    
    lastDiv = division; 
    lastRankIdx = rIdx;

    document.getElementById('rank-name').innerText = `${rankName.toUpperCase()} ${division}`;
    document.getElementById('user-display-name').innerText = acc.name;
    document.getElementById('rank-points').innerText = Math.floor(acc.points);
    document.getElementById('streak-count').innerText = acc.streak || 0;
    
    let barWidth = pointsInRank % 100;
    document.getElementById('exp-progress').style.width = barWidth + "%";
    document.getElementById('current-rank-logo').className = `rank-icon rank-${rankName}`;
    
    localStorage.setItem('crimson_accounts', JSON.stringify(allAccounts));
    localStorage.setItem('crimson_current_acc', currentAccIdx);
    localStorage.setItem('crimson_settings', JSON.stringify(settings));
}

function triggerDivAnim() {
    const elements = [document.getElementById('exp-progress'), document.getElementById('rank-name'), document.getElementById('current-rank-logo')];
    elements.forEach(el => {
        el.classList.remove('div-up-flash');
        void el.offsetWidth; 
        el.classList.add('div-up-flash');
    });
}

function playRankUpCutscene(rankName, rankIdx) {
    const overlay = document.getElementById('rank-up-overlay');
    const nameEl = document.getElementById('rank-up-name');
    const iconEl = document.getElementById('rank-up-icon');
    nameEl.innerText = rankName.toUpperCase();
    nameEl.className = `cutscene-${rankName}`;
    iconEl.className = `rank-icon rank-${rankName}`;
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 50);
    const duration = 2500 + (rankIdx * 500); 
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.style.display = 'none', 500);
    }, duration);
}

function queueBot() {
    let acc = allAccounts[currentAccIdx];
    let pIdx = Math.min(6, Math.floor(acc.points / 400));
    let bIdx;
    let roll = Math.random();
    if (roll < 0.7) bIdx = pIdx;
    else if (roll < 0.85) bIdx = Math.min(6, pIdx + 1);
    else bIdx = Math.max(0, pIdx - 1);

    currentBotRank = ranks[bIdx];
    document.getElementById('bot-display-name').innerText = `BOT (${currentBotRank.toUpperCase()})`;
}

function resetRound() {
    playerRoll = 0; playerRetries = godMode ? 999 : 5; isProcessing = false;
    document.getElementById('player-roll').innerHTML = `<span class="roll-value">?</span>`;
    document.getElementById('bot-roll').innerHTML = `<span class="roll-value">?</span>`;
    document.getElementById('player-retries').innerText = godMode ? "GOD MODE" : `RETRIES: ${playerRetries}`;
    
    if (botRigged) {
        currentBotLuckValue = 1.05;
        botRoll = 1.05;
    } else {
        const range = BOT_LUCK_CONFIG[currentBotRank];
        let min = range[0];
        let max = range[1];
        let weight = 0.8; 
        let finalLuck = min + (Math.pow(Math.random(), 1 - weight) * (max - min));
        currentBotLuckValue = finalLuck;
        botRoll = generateRarity(finalLuck);
    }
}

document.getElementById('roll-btn').onclick = () => {
    if ((playerRetries > 0 || godMode) && !isProcessing) {
        playerRoll = generateRarity(playerLuck);
        if(!godMode) playerRetries--;
        document.getElementById('player-roll').innerHTML = `<span class="roll-value">1 in ${formatRoll(playerRoll)}</span><span class="roll-suffix">RARITY</span>`;
        document.getElementById('player-retries').innerText = godMode ? "GOD MODE" : `RETRIES: ${playerRetries}`;
    }
};

document.getElementById('stand-btn').onclick = () => {
    if (playerRoll === 0 || isProcessing) return;
    isProcessing = true;
    document.getElementById('bot-roll').innerHTML = `<span class="roll-value">1 in ${formatRoll(botRoll)}</span><span class="roll-suffix">RARITY</span>`;
    
    setTimeout(() => {
        if (playerRoll > botRoll) playerSets++; else botSets++;
        updateDots();
        checkAndSaveHighRoll(playerRoll);
        if (playerSets === 3 || botSets === 3) handleMatchEnd();
        else setTimeout(resetRound, 1000);
    }, 800);
};

function handleMatchEnd() {
    let acc = allAccounts[currentAccIdx];
    let win = playerSets === 3;
    let score = `${playerSets}-${botSets}`;
    
    if(!acc.history) acc.history = [];
    acc.history.unshift({res: win ? "WIN" : "LOSS", p: playerRoll, b: botRoll, score: score, time: getTime()});
    if(acc.history.length > 20) acc.history.pop();

    // 1. CALCULATE EXPECTED LUCK & DIFFICULTY MULTIPLIER
    let pRankIdx = Math.min(6, Math.floor(acc.points / 400));
    let expectedLuckRange = BOT_LUCK_CONFIG[ranks[pRankIdx]];
    let pDiv = Math.floor((acc.points % 400) / 100); 
    let expectedLuck = expectedLuckRange[0] + (pDiv * ((expectedLuckRange[1] - expectedLuckRange[0]) / 3));

    let luckDiff = currentBotLuckValue - expectedLuck;
    
    // Multiplier Logic: Flipped to award MORE points for beating weaker bots, LESS for beating harder bots.
    // This same logic is applied safely to losses (lose MORE against weak bots, LESS against hard bots).
    let luckMultiplier = Math.max(0.4, Math.min(2.5, 1 - (luckDiff / (expectedLuck * 2))));

    // 2. SET PERFORMANCE MULTIPLIER (30%)
    let setMultiplier = 1.0;
    if (score === "3-0" || score === "0-3") setMultiplier = 1.3;
    else if (score === "3-2" || score === "2-3") setMultiplier = 0.7;

    // 3. WIN RATE BONUS/PENALTY CALCULATION
    let winsInHistory = acc.history.filter(h => h.res === "WIN").length;
    let winRate = (acc.history.length > 0) ? winsInHistory / acc.history.length : 0.5;
    
    let winRateMod = 0;
    if (winRate >= 0.5) {
        winRateMod = (winRate - 0.5) * 2; // Scales from 0 to +1.0
    } else {
        winRateMod = -Math.min(0.5, (0.5 - winRate) * 2); // Negative penalty (e.g., -0.1 for 45% win rate)
    }

    let pointChange = 0;
    let baseAmount = 15; // Balanced Base Value

    if (win) {
        // Apply Penalty/Bonus to the Gain (e.g., baseAmount * 0.9 if 10% penalty)
        let rateAdjustedGain = baseAmount * (1 + winRateMod); 
        
        pointChange = rateAdjustedGain * luckMultiplier * setMultiplier;
        acc.points += pointChange;
        acc.streak++;
    } 
    else {
        // Reverse Penalty/Bonus for the Loss (e.g., baseAmount * 1.1 if 10% penalty)
        let rateAdjustedLoss = baseAmount * (1 - winRateMod);
        
        pointChange = rateAdjustedLoss * luckMultiplier * setMultiplier;
        acc.points = Math.max(0, acc.points - pointChange);
        acc.streak = 0;
    }
    
    showPointPopup(pointChange, win);
    playerSets = 0; botSets = 0;
    updateUI(); updateDots(); queueBot(); setTimeout(resetRound, 1500);
}

function updateDots() {
    const p = document.getElementById('player-sets'), b = document.getElementById('bot-sets');
    p.innerHTML = ""; b.innerHTML = "";
    for(let i=0; i<3; i++){
        p.innerHTML += `<div class="dot ${i < playerSets ? 'p-win' : ''}"></div>`;
        b.innerHTML += `<div class="dot ${i < botSets ? 'b-win' : ''}"></div>`;
    }
}

function checkAndSaveHighRoll(val) {
    let acc = allAccounts[currentAccIdx];
    globalHighRolls.push({name: acc.name, roll: val, time: getTime()});
    globalHighRolls.sort((a,b) => b.roll - a.roll);
    globalHighRolls = globalHighRolls.slice(0, 15);
    localStorage.setItem('crimson_high_rolls', JSON.stringify(globalHighRolls));
}

// ... Menu & Admin functions ...
function adminAction(type) {
    if(type === 'instaWin') { playerSets = 3; handleMatchEnd(); }
    else if(type === 'godMode') {
        godMode = !godMode;
        document.getElementById('god-mode-btn').classList.toggle('active-god', godMode);
        document.getElementById('god-mode-btn').innerText = `GOD MODE: ${godMode ? 'ON' : 'OFF'}`;
        resetRound();
    }
    else if(type === 'rigBot') {
        botRigged = !botRigged;
        document.getElementById('rig-bot-btn').classList.toggle('active-god', botRigged);
        document.getElementById('rig-bot-btn').innerText = `RIG BOT: ${botRigged ? 'ON' : 'OFF'}`;
    }
    else if(type === 'clearHistory') {
        allAccounts[currentAccIdx].history = [];
        updateUI();
    }
}

function applyAdminChanges() {
    playerLuck = parseFloat(document.getElementById('admin-luck-input').value) || 2.0;
    let rp = parseInt(document.getElementById('admin-rp-input').value);
    if(!isNaN(rp)) allAccounts[currentAccIdx].points = rp;
    updateUI(); toggleModal('admin-modal');
}

function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = (m.style.display === 'none' || !m.style.display) ? 'flex' : 'none';
    if(id === 'acc-modal' && m.style.display === 'flex') renderAccounts();
}

function renderAccounts() {
    const list = document.getElementById('acc-list');
    list.innerHTML = "";
    allAccounts.forEach((acc, idx) => {
        list.innerHTML += `<div class="acc-item" style="border-left: 3px solid ${idx === currentAccIdx ? 'var(--crimson)' : 'transparent'}">
            <div onclick="switchAcc(${idx})" style="flex:1; cursor:pointer;"><b>${acc.name}</b><br><small>${acc.points} RP</small></div>
            <button onclick="deleteAcc(event, ${idx})" style="color:#f87171; font-size:0.6rem;">DEL</button>
        </div>`;
    });
}

function switchAcc(i) { currentAccIdx = i; updateUI(); queueBot(); resetRound(); toggleModal('acc-modal'); }

function createNewAccount() {
    let n = document.getElementById('new-acc-name').value;
    if(n) { allAccounts.push({name: n, points: 0, streak: 0, history: []}); renderAccounts(); }
}

function deleteAcc(e, i) {
    e.stopPropagation();
    if(allAccounts.length > 1) { allAccounts.splice(i, 1); if(currentAccIdx >= allAccounts.length) currentAccIdx=0; renderAccounts(); updateUI(); }
}

function openHighRolls() {
    toggleModal('high-rolls-modal');
    const list = document.getElementById('high-rolls-list');
    list.innerHTML = globalHighRolls.map((h, i) => `
        <div class="history-item">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <span>#${i+1} ${h.name}</span> <b style="color:var(--crimson)">1 in ${formatRoll(h.roll)}</b>
            </div>
            <div class="history-meta"><span>TIME: ${h.time}</span></div>
        </div>`).join('');
}

function openHistory() {
    toggleModal('history-modal');
    const list = document.getElementById('history-list');
    list.innerHTML = (allAccounts[currentAccIdx].history || []).map(h => `
        <div class="history-item">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <b style="color:${h.res==='WIN'?'#22c55e':'#ef4444'}">${h.res} (${h.score})</b>
                <span>1 in ${formatRoll(h.p)} vs ${formatRoll(h.b)}</span>
            </div>
            <div class="history-meta"><span>LOGGED: ${h.time}</span></div>
        </div>`).join('');
}

function openLeaderboard() {
    toggleModal('leaderboard-modal');
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = [...allAccounts].sort((a,b)=>b.points-a.points).map((acc, i) => `
        <div class="leader-item"><span>#${i+1} ${acc.name}</span><b>${acc.points} RP</b></div>`).join('');
}

function updateSettings() { settings.roundNumbers = document.getElementById('round-toggle').checked; updateUI(); }

function wipeData() { if(confirm("Wipe all data?")) { localStorage.clear(); location.reload(); } }

window.onkeydown = (e) => { if(e.key.toLowerCase() === 'p') { if(prompt("Passcode:") === "admin123") toggleModal('admin-modal'); } };
window.onload = () => { updateUI(); queueBot(); resetRound(); };
