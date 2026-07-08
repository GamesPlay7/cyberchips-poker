// База реплік для чату ботів
// Змінні стану гри
let deck = [];
const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// 1. Функція створення нової колоди (52 карти)
function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ value, suit });
        }
    }
}

// 2. Функція тасування колоди (Рандом за методом Фішера-Єйтса)
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

const botPhrases = {
    start: [
        "Ну що, погнали? Удачі всім!",
        "Сьогодні мій день, хлопці.",
        "Давайте без образ, це просто бізнес 😎",
        "Хтось сьогодні піде з пустими кишенями!"
    ],
    fold: [
        "Пас. Карти повне сміття...",
        "Ну його, я пасую.",
        "Не цього разу. Fold.",
        "Ех, гарна спроба, але я пас."
    ],
    raise: [
        "Піднімаю ставки! Хто сміливий?",
        "🔥 Ставлю більше. Що скажете?",
        "У мене занадто хороша рука, щоб чекати.",
        "Давай перевіримо твої нерви! Raise!"
    ],
    win: [
        "Я ж казав, що переможу! 🎰",
        "Забираю банк, дякую за гру!",
        "Чистий розрахунок і ніякої магії.",
        "Легкі гроші!"
    ]
};

let gameState = {
    pot: 0,
    currentBet: 0,
    playerChips: 1000,
    currentTurn: 0, // 0 = Гравець, 1 = Бот 1, 2 = Бот 2, 3 = Бот 3
    round: 'preflop', // preflop, flop, turn, river, showdown
    activePlayers: [true, true, true, true]
};

const BASE_URL = 'https://cyberchips-poker.onrender.com';

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

    clearCommunityCards();

    try {
        let response = await fetch(`${BASE_URL}/start_game`);
        let data = await response.json();
        
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
            
            if (Math.random() < 0.15) {
                gameState.activePlayers[botIndex] = false;
                botStatusElement.innerText = "Fold 🔴";
            } else {
                gameState.pot += 25;
            }
            updateUI();
            nextTurn();
        }, 3500); 
    } else {
        nextTurn();
    }
}

// --- ПЕРЕХІД МІЖ РАУНДАМИ (ФЛОП, ТЕРН, РІВЕР) ---
async function advanceGameRound() {
    try {
        let response = await fetch(`${BASE_URL}/next_round`);
        let data = await response.json();
        gameState.round = data.round;

        if (gameState.round === 'showdown') {
            let winResponse = await fetch(`${BASE_URL}/determine_winner`);
            let winData = await winResponse.json();
            alert(winData.winner_text);
            startNewHand();
        } else {
            renderCommunityCards(data.community_cards);
            console.log(`--- Новий раунд: ${gameState.round.toUpperCase()} ---`);
            
            if (gameState.activePlayers[0]) {
                setControlsEnabled(true);
            } else {
                nextTurn();
            }
        }
    } catch (error) {
        console.error("Помилка зміни раунду:", error);
    }
}

// --- МАЛЮВАННЯ КАРТ НА СТОЛІ ---
function renderCommunityCards(cards) {
    const tableCenter = document.querySelector('.poker-table .flex');
    tableCenter.innerHTML = '';

    cards.forEach(card => {
        let color = (card.suit === '♦' || card.suit === '♥') ? 'text-red-600' : 'text-black';
        tableCenter.innerHTML += `
            <div class="w-14 h-20 bg-white ${color} font-black rounded-md flex flex-col items-center justify-center text-xl shadow-md animate-bounce">
                <div>${card.value}</div>
                <div class="text-2xl -mt-2">${card.suit}</div>
            </div>
        `;
    });

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

// Функція для додавання повідомлень в ігровий лог
function updateGameLog(message) {
    const logBox = document.getElementById('game-log');
    if (logBox) {
        logBox.innerHTML += `<div>• ${message}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }
}

// Функція, щоб боти привіталися на початку гри
function initBotGreetings() {
    const bots = ['bot1', 'bot2', 'bot3'];
    bots.forEach(botId => {
        const randomIndex = Math.floor(Math.random() * botPhrases.start.length);
        const speechText = botPhrases.start[randomIndex];
        
        setTimeout(() => {
            if (typeof triggerBotSpeech === "function") {
                triggerBotSpeech(botId, speechText, 4000);
            }
        }, Math.random() * 600 + 200);
    });
}

// 3. Запуск нового раунду роздачі
// Оновлена функція роздачі у твойому script.js
function startNewRound() {
    createDeck();
    shuffleDeck();

    updateGameLog("🃏 Дилер роздає карти...");

    // Видаємо дві карти гравцю
    const playerCard1 = deck.pop();
    const playerCard2 = deck.pop();

    // Відображаємо карти гравця на екрані
    const playerCardElements = document.getElementById('player-cards').children;
    if (playerCardElements.length >= 2) {
        // Оновлюємо контент
        playerCardElements[0].innerHTML = `<span class="${getCardColor(playerCard1.suit)}">${playerCard1.value}${playerCard1.suit}</span>`;
        playerCardElements[1].innerHTML = `<span class="${getCardColor(playerCard2.suit)}">${playerCard2.value}${playerCard2.suit}</span>`;
        
        // Вішаємо анімацію, яка підстрибне рівно 2 рази і затихне
        playerCardElements[0].classList.add('animate-card-appear');
        playerCardElements[1].classList.add('animate-card-appear');
    }

    // Змінюємо статус ботів на активний
    document.getElementById('bot1-status').innerText = "Думає...";
    document.getElementById('bot2-status').innerText = "Думає...";
    document.getElementById('bot3-status').innerText = "Думає...";
    
    updateGameLog("💬 Боти оцінюють свої шанси. Твій хід!");
}

// Допоміжна функція для кольору масті (червоний для чирви/бубни)
function getCardColor(suit) {
    return (suit === '♥' || suit === '♦') ? 'text-red-500' : 'text-black';
}