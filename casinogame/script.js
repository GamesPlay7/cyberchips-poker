let gameState = {
    pot: 0,
    currentBet: 0,
    playerChips: 1000,
    currentTurn: 0, // 0 = Гравець, 1 = Бот 1, 2 = Бот 2, 3 = Бот 3
    round: 'preflop', // preflop, flop, turn, river, showdown
    activePlayers: [true, true, true, true]
};

const potDisplay = document.getElementById('total-pot');
const btnFold = document.getElementById('btn-fold');
const btnCheck = document.getElementById('btn-check');
const btnRaise = document.getElementById('btn-raise');
const raiseAmountInput = document.getElementById('raise-amount');

window.onload = () => {
    console.log("♠️ Покерний клуб CyberChips готовий!");
    setupEventListeners();
    startNewHand();
};

function setupEventListeners() {
    btnFold.addEventListener('click', () => handlePlayerAction('fold'));
    btnCheck.addEventListener('click', () => handlePlayerAction('check'));
    btnRaise.addEventListener('click', () => handlePlayerAction('raise'));
}

// --- ПОЧАТОК НОВОЇ РОЗДАЧІ ---
async function startNewHand() {
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.currentTurn = 0;
    gameState.round = 'preflop';
    gameState.activePlayers = [true, true, true, true];
    
    document.getElementById('bot1-status').innerText = "Чекає...";
    document.getElementById('bot2-status').innerText = "Чекає...";
    document.getElementById('bot3-status').innerText = "Чекає...";

    // Очищаємо стіл від старих карт дилера
    clearCommunityCards();

    try {
        let response = await fetch('http://127.0.0.1:8000/start_game');
        let data = await response.json();
        
        // Малюємо карти гравця
        const cardsContainer = document.getElementById('player-cards');
        cardsContainer.innerHTML = '';
        data.player_cards.forEach(card => {
            let color = (card.suit === '♦' || card.suit === '♥') ? 'text-red-600' : 'text-black';
            cardsContainer.innerHTML += `
                <div class="w-14 h-20 bg-white ${color} font-black rounded-md flex flex-col items-center justify-center text-xl shadow-md">
                    <div>${card.value}</div>
                    <div class="text-2xl -mt-2">${card.suit}</div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Помилка сервера:", error);
    }

    updateUI();
    setControlsEnabled(true);
}

// --- ХІД ГРАВЦЯ ---
function handlePlayerAction(action) {
    if (gameState.currentTurn !== 0) return;

    if (action === 'fold') {
        gameState.activePlayers[0] = false;
        console.log("🔴 Ти скинув карти.");
    } else if (action === 'check') {
        console.log("⚪ Ти сказав Check/Call.");
    } else if (action === 'raise') {
        let amount = parseInt(raiseAmountInput.value);
        gameState.pot += amount;
        gameState.playerChips -= amount;
        gameState.currentBet = amount;
    }

    updateUI();
    setControlsEnabled(false);
    nextTurn();
}

// --- СИСТЕМА ЧЕРГИ ТА ПЕРЕХОДУ РАУНДІВ ---
function nextTurn() {
    gameState.currentTurn = (gameState.currentTurn + 1) % 4;

    // Якщо коло торгівлі завершилося (хід повернувся до гравця)
    if (gameState.currentTurn === 0) {
        advanceGameRound();
        return;
    }

    let botIndex = gameState.currentTurn;
    if (gameState.activePlayers[botIndex]) {
        let botStatusElement = document.getElementById(`bot${botIndex}-status`);
        botStatusElement.innerText = "Думає...";
        botStatusElement.classList.add('text-yellow-400', 'animate-pulse');

        setTimeout(() => {
            botStatusElement.innerText = "Зробив хід ✅";
            botStatusElement.classList.remove('text-yellow-400', 'animate-pulse');
            
            // Проста імітація ставки бота
            gameState.pot += 25;
            updateUI();
            nextTurn();
        }, 1500); 
    } else {
        nextTurn();
    }
}

// --- ПЕРЕХІД МІЖ РАУНДАМИ (ФЛОП, ТЕРН, РІВЕР) ---
async function advanceGameRound() {
    try {
        let response = await fetch('http://127.0.0.1:8000/next_round');
        let data = await response.json();
        gameState.round = data.round;

        if (gameState.round === 'showdown') {
            // Раунд розкриття карт — визначаємо переможця
            let winResponse = await fetch('http://127.0.0.1:8000/determine_winner');
            let winData = await winResponse.json();
            alert(winData.winner_text); // Виводимо переможця через сповіщення
            startNewHand(); // Починаємо нове коло
        } else {
            // Виводимо карти на стіл
            renderCommunityCards(data.community_cards);
            console.log(`--- Новий раунд: ${gameState.round.toUpperCase()} ---`);
            
            // Якщо гравець ще в грі, повертаємо йому хід
            if (gameState.activePlayers[0]) {
                setControlsEnabled(true);
            } else {
                nextTurn(); // Якщо гравець здався, боти грають далі самі
            }
        }
    } catch (error) {
        console.error("Помилка зміни раунду:", error);
    }
}

// --- МАЛЮВАННЯ КАРТ НА СТОЛІ ---
function renderCommunityCards(cards) {
    // Знайдемо центральний блок столу з картами дилера
    const tableCenter = document.querySelector('.poker-table .flex');
    tableCenter.innerHTML = ''; // Очищаємо заповнювачі (Flop, Turn...)

    cards.forEach(card => {
        let color = (card.suit === '♦' || card.suit === '♥') ? 'text-red-600' : 'text-black';
        tableCenter.innerHTML += `
            <div class="w-14 h-20 bg-white ${color} font-black rounded-md flex flex-col items-center justify-center text-xl shadow-md animate-bounce">
                <div>${card.value}</div>
                <div class="text-2xl -mt-2">${card.suit}</div>
            </div>
        `;
    });

    // Додаємо порожні місця для карт, які ще не відкриті
    for (let i = cards.length; i < 5; i++) {
        let label = i < 3 ? `Flop ${i+1}` : (i === 3 ? 'Turn' : 'River');
        tableCenter.innerHTML += `
            <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">${label}</div>
        `;
    }
}

function clearCommunityCards() {
    const tableCenter = document.querySelector('.poker-table .flex');
    tableCenter.innerHTML = `
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Flop 1</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Flop 2</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Flop 3</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Turn</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">River</div>
    `;
}

function updateUI() {
    potDisplay.innerText = `${gameState.pot}$`;
    document.querySelector('.text-xl.font-black.text-yellow-400').innerText = `${gameState.playerChips}$`;
}

function setControlsEnabled(enabled) {
    btnFold.disabled = !enabled;
    btnCheck.disabled = !enabled;
    btnRaise.disabled = !enabled;
    const opacityAction = enabled ? 'remove' : 'add';
    btnFold.classList[opacityAction]('opacity-50', 'cursor-not-allowed');
    btnCheck.classList[opacityAction]('opacity-50', 'cursor-not-allowed');
    btnRaise.classList[opacityAction]('opacity-50', 'cursor-not-allowed');
}