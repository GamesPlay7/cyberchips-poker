// --- СТАН ГРИ (Зберігається в браузері) ---
let gameState = {
    pot: 0,
    currentBet: 0,
    playerChips: 1000,
    currentTurn: 0, // 0 = Гравець, 1 = Бот 1, 2 = Бот 2, 3 = Бот 3
    round: 'preflop', // preflop, flop, turn, river
    activePlayers: [true, true, true, true] // Хто ще в грі (не скинув карти)
};

// --- ЕЛЕМЕНТИ ІНТЕРФЕЙСУ ---
const potDisplay = document.getElementById('total-pot');
const btnFold = document.getElementById('btn-fold');
const btnCheck = document.getElementById('btn-check');
const btnRaise = document.getElementById('btn-raise');
const raiseAmountInput = document.getElementById('raise-amount');

// --- ІНІЦІАЛІЗАЦІЯ ГРИ ---
window.onload = () => {
    console.log("♠️ Покерний клуб CyberChips готовий!");
    setupEventListeners();
    startNewHand();
};

// --- СЛУХАЧІ КЛІКІВ МИШКИ ---
function setupEventListeners() {
    btnFold.addEventListener('click', () => handlePlayerAction('fold'));
    btnCheck.addEventListener('click', () => handlePlayerAction('check'));
    btnRaise.addEventListener('click', () => handlePlayerAction('raise'));
}

function startNewHand() {
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.currentTurn = 0; // Починає завжди гравець
    gameState.activePlayers = [true, true, true, true];
    updateUI();
    
    // Оскільки зараз хід гравця, кнопки активні
    setControlsEnabled(true);
}

// --- ОБРОБКА ХОДУ ГРАВЦЯ (МИШКА) ---
function handlePlayerAction(action) {
    if (gameState.currentTurn !== 0) return; // Не твій хід — ігнор

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
        console.log(`🔥 Ти підняв ставку на ${amount}$`);
    }

    updateUI();
    setControlsEnabled(false); // Вимикаємо кнопки гравця
    nextTurn();
}

// --- СИСТЕМА ЧЕРГИ ТА "ДУМАННЯ" БОТІВ ---
function nextTurn() {
    // Переходимо до наступного гравця за столом
    gameState.currentTurn = (gameState.currentTurn + 1) % 4;

    // Якщо коло замкнулося і знову хід гравця
    if (gameState.currentTurn === 0) {
        if (gameState.activePlayers[0]) {
            setControlsEnabled(true); // Вмикаємо керування мишкою гравцю
            return;
        } else {
            // Якщо гравець скинув, боти грають між собою далі
            nextTurn();
            return;
        }
    }

    // ЛОГІКА ХОДУ БОТІВ (Імітація мислення)
    let botIndex = gameState.currentTurn;
    if (gameState.activePlayers[botIndex]) {
        let botStatusElement = document.getElementById(`bot${botIndex}-status`);
        
        // 1. Порождаємо затримку: статус міняється на "Думає..."
        botStatusElement.innerText = "Думає...";
        botStatusElement.classList.add('text-yellow-400', 'animate-pulse');

        // 2. Через 2 секунди (2000 мілісекунд) бот робить хід
        setTimeout(() => {
            botStatusElement.innerText = "Зробив хід ✅";
            botStatusElement.classList.remove('text-yellow-400', 'animate-pulse');
            
            // Спрощена логіка: бот або колить, або фолдить з шансом 15%
            if (Math.random() < 0.15) {
                gameState.activePlayers[botIndex] = false;
                botStatusElement.innerText = "Fold 🔴";
            } else {
                gameState.pot += 50; // Імітація ставки бота
            }

            updateUI();
            nextTurn(); // Передаємо хід далі
        }, 2000); 
    } else {
        // Якщо цей бот уже скинув карти, одразу переходимо до наступного
        nextTurn();
    }
}

// --- ОНОВЛЕННЯ ЕКРАНУ ---
function updateUI() {
    potDisplay.innerText = `${gameState.pot}$`;
    document.querySelector('.text-xl.font-black.text-yellow-400').innerText = `${gameState.playerChips}$`;
}

// --- БЛОКУВАННЯ КНОПОК ---
function setControlsEnabled(enabled) {
    if (enabled) {
        btnFold.disabled = false;
        btnCheck.disabled = false;
        btnRaise.disabled = false;
        btnFold.classList.remove('opacity-50', 'cursor-not-allowed');
        btnCheck.classList.remove('opacity-50', 'cursor-not-allowed');
        btnRaise.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnFold.disabled = true;
        btnCheck.disabled = true;
        btnRaise.disabled = true;
        btnFold.classList.add('opacity-50', 'cursor-not-allowed');
        btnCheck.classList.add('opacity-50', 'cursor-not-allowed');
        btnRaise.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

async function startNewHand() {
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.currentTurn = 0;
    gameState.activePlayers = [true, true, true, true];
    
    // Очищуємо статуси ботів на екрані
    document.getElementById('bot1-status').innerText = "Чекає...";
    document.getElementById('bot2-status').innerText = "Чекає...";
    document.getElementById('bot3-status').innerText = "Чекає...";

    try {
        // Запитуємо карти у нашого Python-сервера
        let response = await fetch('http://127.0.0.1:8000/start_game');
        let data = await response.json();
        
        // Виводимо отримані карти на екран гравцю
        const cardsContainer = document.getElementById('player-cards');
        cardsContainer.innerHTML = ''; // Очистити старі карти
        
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
        console.error("Помилка зв'язку з Python сервером:", error);
    }

    updateUI();
    setControlsEnabled(true);
}