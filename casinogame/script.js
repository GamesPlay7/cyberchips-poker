// Змінні стану гри
let deck = [];
const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Стани ставок та раунду
let currentPot = 0;          // Поточний загальний банк
let currentBet = 0;          // Максимальна ставка в поточному колі
let botStacks = {            // Баланси ботів
    bot1: 1000,
    bot2: 1000,
    bot3: 1000
};
let activePlayers = {        // Хто ще в грі
    player: true,
    bot1: true,
    bot2: true,
    bot3: true
};

// --- СИНХРОНІЗАЦІЯ БАЛАНСУ З РУЛЕТКОЮ ЧЕРЕЗ LOCALSTORAGE ---
function getSharedBalance() {
    let balance = localStorage.getItem('casino_balance');
    if (balance === null) {
        balance = 1000; // Початковий баланс, якщо гри ще не було
        localStorage.setItem('casino_balance', balance);
    }
    return parseInt(balance);
}

function saveSharedBalance(amount) {
    localStorage.setItem('casino_balance', amount);
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
        "У мене занадто хороша рука, щоб чекать.",
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
    playerChips: getSharedBalance(), // Завантажуємо спільні кошти
    currentTurn: 0, 
    round: 'preflop', 
    activePlayers: [true, true, true, true]
};

const BASE_URL = "https://cyberchips-poker.onrender.com";

const potDisplay = document.getElementById('total-pot');
const btnFold = document.getElementById('btn-fold');
const btnCheck = document.getElementById('btn-check');
const btnRaise = document.getElementById('btn-raise');
const raiseAmountInput = document.getElementById('raise-amount');

window.onload = () => {
    console.log("♠️ Покерний клуб CyberChips готовий!");
    // Синхронізуємо баланс перед початком
    gameState.playerChips = getSharedBalance();
    startNewHand();
};

// --- ПОЧАТОК НОВОЇ РОЗДАЧІ ---
async function startNewHand() {
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.currentTurn = 0;
    gameState.round = 'preflop';
    gameState.activePlayers = [true, true, true, true];
    
    currentPot = 0;
    currentBet = 0;
    activePlayers.player = true;
    activePlayers.bot1 = true;
    activePlayers.bot2 = true;
    activePlayers.bot3 = true;
    
    // Оновлюємо баланс з пам'яті (про всяк випадок, якщо вкладку рулетки паралельно оновили)
    gameState.playerChips = getSharedBalance();

    if(document.getElementById('bot1-status')) document.getElementById('bot1-status').innerText = "Чекає...";
    if(document.getElementById('bot2-status')) document.getElementById('bot2-status').innerText = "Чекає...";
    if(document.getElementById('bot3-status')) document.getElementById('bot3-status').innerText = "Чекає...";

    clearCommunityCards();

    try {
        let response = await fetch(`${BASE_URL}/start_game`);
        let data = await response.json();
        
        const cardsContainer = document.getElementById('player-cards');
        if (cardsContainer) {
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
        }
    } catch (error) {
        console.error("Помилка сервера:", error);
    }

    updateTableUI();
    setControlsEnabled(true);
}

// --- ХІД ГРАВЦЯ ---
function handlePlayerAction(action) {
    if (gameState.currentTurn !== 0) return;

    if (action === 'fold') {
        gameState.activePlayers[0] = false;
        activePlayers.player = false;
        console.log("🔴 Ти скинув карти.");
    } else if (action === 'check') {
        console.log("⚪ Ти сказав Check/Call.");
    } else if (action === 'raise') {
        let amount = parseInt(raiseAmountInput.value);
        if (isNaN(amount)) amount = 25;
        gameState.pot += amount;
        gameState.playerChips -= amount;
        gameState.currentBet = amount;
        
        currentPot += amount;
        currentBet = amount;
        saveSharedBalance(gameState.playerChips); // Зберігаємо після зняття ставки
    }

    updateTableUI();
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
        if (botStatusElement) {
            botStatusElement.innerText = "Думає...";
            botStatusElement.classList.add('text-yellow-400', 'animate-pulse');
        }

        setTimeout(() => {
            if (botStatusElement) {
                botStatusElement.innerText = "Зробив хід ✅";
                botStatusElement.classList.remove('text-yellow-400', 'animate-pulse');
            }
            
            if (Math.random() < 0.15) {
                gameState.activePlayers[botIndex] = false;
                if(botIndex === 1) activePlayers.bot1 = false;
                if(botIndex === 2) activePlayers.bot2 = false;
                if(botIndex === 3) activePlayers.bot3 = false;
                if (botStatusElement) botStatusElement.innerText = "Fold 🔴";
            } else {
                gameState.pot += 25;
                currentPot += 25;
            }
            updateTableUI();
            nextTurn();
        }, 3500); 
    } else {
        nextTurn();
    }
}

// --- ПЕРЕХІД МІЖ РАУНДАМИ ---
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

function renderCommunityCards(cards) {
    const tableCenter = document.querySelector('.poker-table .flex');
    if (!tableCenter) return;
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
    if (!tableCenter) return;
    tableCenter.innerHTML = `
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Flop 1</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Flop 2</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Flop 3</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">Turn</div>
        <div class="w-14 h-20 bg-white/10 rounded-md border border-dashed border-white/30 flex items-center justify-center text-gray-500 text-xs">River</div>
    `;
}

function setControlsEnabled(enabled) {
    if(!btnFold || !btnCheck || !btnRaise) return;
    btnFold.disabled = !enabled;
    btnCheck.disabled = !enabled;
    btnRaise.disabled = !enabled;
    const opacityAction = enabled ? 'remove' : 'add';
    btnFold.classList[opacityAction]('opacity-50', 'cursor-not-allowed');
    btnCheck.classList[opacityAction]('opacity-50', 'cursor-not-allowed');
    btnRaise.classList[opacityAction]('opacity-50', 'cursor-not-allowed');
}

function updateGameLog(message) {
    const logBox = document.getElementById('game-log');
    if (logBox) {
        logBox.innerHTML += `<div>• ${message}</div>`;
        logBox.scrollTop = logBox.scrollHeight;
    }
}

// --- ФУНКЦІЯ ОНОВЛЕННЯ БАНКУ ТА СПІЛЬНИХ КОШТІВ НА ЕКРАНІ ---
function updateTableUI() {
    // Оновлення загального банку покеру
    if (document.getElementById('total-pot')) {
        document.getElementById('total-pot').innerText = currentPot + "$";
    }
    
    // Синхронне відображення кредитів/балансу у всіх можливих елементах HTML
    const playerChipsElement = document.getElementById('player-display-chips');
    const playerCreditsElement = document.getElementById('player-credits');
    const sharedBalanceText = gameState.playerChips + "$";

    if (playerChipsElement) playerChipsElement.innerText = sharedBalanceText;
    if (playerCreditsElement) playerCreditsElement.innerText = sharedBalanceText;
    
    // Пошук за класом, якщо ID не знайдені
    const fallbackChips = document.querySelector('.text-xl.font-black.text-yellow-400');
    if (fallbackChips) fallbackChips.innerText = sharedBalanceText;
    
    // Оновлення стеку ботів
    if(document.querySelector('#bot1-status') && document.querySelector('#bot1-status').nextElementSibling) {
        document.querySelector('#bot1-status').nextElementSibling.innerText = botStacks.bot1 + "$";
    }
    if(document.querySelector('#bot2-status') && document.querySelector('#bot2-status').nextElementSibling) {
        document.querySelector('#bot2-status').nextElementSibling.innerText = botStacks.bot2 + "$";
    }
    if(document.querySelector('#bot3-status') && document.querySelector('#bot3-status').nextElementSibling) {
        document.querySelector('#bot3-status').nextElementSibling.innerText = botStacks.bot3 + "$";
    }
}

// --- ІНІЦІАЛІЗАЦІЯ КЛІКІВ ПІСЛЯ ЗАВАНТАЖЕННЯ СТОРІНКИ ---
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Кнопка CHECK / CALL
    if(document.getElementById('btn-check')) {
        document.getElementById('btn-check').addEventListener('click', () => {
            if (!activePlayers.player) return; 

            if (currentBet === 0) {
                updateGameLog("😎 Ти сказав <b>Check</b> (Пропуск ходу).");
            } else {
                let callAmount = currentBet;
                if (gameState.playerChips >= callAmount) {
                    gameState.playerChips -= callAmount;
                    currentPot += callAmount;
                    updateGameLog(`😎 Ти сказав <b>Call</b> і зрівняв ставку ${callAmount}$.`);
                } else {
                    currentPot += gameState.playerChips;
                    updateGameLog(`😎 Ти поставив останні <b>${gameState.playerChips}$ (All-in)!</b>`);
                    gameState.playerChips = 0;
                }
                saveSharedBalance(gameState.playerChips); // Зберігаємо оновлені спільні кошти
            }
            
            updateTableUI(); 
            setTimeout(startBotTurns, 1500);
        });
    }

    // 2. Кнопка RAISE
    if(document.getElementById('btn-raise')) {
        document.getElementById('btn-raise').addEventListener('click', () => {
            if (!activePlayers.player) return;

            let raiseInput = parseInt(document.getElementById('raise-amount').value);
            
            if (isNaN(raiseInput) || raiseInput < currentBet + 25) {
                raiseInput = currentBet + 25;
            }

            if (gameState.playerChips >= raiseInput) {
                gameState.playerChips -= raiseInput;
                currentPot += raiseInput;
                currentBet = raiseInput; 
                
                saveSharedBalance(gameState.playerChips); // Зберігаємо оновлені спільні кошти
                updateGameLog(`😎 Ти зробив <b>Raise</b> до <b>${raiseInput}$</b>!`);
                updateTableUI();

                setTimeout(startBotTurnsAfterPlayerRaise, 1500);
            } else {
                updateGameLog("❌ Недостатньо фішок для такої ставки!");
            }
        });
    }
});

// --- ЛОГІКА ХОДУ БОТІВ ---
function startBotTurns() {
    if (activePlayers.bot1) {
        if(document.getElementById('bot1-status')) document.getElementById('bot1-status').innerText = "Ставить...";
        
        setTimeout(() => {
            let raiseAmount = 50; 
            botStacks.bot1 -= raiseAmount;
            currentPot += raiseAmount;
            currentBet = raiseAmount; 
            
            if(document.getElementById('bot1-status')) document.getElementById('bot1-status').innerText = "Bet: 50$";
            updateGameLog("🤖 <b>Бот 1 (Агр)</b> поставив Bet: 50$.");
            updateTableUI();
        }, 1000);
    }

    setTimeout(() => {
        if (activePlayers.bot2) {
            if(document.getElementById('bot2-status')) document.getElementById('bot2-status').innerText = "Думає...";
            
            setTimeout(() => {
                botStacks.bot2 -= currentBet;
                currentPot += currentBet;
                
                if(document.getElementById('bot2-status')) document.getElementById('bot2-status').innerText = "Call";
                updateGameLog("🤖 <b>Бот 2 (Профі)</b> сказав Call.");
                updateTableUI();

                setTimeout(dealFlop, 2500);
            }, 1000);
        }
    }, 2500);
}

function startBotTurnsAfterPlayerRaise() {
    updateGameLog("🤖 Боти обмірковують твою ставку...");

    setTimeout(() => {
        if (activePlayers.bot1) {
            if (botStacks.bot1 >= currentBet) {
                botStacks.bot1 -= currentBet;
                currentPot += currentBet;
                if(document.getElementById('bot1-status')) document.getElementById('bot1-status').innerText = "Call";
                updateGameLog("🤖 <b>Бот 1 (Агр)</b> сказав Call.");
            } else {
                activePlayers.bot1 = false;
                gameState.activePlayers[1] = false;
                if(document.getElementById('bot1-status')) document.getElementById('bot1-status').innerText = "Fold";
                updateGameLog("🤖 <b>Бот 1 (Агр)</b> скинув карти (Fold).");
            }
            updateTableUI();
        }
    }, 1500);

    setTimeout(() => {
        if (activePlayers.bot2) {
            if (currentBet > 300) { 
                activePlayers.bot2 = false;
                gameState.activePlayers[2] = false;
                if(document.getElementById('bot2-status')) document.getElementById('bot2-status').innerText = "Fold";
                updateGameLog("🤖 <b>Бот 2 (Профі)</b> скинув карти (Fold).");
            } else {
                botStacks.bot2 -= currentBet;
                currentPot += currentBet;
                if(document.getElementById('bot2-status')) document.getElementById('bot2-status').innerText = "Call";
                updateGameLog("🤖 <b>Бот 2 (Профі)</b> сказав Call.");
            }
            updateTableUI();
            setTimeout(dealFlop, 2000);
        }
    }, 3000);
}

// --- РОЗДАЧА ФЛОП, ТЕРН, РІВЕР ТА ВИГРАШ ---
function dealFlop() {
    updateGameLog("⏳ Дилер зв'язується із сервером...");
    fetch(`${BASE_URL}/next_round`)
        .then(res => res.json())
        .then(data => {
            const cards = data.community_cards;
            const communityCardElements = document.getElementById('community-cards') ? document.getElementById('community-cards').children : [];

            if (communityCardElements.length >= 3 && cards.length >= 3) {
                updateGameLog("⏳ Дилер відкриває <b>Флоп</b>...");
                for (let i = 0; i < 3; i++) {
                    let color = (cards[i].suit === '♦' || cards[i].suit === '♥') ? 'text-red-500' : 'text-black';
                    communityCardElements[i].innerHTML = `<span class="${color}">${cards[i].value}${cards[i].suit}</span>`;
                }
            }
            currentBet = 0;
            updateTableUI();
            setTimeout(dealTurn, 4000);
        }).catch(err => console.error(err));
}

function dealTurn() {
    fetch(`${BASE_URL}/next_round`)
        .then(res => res.json())
        .then(data => {
            const cards = data.community_cards; 
            const turnCard = cards[3]; 
            const communityCardElements = document.getElementById('community-cards') ? document.getElementById('community-cards').children : [];

            if (communityCardElements.length >= 4 && turnCard) {
                updateGameLog("⏳ Дилер відкриває <b>Терн</b>...");
                let color = (turnCard.suit === '♦' || turnCard.suit === '♥') ? 'text-red-500' : 'text-black';
                communityCardElements[3].innerHTML = `<span class="${color}">${turnCard.value}${turnCard.suit}</span>`;
            }
            currentBet = 0;
            updateTableUI();
            setTimeout(dealRiver, 4000);
        }).catch(err => console.error(err));
}

function dealRiver() {
    fetch(`${BASE_URL}/next_round`)
        .then(res => res.json())
        .then(data => {
            const cards = data.community_cards; 
            const riverCard = cards[4]; 
            const communityCardElements = document.getElementById('community-cards') ? document.getElementById('community-cards').children : [];

            if (communityCardElements.length >= 5 && riverCard) {
                updateGameLog("⏳ Дилер відкриває <b>Рівер</b>...");
                let color = (riverCard.suit === '♦' || riverCard.suit === '♥') ? 'text-red-500' : 'text-black';
                communityCardElements[4].innerHTML = `<span class="${color}">${riverCard.value}${riverCard.suit}</span>`;
            }
            currentBet = 0;
            updateTableUI();
            setTimeout(determineWinner, 3000);
        }).catch(err => console.error(err));
}

function determineWinner() {
    updateGameLog("🏁 <b>Шоудаун!</b> Сервер вираховує комбінації...");

    fetch(`${BASE_URL}/determine_winner`)
        .then(res => res.json())
        .then(data => {
            const winnerId = data.winner;

            if (winnerId === 'player') {
                gameState.playerChips += currentPot;
            } else if (winnerId === 'bot1') {
                botStacks.bot1 += currentPot;
            } else if (winnerId === 'bot2') {
                botStacks.bot2 += currentPot;
            } else if (winnerId === 'bot3') {
                botStacks.bot3 += currentPot;
            }

            // ЗБЕРІГАЄМО НОВИЙ СИНХРОНІЗОВАНИЙ БАЛАНС ПІСЛЯ ВИГРАШУ
            saveSharedBalance(gameState.playerChips);

            updateGameLog(`<span class="text-yellow-400 font-bold">${data.winner_text}</span>`);
            
            currentPot = 0;
            currentBet = 0;
            updateTableUI();

            updateGameLog("🔄 Через 6 секунд розпочнеться новий раунд...");
            setTimeout(() => {
                startNewHand();
            }, 6000);
        }).catch(err => console.error(err));
}