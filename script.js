const ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Emerald", "Nightmare"];

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

function showPointPopup(amount, isWin, label = "") {
    const container = document.body;
    const popup = document.createElement('div');
    const displayValue = label || ((isWin ? "+" : "-") + Math.abs(Math.round(amount)) + " RP");
    popup.innerText = displayValue;
    popup.style.cssText = `
        position: fixed;
        left: 50%;
        top: 45%;
        transform: translateX(-50%);
        color: ${isWin ? '#22c55e' : '#ef4444'};
        font-weight: bold;
        font-size: 1.8rem;
        pointer-events: none;
        animation: floatUp 2s ease-out forwards;
        z-index: 9999;
        text-shadow: 0 0 15px rgba(0,0,0,0.8);
    `;
    
    if (!document.getElementById('popup-anim')) {
        const style = document.createElement('style');
        style.id = 'popup-anim';
        style.innerHTML = `@keyframes floatUp { 
            0% { opacity: 0; transform: translate(-50%, 20px); } 
            20% { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%, -80px); } 
        }`;
        document.head.appendChild(style);
    }

    container.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
}

function updateUI() {
    let acc = allAccounts[currentAccIdx];
    let rIdx = Math.min(6, Math.floor(acc.points / 400));
    let rankName = ranks[rIdx];
    let pointsInRank = acc.points % 400;
    let division = Math.floor(pointsInRank / 100) + 1;

    // FLEXIBLE WIN RATE: Using a 5.0 multiplier instead of 2.0 to make it more sensitive
    let winsInHistory = (acc.history || []).filter(h => h.res === "WIN").length;
    let winRate = acc.history && acc.history.length > 0 ? (winsInHistory / acc.history.length) : 0.5;
    
    const bonusEl = document.getElementById('bonus-display');
    let displayBonus = (winRate - 0.5) * 500; // 500 makes a 10% change in winrate move the needle 50%

    if (winRate >= 0.5) {
        bonusEl.innerText = displayBonus > 0 ? `+${displayBonus.toFixed(0)}% RP BONUS` : `NEUTRAL RP RATE`;
        bonusEl.style.color = displayBonus > 0 ? "#22c55e" : "#9ca3af";
    } else {
        bonusEl.innerText = `${displayBonus.toFixed(0)}% RP PENALTY`;
        bonusEl.style.color = "#ef4444";
    }

    if (lastRankIdx !== null && rIdx > lastRankIdx) playRankUpCutscene(rankName, rIdx);
    
    lastDiv = division; 
    lastRankIdx = rIdx;

    document.getElementById('rank-name').innerText = `${rankName.toUpperCase()} ${division}`;
    document.getElementById('user-display-name').innerText = acc.name;
    document.getElementById('rank-points').innerText = Math.floor(acc.points);
    document.getElementById('streak-count').innerText = acc.streak || 0;
    
    document.getElementById('exp-progress').style.width = (pointsInRank % 100) + "%";
    document.getElementById('current-rank-logo').className = `rank-icon rank-${rankName}`;
    
    localStorage.setItem('crimson_accounts', JSON.stringify(allAccounts));
}

// --- RELOAD PROTECTION ---
function checkLeaverPenalty() {
    if (localStorage.getItem('crimson_in_match') === 'true') {
        let acc = allAccounts[currentAccIdx];
        acc.points = Math.max(0, acc.points - 25);
        setTimeout(() => showPointPopup(25, false, "-25 LEAVER PENALTY"), 1000);
        updateUI();
    }
    localStorage.setItem('crimson_in_match', 'false');
}

function queueBot() {
    let acc = allAccounts[currentAccIdx];
    let pIdx = Math.min(6, Math.floor(acc.points / 400));
    let bIdx = Math.random() < 0.7 ? pIdx : (Math.random() < 0.5 ? Math.min(6, pIdx + 1) : Math.max(0, pIdx - 1));
    currentBotRank = ranks[bIdx];
    document.getElementById('bot-display-name').innerText = `BOT (${currentBotRank.toUpperCase()})`;
}

function resetRound() {
    playerRoll = 0; playerRetries = godMode ? 999 : 5; isProcessing = false;
    document.getElementById('player-roll').innerHTML = `<span class="roll-value">?</span>`;
    document.getElementById('bot-roll').innerHTML = `<span class="roll-value">?</span>`;
    document.getElementById('player-retries').innerText = godMode ? "GOD MODE" : `RETRIES: ${playerRetries}`;
    
    const range = BOT_LUCK_CONFIG[currentBotRank];
    let weight = 0.8; 
    currentBotLuckValue = range[0] + (Math.pow(Math.random(), 1 - weight) * (range[1] - range[0]));
    botRoll = generateRarity(currentBotLuckValue);
}

document.getElementById('roll-btn').onclick = () => {
    if ((playerRetries > 0 || godMode) && !isProcessing) {
        localStorage.setItem('crimson_in_match', 'true'); // Penalty active once you roll
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
        if (playerSets === 3 || botSets === 3) handleMatchEnd();
        else setTimeout(resetRound, 1000);
    }, 800);
};

function handleMatchEnd() {
    localStorage.setItem('crimson_in_match', 'false'); // Safe to leave now
    let acc = allAccounts[currentAccIdx];
    let win = playerSets === 3;
    let score = `${playerSets}-${botSets}`;
    
    if(!acc.history) acc.history = [];
    acc.history.unshift({res: win ? "WIN" : "LOSS", time: getTime()});
    if(acc.history.length > 15) acc.history.pop(); // Shorter history = faster rate changes

    let pRankIdx = Math.min(6, Math.floor(acc.points / 400));
    let expectedLuckRange = BOT_LUCK_CONFIG[ranks[pRankIdx]];
    let pDiv = Math.floor((acc.points % 400) / 100); 
    let expectedLuck = expectedLuckRange[0] + (pDiv * ((expectedLuckRange[1] - expectedLuckRange[0]) / 3));

    let luckDiff = currentBotLuckValue - expectedLuck;
    let luckMultiplier = Math.max(0.4, Math.min(2.5, 1 - (luckDiff / (expectedLuck * 2))));
    let setMultiplier = (score === "3-0" || score === "0-3") ? 1.3 : (score === "3-2" || score === "2-3" ? 0.7 : 1.0);

    let winsInHistory = acc.history.filter(h => h.res === "WIN").length;
    let winRate = winsInHistory / acc.history.length;
    let winRateMod = (winRate - 0.5) * 5; // Aggressive sensitivity

    let pointChange = 0;
    
    if (win) {
        let baseGain = 15;
        pointChange = (baseGain * (1 + winRateMod)) * luckMultiplier * setMultiplier;
        acc.points += pointChange;
        acc.streak++;
    } 
    else {
        // SCALING HARSHNESS: Base loss increases by 2 per rank index
        let baseLoss = 15 + (pRankIdx * 2); 
        pointChange = (baseLoss * (1 - winRateMod)) * luckMultiplier * setMultiplier;
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

// ... Admin functions and high rolls logic remain standard ...
function adminAction(type) {
    if(type === 'instaWin') { playerSets = 3; handleMatchEnd(); }
    else if(type === 'godMode') { godMode = !godMode; resetRound(); }
}

window.onload = () => { 
    checkLeaverPenalty();
    updateUI(); 
    queueBot(); 
    resetRound(); 
};
