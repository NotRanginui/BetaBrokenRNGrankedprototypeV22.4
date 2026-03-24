/**
 * CRIMSON RNG: ELITE 
 * UPDATE: NIGHTMARE CINEMATIC SEQUENCE & EPIC GLOWS
 */

const ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Emerald", "Nightmare"];
const BOT_LUCK_CONFIG = {
    "Bronze": [1.0, 1.8], "Silver": [1.9, 2.4], "Gold": [2.5, 3.8],
    "Platinum": [4.5, 8.0], "Diamond": [10.0, 20.0], "Emerald": [25.0, 55.0], "Nightmare": [80.0, 300.0]
};

// --- DATA ---
let allAccounts = JSON.parse(localStorage.getItem('crimson_accounts')) || [
    { name: "Player 1", points: 0, streak: 0, wins: 0, losses: 0, history: [], pb: 0 }
];
let globalHighRolls = JSON.parse(localStorage.getItem('crimson_global_highs')) || [];
let currentAccIdx = parseInt(localStorage.getItem('crimson_current_acc')) || 0;
let settings = JSON.parse(localStorage.getItem('crimson_settings')) || { roundNumbers: false };
let adminPersist = JSON.parse(localStorage.getItem('crimson_admin_persist')) || { playerLuck: 2.0, adminRPBonus: 1.0 };

// --- LIVE STATE ---
let playerSets = 0, botSets = 0, currentBotRank = "Bronze";
let playerLuck = parseFloat(adminPersist.playerLuck);
let adminRPBonus = parseFloat(adminPersist.adminRPBonus);
let godMode = false, botRigged = false, botLuckOverride = null;
let playerRetries = 5, playerRoll = 0, botRoll = 0, isProcessing = false;
let lastRankIdx = -1;

function init() {
    if (!allAccounts[currentAccIdx]) currentAccIdx = 0;
    
    const savedMatch = JSON.parse(localStorage.getItem('crimson_match_state'));
    if (savedMatch) {
        playerSets = savedMatch.pSets || 0;
        botSets = savedMatch.bSets || 0;
        currentBotRank = savedMatch.botRank || "Bronze";
    } else {
        queueBot();
    }

    lastRankIdx = Math.floor(allAccounts[currentAccIdx].points / 400);
    
    updateUI();
    updateDots();
    resetRound();
    attachListeners();
}

function save() {
    localStorage.setItem('crimson_accounts', JSON.stringify(allAccounts));
    localStorage.setItem('crimson_global_highs', JSON.stringify(globalHighRolls));
    localStorage.setItem('crimson_current_acc', currentAccIdx);
    localStorage.setItem('crimson_settings', JSON.stringify(settings));
    localStorage.setItem('crimson_admin_persist', JSON.stringify({ playerLuck, adminRPBonus }));
    localStorage.setItem('crimson_match_state', JSON.stringify({
        pSets: playerSets, bSets: botSets, botRank: currentBotRank
    }));
}

function updateUI() {
    const acc = allAccounts[currentAccIdx];
    const rIdx = Math.min(6, Math.floor(acc.points / 400));
    const rName = ranks[rIdx];
    const div = Math.floor((acc.points % 400) / 100) + 1;

    // Check for Rank Up
    if (lastRankIdx !== -1 && rIdx > lastRankIdx) {
        triggerRankPromotion(rName);
    }
    lastRankIdx = rIdx; 

    const recent = acc.history.slice(0, 20);
    const rollingWR = recent.length === 0 ? 0.5 : recent.filter(m => m.res === "WIN").length / recent.length;
    const lifeWR = (acc.wins + acc.losses === 0) ? 0 : (acc.wins / (acc.wins + acc.losses)) * 100;
    const mult = (0.5 + rollingWR) * adminRPBonus;

    document.getElementById('rank-name').innerText = `${rName.toUpperCase()} ${div}`;
    document.getElementById('rank-points').innerText = Math.floor(acc.points).toLocaleString();
    document.getElementById('user-display-name').innerText = acc.name;
    document.getElementById('streak-count').innerText = acc.streak;
    document.getElementById('winrate-count').innerText = Math.round(lifeWR);
    
    const bonusDisplay = document.getElementById('bonus-display');
    bonusDisplay.innerText = `MULTI: x${mult.toFixed(2)}`;
    bonusDisplay.style.color = mult >= 1 ? "#fbbf24" : "#ef4444";

    document.getElementById('current-rank-logo').className = `rank-icon rank-${rName}`;
    document.getElementById('exp-progress').style.width = (acc.points % 100) + "%";
    document.getElementById('bot-display-name').innerText = `BOT (${currentBotRank.toUpperCase()})`;
    
    save();
}

// --- CUTSCENE ENGINE ---
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function triggerRankPromotion(name) {
    if (name === "Nightmare") {
        await playNightmareCutscene(name);
    } else {
        triggerNormalPromotion(name);
    }
}

function triggerNormalPromotion(name) {
    const overlay = document.getElementById('rank-up-overlay');
    const content = document.getElementById('rank-up-content');
    
    document.getElementById('rank-up-name').innerText = name.toUpperCase();
    document.getElementById('rank-up-icon').className = `rank-icon rank-${name}`;
    
    // Apply special epic glow for high tiers
    if (name === "Diamond" || name === "Emerald") {
        content.className = 'epic-glow';
    } else {
        content.className = 'rank-up-active';
    }

    void content.offsetWidth; 
    overlay.style.display = 'flex';
}

async function playNightmareCutscene(name) {
    const seq = document.getElementById('nightmare-sequence');
    const star = document.getElementById('nightmare-star');
    const dots = document.getElementById('nightmare-dots');
    const t1 = document.getElementById('nightmare-text-1');
    const t2 = document.getElementById('nightmare-text-2');
    const flower = document.getElementById('nightmare-flower');
    const flash = document.getElementById('nightmare-flash');

    // Reset Elements
    seq.style.display = 'flex';
    star.style.display = 'none'; star.style.animation = 'none';
    dots.style.display = 'none';
    t1.style.display = 'none'; t1.style.opacity = '1';
    t2.style.display = 'none'; t2.style.opacity = '0';
    flower.style.display = 'none'; flower.style.animation = 'none';
    flash.style.display = 'none'; flash.style.animation = 'none';

    // 1. Fade to Black (2s)
    await wait(2000);

    // 2. Star Spins & Grows (5s)
    star.style.display = 'block';
    star.style.animation = 'spinGrow 5s cubic-bezier(0.5, 0, 0.5, 1) forwards';
    await wait(5000);
    star.style.display = 'none';

    // 3. Dots & Red Text (3s)
    dots.style.display = 'block';
    t1.style.display = 'block';
    await wait(3000);

    // 4. Fade Text to "reached me" + Glitch Flower (4s)
    t1.style.opacity = '0';
    await wait(1000);
    t1.style.display = 'none';
    t2.style.display = 'block';
    setTimeout(() => t2.style.opacity = '1', 50);
    
    flower.style.display = 'block';
    flower.style.animation = 'glitch 0.2s infinite';
    await wait(4000);

    // 5. Flower Expands (2.5s)
    flower.style.animation = 'glitch 0.1s infinite, expandFlower 2s ease-in forwards';
    await wait(2200);

    // 6. Flash Black & End
    flash.style.display = 'block';
    flash.style.animation = 'flashBlack 0.5s ease-out forwards';
    await wait(500);

    seq.style.display = 'none';
    triggerNormalPromotion(name); // Load final cutscene screen
}

// --- GAMEPLAY ENGINE ---
function queueBot() {
    const pIdx = Math.min(6, Math.floor(allAccounts[currentAccIdx].points / 400));
    const chance = Math.random();
    let bIdx = (chance < 0.7) ? pIdx : (chance < 0.85 ? Math.min(6, pIdx + 1) : Math.max(0, pIdx - 1));
    currentBotRank = ranks[bIdx];
}

function resetRound() {
    playerRoll = 0;
    playerRetries = godMode ? 999 : 5;
    isProcessing = false;
    document.getElementById('player-roll').innerHTML = `<span class="roll-value">?</span>`;
    document.getElementById('bot-roll').innerHTML = `<span class="roll-value">?</span>`;
    document.getElementById('player-retries').innerText = godMode ? "GOD MODE" : `RETRIES: ${playerRetries}`;
    
    const range = BOT_LUCK_CONFIG[currentBotRank] || [1, 2];
    const luck = botLuckOverride || (botRigged ? 1.05 : range[0] + (Math.random() * (range[1] - range[0])));
    botRoll = (1 / (Math.random() || 0.01)) * luck;
    botLuckOverride = null;
}

function playerRollAction() {
    if (isProcessing || (playerRetries <= 0 && !godMode)) return;
    playerRoll = (1 / (Math.random() || 0.01)) * playerLuck;
    if (!godMode) playerRetries--;

    const val = settings.roundNumbers ? Math.round(playerRoll).toLocaleString() : playerRoll.toFixed(2);
    document.getElementById('player-roll').innerHTML = `<span class="roll-value">1 in ${val}</span>`;
    document.getElementById('player-retries').innerText = godMode ? "GOD MODE" : `RETRIES: ${playerRetries}`;

    if (playerRoll > allAccounts[currentAccIdx].pb) allAccounts[currentAccIdx].pb = playerRoll;
    
    if (playerRoll > 5) {
        globalHighRolls.push({ name: allAccounts[currentAccIdx].name, val: playerRoll });
        globalHighRolls.sort((a,b) => b.val - a.val);
        if (globalHighRolls.length > 15) globalHighRolls.pop();
    }
    save();
}

function playerStandAction() {
    if (isProcessing || playerRoll === 0) return;
    isProcessing = true;
    const bVal = settings.roundNumbers ? Math.round(botRoll).toLocaleString() : botRoll.toFixed(2);
    document.getElementById('bot-roll').innerHTML = `<span class="roll-value">1 in ${bVal}</span>`;

    setTimeout(() => {
        if (playerRoll > botRoll) playerSets++; else botSets++;
        updateDots();
        save();
        if (playerSets === 3 || botSets === 3) handleMatchEnd(); else resetRound();
    }, 600);
}

function handleMatchEnd() {
    const acc = allAccounts[currentAccIdx];
    const win = playerSets === 3;
    if (win) { acc.wins++; acc.streak++; } else { acc.losses++; acc.streak = 0; }

    const recent = acc.history.slice(0, 20);
    const rollingWR = recent.length === 0 ? 0.5 : recent.filter(m => m.res === "WIN").length / recent.length;
    const diff = Math.round((win ? 25 : 18) * ((0.5 + rollingWR) * adminRPBonus));

    if (win) acc.points += diff; else acc.points = Math.max(0, acc.points - diff);
    acc.history.unshift({ res: win ? "WIN" : "LOSS", score: `${playerSets}-${botSets}`, p: playerRoll, b: botRoll });
    if (acc.history.length > 50) acc.history.pop();

    playerSets = 0; botSets = 0;
    queueBot(); 
    updateUI(); 
    updateDots(); 
    resetRound();
}

function updateDots() {
    const p = document.getElementById('player-sets'), b = document.getElementById('bot-sets');
    if (!p || !b) return;
    p.innerHTML = ""; b.innerHTML = "";
    for(let i=0; i<3; i++) {
        p.innerHTML += `<div class="dot ${i < playerSets ? 'p-win' : ''}"></div>`;
        b.innerHTML += `<div class="dot ${i < botSets ? 'b-win' : ''}"></div>`;
    }
}

function toggleModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.style.display = (m.style.display === 'none' || !m.style.display) ? 'flex' : 'none';
}

function attachListeners() {
    window.onkeydown = (e) => { 
        if(e.key.toLowerCase() === 'p' && document.activeElement.tagName !== "INPUT") {
            document.getElementById('settings-modal').style.display = 'none';
            openAdminPanel(); 
        }
    };
    document.getElementById('rank-up-overlay').onclick = () => {
        document.getElementById('rank-up-overlay').style.display = 'none';
    };
}

/**
 * ADMIN & MGMT
 */
window.openAdminPanel = () => {
    if (prompt("PASS:") === "admin123") {
        document.getElementById('admin-luck-input').value = playerLuck;
        document.getElementById('admin-rp-bonus-input').value = adminRPBonus;
        toggleModal('admin-modal');
    }
};

window.applyAdminChanges = () => {
    playerLuck = parseFloat(document.getElementById('admin-luck-input').value) || 2.0;
    adminRPBonus = parseFloat(document.getElementById('admin-rp-bonus-input').value) || 1.0;
    
    const rpIn = document.getElementById('admin-rp-input').value;
    if (rpIn !== "") { allAccounts[currentAccIdx].points = parseInt(rpIn); document.getElementById('admin-rp-input').value = ""; }

    const streakIn = document.getElementById('admin-streak-input').value;
    if (streakIn !== "") { allAccounts[currentAccIdx].streak = parseInt(streakIn); document.getElementById('admin-streak-input').value = ""; }
    
    const botLuckIn = document.getElementById('admin-bot-luck-input').value;
    if (botLuckIn !== "") { botLuckOverride = parseFloat(botLuckIn); document.getElementById('admin-bot-luck-input').value = ""; }
    
    playerSets = 0; botSets = 0;
    queueBot(); updateUI(); updateDots(); resetRound(); toggleModal('admin-modal');
};

window.resetAdminSettings = () => {
    if(confirm("Reset all admin settings to default?")) {
        playerLuck = 2.0; adminRPBonus = 1.0; godMode = false; botRigged = false; botLuckOverride = null;
        document.getElementById('admin-luck-input').value = 2.0;
        document.getElementById('admin-rp-bonus-input').value = 1.0;
        document.getElementById('god-mode-btn').innerText = `GOD MODE: OFF`;
        document.getElementById('rig-bot-btn').innerText = `RIG BOT: OFF`;
        save(); alert("Defaults Restored.");
    }
};

window.adminAction = (t) => {
    if(t === 'instaWin') { playerSets = 3; handleMatchEnd(); }
    if(t === 'godMode') { godMode = !godMode; document.getElementById('god-mode-btn').innerText = `GOD: ${godMode?'ON':'OFF'}`; resetRound(); }
    if(t === 'rigBot') { botRigged = !botRigged; document.getElementById('rig-bot-btn').innerText = `RIG: ${botRigged?'ON':'OFF'}`; resetRound(); }
    if(t === 'clearHistory') { allAccounts[currentAccIdx].history = []; updateUI(); alert("Logs Cleared."); }
};

window.openHighRolls = () => {
    const list = document.getElementById('high-rolls-list');
    list.innerHTML = globalHighRolls.map((r, i) => `
        <div class="high-roll-item"><span><b style="color:#64748b; margin-right:8px;">#${i+1}</b> ${r.name}</span><b style="color:#fbbf24">1 in ${settings.roundNumbers ? Math.round(r.val).toLocaleString() : r.val.toFixed(1)}</b></div>`).join('') || "<p style='text-align:center; opacity:0.5; padding:20px;'>No records.</p>";
    toggleModal('high-rolls-modal');
};

window.openHistory = () => {
    const acc = allAccounts[currentAccIdx];
    document.getElementById('history-list').innerHTML = acc.history.map(h => `
        <div class="acc-item ${h.res === 'WIN' ? 'log-entry-win' : 'log-entry-loss'}" style="background:#1e293b; padding:12px; margin-bottom:8px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between;"><b class="${h.res === 'WIN' ? 'log-text-win' : 'log-text-loss'}">${h.res} (${h.score})</b><span class="${h.res === 'WIN' ? 'log-text-win' : 'log-text-loss'}">${h.res === 'WIN' ? '+' : '-'}${h.diff} RP</span></div>
            <div style="font-size:0.7rem; color:#94a3b8; margin-top:5px;">Roll: 1 in ${h.p.toFixed(1)} vs 1 in ${h.b.toFixed(1)}</div>
        </div>
    `).join('') || "<p style='text-align:center; padding:20px; opacity:0.5;'>No logs found.</p>";
    toggleModal('history-modal');
};

window.openLeaderboard = () => {
    let sorted = [...allAccounts].sort((a,b) => b.points - a.points);
    document.getElementById('leaderboard-list').innerHTML = sorted.map((a, i) => `
        <div style="padding:12px; background:#1e293b; margin-bottom:5px; border-radius:8px; display:flex; justify-content:space-between;"><span><b style="color:#ef4444; margin-right:8px;">#${i+1}</b> ${a.name}</span><b>${Math.floor(a.points).toLocaleString()} RP</b></div>
    `).join('');
    toggleModal('leaderboard-modal');
};

window.createNewAccount = () => {
    let n = document.getElementById('new-acc-name').value;
    if(n) { allAccounts.push({ name: n, points: 0, streak: 0, wins: 0, losses: 0, history: [], pb: 0 }); document.getElementById('new-acc-name').value = ""; renderAccounts(); }
};

window.switchAcc = (i) => { 
    currentAccIdx = i; lastRankIdx = Math.floor(allAccounts[i].points / 400); 
    playerSets = 0; botSets = 0; queueBot(); updateUI(); resetRound(); updateDots(); toggleModal('acc-modal'); 
};

window.deleteAcc = (i) => { if(allAccounts.length > 1 && confirm("Delete profile?")) { allAccounts.splice(i,1); currentAccIdx = 0; updateUI(); renderAccounts(); }};

function renderAccounts() {
    document.getElementById('acc-list').innerHTML = allAccounts.map((a, i) => `
        <div class="acc-item" style="display:flex; align-items:center; background:#1e293b; margin-bottom:8px; border-radius:10px; border-left: 4px solid ${i === currentAccIdx ? '#ef4444' : 'transparent'}">
            <div onclick="switchAcc(${i})" style="flex:1; padding:12px; cursor:pointer;"><div style="font-weight:900;">${a.name}</div><div style="font-size:0.7rem; opacity:0.6;">${Math.floor(a.points)} RP</div></div>
            <button onclick="deleteAcc(${i})" style="padding:15px; background:none; border:none; color:#ef4444;">✕</button>
        </div>`).join('');
}

window.editName = () => { let n = prompt("Identity Update:", allAccounts[currentAccIdx].name); if(n && n.trim().length > 0) { allAccounts[currentAccIdx].name = n.trim().substring(0, 12); updateUI(); }};
window.updateSettings = () => { settings.roundNumbers = document.getElementById('round-toggle').checked; updateUI(); };
window.wipeData = () => { if(confirm("Wipe all data?")) { localStorage.clear(); location.reload(); }};
window.onload = init;
