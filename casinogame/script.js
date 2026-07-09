// База реплік для чату ботів
// Змінні стану гри
let deck = [];
const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Стани ставок та раунду
let currentPot = 0;          // Поточний загальний банк
let currentBet = 0;          // Максимальна ставка в поточному колі (яку треба зрівняти)
let botStacks = {            // Баланси ботів
    bot1: 1000,
    bot2: 1000,
    bot3: 1000
};
let activePlayers = {        // Хто ще в грі (якщо false - гравець зробив Fold)
    player: true,
    bot1: true,
    bot2: true,
    bot3: true
};

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
    updateGameLog("🃏 Дилер тасує колоду на сервері...");
    
    // Робимо запит до твого FastAPI бекенду
    fetch('https://cyberchips-poker.onrender.com/start_game')
        .then(res => res.json())
        .then(data => {
            // Отримуємо 2 карти гравця, які згенерував і прислав Python
            const pCards = data.player_cards;
            
            // Відображаємо карти гравця на екрані
            const playerCardElements = document.getElementById('player-cards').children;
            if (playerCardElements.length >= 2 && pCards.length >= 2) {
                
                // Оновлюємо контент картами із сервера, зберігаючи твої стилі
                playerCardElements[0].innerHTML = `<span class="${getCardColor(pCards[0].suit)}">${pCards[0].value}${pCards[0].suit}</span>`;
                playerCardElements[1].innerHTML = `<span class="${getCardColor(pCards[1].suit)}">${pCards[1].value}${pCards[1].suit}</span>`;
                
                // Вішаємо твою анімацію, яка підстрибне рівно 2 рази і затихне
                playerCardElements[0].className = "w-14 h-20 bg-white text-black font-bold rounded-md flex items-center justify-center text-lg shadow-md animate-card-appear";
                playerCardElements[1].className = "w-14 h-20 bg-white text-black font-bold rounded-md flex items-center justify-center text-lg shadow-md animate-card-appear";
            }

            // Змінюємо статус ботів на активний
            document.getElementById('bot1-status').innerText = "Думає...";
            document.getElementById('bot2-status').innerText = "Думає...";
            document.getElementById('bot3-status').innerText = "Думає...";
            
            updateGameLog("🎰 Карти роздано! Боти оцінюють свої шанси. Твій хід!");
            updateTableUI();
        })
        .catch(err => {
            updateGameLog("❌ Помилка зв'язку з Python-сервером на старті раунду.");
            console.error(err);
        });
}

// Допоміжна функція для кольору масті (червоний для чирви/бубни)
function getCardColor(suit) {
    return (suit === '♥' || suit === '♦') ? 'text-red-500' : 'text-black';
}
// Чекаємо завантаження сторінки, щоб прив'язати кліки до кнопок HTML
// =======================================================
// ЗАМІНИ СВІЙ БЛОК DOMContentLoaded НА ЦЕЙ ОБ'ЄДНАНИЙ:
// =======================================================
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Кнопка CHECK / CALL (Твій поточний код)
    document.getElementById('btn-check').addEventListener('click', () => {
        if (!activePlayers.player) return; 

        if (currentBet === 0) {
            updateGameLog("😎 Ти сказав <b>Check</b> (Пропуск ходу).");
        } else {
            let callAmount = currentBet;
            if (userChips >= callAmount) {
                userChips -= callAmount;
                currentPot += callAmount;
                updateGameLog(`😎 Ти сказав <b>Call</b> і зрівняв ставку ${callAmount}$.`);
            } else {
                currentPot += userChips;
                updateGameLog(`😎 Ти поставив останні <b>${userChips}$ (All-in)!</b>`);
                userChips = 0;
            }
        }
        
        updateTableUI(); 
        setTimeout(startBotTurns, 1500);
    });

    // 2. Кнопка RAISE (Додаємо її сюди ж, всередину)
    document.getElementById('btn-raise').addEventListener('click', () => {
        if (!activePlayers.player) return;

        let raiseInput = parseInt(document.getElementById('raise-amount').value);
        
        if (isNaN(raiseInput) || raiseInput < currentBet + 25) {
            raiseInput = currentBet + 25;
        }

        if (userChips >= raiseInput) {
            userChips -= raiseInput;
            currentPot += raiseInput;
            currentBet = raiseInput; 
            
            updateGameLog(`😎 Ти зробив <b>Raise</b> до <b>${raiseInput}$</b>!`);
            updateTableUI();

            // Передаємо хід ботам у відповідь на твій Raise
            setTimeout(startBotTurnsAfterPlayerRaise, 1500);
        } else {
            updateGameLog("❌ Недостатньо фішок для такаї ставки!");
        }
    });

});

// ==========================================
// ВСТАВЛЯЙ ЦЕ В САМИЙ КІНЕЦЬ ФАЙЛУ SCRIPT.JS
// ==========================================

// --- Крок 2: Функція оновлення банку та стеків на екрані ---
function updateTableUI() {
    // Оновлюємо банк (POT) угорі
    document.getElementById('total-pot').innerText = currentPot + "$";
    
    // Оновлюємо баланс гравця внизу
    document.getElementById('player-display-chips').innerText = userChips + "$";
    
    // Оновлюємо баланси ботів на столі
    document.querySelector('#bot1-status').nextElementSibling.innerText = botStacks.bot1 + "$";
    document.querySelector('#bot2-status').nextElementSibling.innerText = botStacks.bot2 + "$";
    document.querySelector('#bot3-status').nextElementSibling.innerText = botStacks.bot3 + "$";
}

// --- Крок 3: Обробник натискання кнопки Check / Call ---
document.addEventListener("DOMContentLoaded", () => {
    
    document.getElementById('btn-check').addEventListener('click', () => {
        if (!activePlayers.player) return; 

        if (currentBet === 0) {
            updateGameLog("😎 Ти сказав <b>Check</b> (Пропуск ходу).");
        } else {
            let callAmount = currentBet;
            if (userChips >= callAmount) {
                userChips -= callAmount;
                currentPot += callAmount;
                updateGameLog(`😎 Ти сказав <b>Call</b> і зрівняв ставку ${callAmount}$.`);
            } else {
                currentPot += userChips;
                updateGameLog(`😎 Ти поставив останні <b>${userChips}$ (All-in)!</b>`);
                userChips = 0;
            }
        }
        
        updateTableUI(); 
        
        setTimeout(startBotTurns, 1500);
    });

});

// --- Крок 4: Логіка ходу ботів ---
// --- Логіка ходу ботів ---
// --- Логіка ходу ботів ---
function startBotTurns() {
    if (activePlayers.bot1) {
        document.getElementById('bot1-status').innerText = "Ставить...";
        
        setTimeout(() => {
            let raiseAmount = 50; 
            botStacks.bot1 -= raiseAmount;
            currentPot += raiseAmount;
            currentBet = raiseAmount; 
            
            document.getElementById('bot1-status').innerText = "Bet: 50$";
            if (typeof triggerBotSpeech === "function") {
                triggerBotSpeech('bot1', '🔥 Піднімаю до 50$! Хто в грі?', 3000);
            }
            updateGameLog("🤖 <b>Бот 1 (Агр)</b> поставив Bet: 50$.");
            updateTableUI();
        }, 1000);
    }

    setTimeout(() => {
        if (activePlayers.bot2) {
            document.getElementById('bot2-status').innerText = "Думає...";
            
            setTimeout(() => {
                botStacks.bot2 -= currentBet;
                currentPot += currentBet;
                
                document.getElementById('bot2-status').innerText = "Call";
                if (typeof triggerBotSpeech === "function") {
                    triggerBotSpeech('bot2', 'Я в грі, підтримумую.', 3000);
                }
                updateGameLog("🤖 <b>Бот 2 (Профі)</b> сказав Call.");
                updateTableUI();

                // Виклик Флопу
                setTimeout(dealFlop, 2500);
            }, 1000);
        }
    }, 2500);
}

// --- Функція викладення Флопу ---
// --- ФУНКЦІЯ ВИКЛАДЕННЯ ФЛОПУ (Бере дані з Python) ---
function dealFlop() {
    updateGameLog("⏳ Дилер зв'язується із сервером...");

    // Смикаємо твій Python бекенд на Render
    fetch('https://cyberchips-poker.onrender.com/next_round')
        .then(res => res.json())
        .then(data => {
            // data.community_cards містить перші 3 карти
            const cards = data.community_cards;
            const communityCardElements = document.getElementById('community-cards').children;

            if (communityCardElements.length >= 3 && cards.length >= 3) {
                updateGameLog("⏳ Дилер відкриває <b>Флоп</b> (перші 3 карти на столі)...");

                for (let i = 0; i < 3; i++) {
                    communityCardElements[i].innerHTML = `<span class="${getCardColor(cards[i].suit)}">${cards[i].value}${cards[i].suit}</span>`;
                    communityCardElements[i].className = "w-10 h-14 sm:w-14 sm:h-20 bg-white text-black font-bold rounded-md flex items-center justify-center text-sm sm:text-lg shadow-md animate-card-appear";
                }
            }

            document.getElementById('bot1-status').innerText = "Думає...";
            document.getElementById('bot2-status').innerText = "Думає...";
            currentBet = 0;
            updateTableUI();
        })
        .catch(err => {
            updateGameLog("❌ Помилка сервера при отриманні Флопу. Перевірте Render.");
            console.error(err);
        });
}

// --- ФУНКЦІЯ ВИКЛАДЕННЯ ТЕРНУ (Бере дані з Python) ---
function dealTurn() {
    fetch('https://cyberchips-poker.onrender.com/next_round')
        .then(res => res.json())
        .then(data => {
            const cards = data.community_cards; 
            const turnCard = cards[3]; 
            const communityCardElements = document.getElementById('community-cards').children;

            if (communityCardElements.length >= 4 && turnCard) {
                updateGameLog("⏳ Дилер відкриває <b>Терн</b> (4-та карта на столі)...");
                communityCardElements[3].innerHTML = `<span class="${getCardColor(turnCard.suit)}">${turnCard.value}${turnCard.suit}</span>`;
                communityCardElements[3].className = "w-10 h-14 sm:w-14 sm:h-20 bg-white text-black font-bold rounded-md flex items-center justify-center text-sm sm:text-lg shadow-md animate-card-appear";
            }

            currentBet = 0;
            updateTableUI();

            setTimeout(() => {
                updateGameLog("🤖 Боти роблять фінальні чеки на Терні...");
                setTimeout(dealRiver, 2000);
            }, 1500);
        })
        .catch(err => console.error(err));
}

// --- ФУНКЦІЯ ВИКЛАДЕННЯ РІВЕРУ ---
function dealRiver() {
    fetch('https://cyberchips-poker.onrender.com/next_round')
        .then(res => res.json())
        .then(data => {
            const cards = data.community_cards; 
            const riverCard = cards[4]; 
            const communityCardElements = document.getElementById('community-cards').children;

            if (communityCardElements.length >= 5 && riverCard) {
                updateGameLog("⏳ Дилер відкриває <b>Рівер</b> (остання карта на столі!)...");
                communityCardElements[4].innerHTML = `<span class="${getCardColor(riverCard.suit)}">${riverCard.value}${riverCard.suit}</span>`;
                communityCardElements[4].className = "w-10 h-14 sm:w-14 sm:h-20 bg-white text-black font-bold rounded-md flex items-center justify-center text-sm sm:text-lg shadow-md animate-card-appear";
            }

            currentBet = 0;
            updateTableUI();

            setTimeout(determineWinner, 3000);
        })
        .catch(err => console.error(err));
}

// --- ФУНКЦІЯ ВИЗНАЧЕННЯ ПЕРЕМОЖЦЯ (Запит до розрахунків Python) ---
function determineWinner() {
    updateGameLog("🏁 <b>Шоудаун!</b> Сервер вираховує комбінації...");

    fetch('https://cyberchips-poker.onrender.com/determine_winner')
        .then(res => res.json())
        .then(data => {
            // Отримуємо з Python красивий готовий текст переможця
            const winnerText = data.winner_text;
            const winnerId = data.winner; // 'player', 'bot1', 'bot2' або 'bot3'

            // Зараховуємо фішки переможцю на фронтенді
            if (winnerId === 'player') {
                userChips += currentPot;
            } else if (winnerId === 'bot1') {
                botStacks.bot1 += currentPot;
            } else if (winnerId === 'bot2') {
                botStacks.bot2 += currentPot;
            } else if (winnerId === 'bot3') {
                if (!botStacks.bot3) botStacks.bot3 = 1000; // на випадок якщо бот3 не був створений
                botStacks.bot3 += currentPot;
            }

            // Виводимо в лог крутий вердикт сервера
            updateGameLog(`<span class="text-yellow-400 font-bold">${winnerText}</span>`);
            
            if (winnerId === 'player') {
                if (typeof triggerBotSpeech === "function") triggerBotSpeech('bot2', 'Гарна комбінація, я пасую перед цим.', 3000);
            } else {
                if (typeof triggerBotSpeech === "function") triggerBotSpeech(winnerId, 'Є бооой! Сервер підтвердив мою перемогу! 😎', 3000);
            }

            // Скидаємо банк
            currentPot = 0;
            currentBet = 0;
            updateTableUI();

            updateGameLog("🔄 Через 6 секунд розпочнеться новий раунд...");

            // Перезапуск столу
            setTimeout(() => {
                activePlayers.player = true;
                activePlayers.bot1 = true;
                activePlayers.bot2 = true;
                
                const communityCardElements = document.getElementById('community-cards').children;
                for (let i = 0; i < communityCardElements.length; i++) {
                    let name = i < 3 ? `Flop ${i+1}` : (i === 3 ? 'Turn' : 'River');
                    communityCardElements[i].innerHTML = name;
                    communityCardElements[i].className = "w-10 h-14 sm:w-14 sm:h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-[10px] sm:text-xs transition-all";
                }
                
                // ТУТ ВАЖЛИВО: новий раунд теж має починатися з виклику старту на Python!
                if (typeof startNewRound === "function") {
                    startNewRound();
                }
            }, 6000);
        })
        .catch(err => console.error(err));
}

// Функція відповіді ботів на підвищення ставки гравцем
// --- Логіка відповіді ботів на твій Raise ---
function startBotTurnsAfterPlayerRaise() {
    updateGameLog("🤖 Боти обмірковують твою ставку...");

    // Бот 1 (Агресор)
    setTimeout(() => {
        if (activePlayers.bot1) {
            if (botStacks.bot1 >= currentBet) {
                botStacks.bot1 -= currentBet;
                currentPot += currentBet;
                document.getElementById('bot1-status').innerText = "Call";
                if (typeof triggerBotSpeech === "function") {
                    triggerBotSpeech('bot1', 'Приймаю виклик, Call!', 2500);
                }
                updateGameLog("🤖 <b>Бот 1 (Агр)</b> сказав Call.");
            } else {
                activePlayers.bot1 = false;
                document.getElementById('bot1-status').innerText = "Fold";
                updateGameLog("🤖 <b>Бот 1 (Агр)</b> скинув карти (Fold).");
            }
            updateTableUI();
        }
    }, 1500);

    // Бот 2 (Профі)
    setTimeout(() => {
        if (activePlayers.bot2) {
            if (currentBet > 300) { 
                activePlayers.bot2 = false;
                document.getElementById('bot2-status').innerText = "Fold";
                if (typeof triggerBotSpeech === "function") {
                    triggerBotSpeech('bot2', 'Це занадто дорого для моїх карт. Пас.', 2500);
                }
                updateGameLog("🤖 <b>Бот 2 (Профі)</b> скинув карти (Fold).");
            } else {
                botStacks.bot2 -= currentBet;
                currentPot += currentBet;
                document.getElementById('bot2-status').innerText = "Call";
                updateGameLog("🤖 <b>Бот 2 (Профі)</b> сказав Call.");
            }
            updateTableUI();
            
            setTimeout(dealTurn, 2000);
        }
    }, 3000);
}