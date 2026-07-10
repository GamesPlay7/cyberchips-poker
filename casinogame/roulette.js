const BASE_URL = "https://cyberchips-poker.onrender.com";

// Порядок чисел на американському колесі (має збігатися з Python!)
const WHEEL_NUMBERS = [
    "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15", "3", "24", "36", "13", "1",
    "00", "27", "10", "25", "29", "12", "8", "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2"
];

const CURRENT_USER = "Player1"; // Фіксований нікнейм для тестів
let selectedBetType = null;
let currentRotation = 0; // Стежимо за поточним кутом повороту
const anglePerSector = 360 / WHEEL_NUMBERS.length; // ~9.47 градусів на один сектор

// Функція визначення кольору для малювання колеса
function getNumberColor(num) {
    if (num === "0" || num === "00") return "green";
    const redNumbers = ["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"];
    return redNumbers.includes(num) ? "red" : "black";
}

// 1. ГЕНЕРАЦІЯ КОЛЕСА (Малюємо 38 секторів)
const wheelElement = document.getElementById("roulette-wheel");
if (wheelElement) {
    WHEEL_NUMBERS.forEach((num, index) => {
        const sector = document.createElement("div");
        sector.className = `wheel-sector sector-${getNumberColor(num)}`;
        
        // Повертаємо кожен сектор на свій кут
        const rotateAngle = index * anglePerSector;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        
        // Текст всередині сектора
        sector.innerHTML = `<span>${num}</span>`;
        wheelElement.appendChild(sector);
    });
}

// ==================================================
// 👤 НОВА СИСТЕМА ПРОФІЛЮ ТА СИНХРОНІЗАЦІЇ З БД
// ==================================================

// Автоматичний вхід/реєстрація при завантаженні сторінки
async function initUserProfile() {
    try {
        let response = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: CURRENT_USER, password: "testpassword" })
        });

        if (!response.ok) {
            // Якщо користувача немає, реєструємо його
            response = await fetch(`${BASE_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: CURRENT_USER, password: "testpassword" })
            });
        }

        const data = await response.json();
        updateProfileUI(data.username, data.balance, data.credits_taken);

    } catch (error) {
        console.error("Помилка при ініціалізації профілю:", error);
    }
}

// Оновлення текстових елементів інтерфейсу
function updateProfileUI(username, balance, creditsTaken) {
    document.getElementById("user-name").innerText = username;
    document.getElementById("balance-display").innerText = `${balance}$`;
    document.getElementById("credits-count").innerText = creditsTaken;
    document.getElementById("debt-amount").innerText = `${creditsTaken * 1000}$`;

    // Показуємо кнопку кредиту ТІЛЬКИ якщо баланс впав до 0
    const creditBtn = document.getElementById("credit-btn");
    if (balance === 0) {
        creditBtn.classList.remove("hidden");
    } else {
        creditBtn.classList.add("hidden");
    }
}

// Слухач події для кнопки "Взяти кредит"
document.getElementById("credit-btn").addEventListener("click", async () => {
    try {
        const response = await fetch(`${BASE_URL}/take_credit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: CURRENT_USER })
        });

        const data = await response.json();
        if (response.ok) {
            alert("💵 Тобі видано кредит 1000$! Твій борг казино збільшився.");
            updateProfileUI(CURRENT_USER, data.balance, data.credits_taken);
        } else {
            alert(data.detail);
        }
    } catch (error) {
        alert("Не вдалося отримати кредит з сервера.");
    }
});


// 2. ВИБІР ТИПУ СТАВКИ
function setBetType(type) {
    selectedBetType = type;
    document.querySelectorAll("button[id^='bet-']").forEach(btn => btn.classList.remove("active-bet", "ring-4", "ring-yellow-400"));
    document.getElementById(`bet-${type}`).classList.add("active-bet", "ring-4", "ring-yellow-400");
    document.getElementById("bet-number-val").value = "";
}

// 3. ЗАПУСК РУЛЕТКИ
async function spinWheel() {
    const betAmountInput = document.getElementById("bet-amount");
    const betAmount = parseInt(betAmountInput.value);
    const betNumberVal = document.getElementById("bet-number-val").value.trim();
    const logElement = document.getElementById("roulette-log");

    let betType = selectedBetType;
    let betValue = "";
    
    if (betNumberVal !== "") {
        if (!WHEEL_NUMBERS.includes(betNumberVal)) {
            alert("Введіть правильне число американської рулетки (0, 00 або від 1 до 36)!");
            return;
        }
        betType = "number";
        betValue = betNumberVal;
    }

    if (!betType) {
        alert("Будь ласка, оберіть тип ставки або введіть число!");
        return;
    }

    if (betAmount <= 0) {
        alert("Введіть правильну суму ставки!");
        return;
    }

    // Тимчасово вимикаємо кнопку
    document.getElementById("spin-btn").disabled = true;

    try {
        // Надсилаємо запит на сервер із назвою нашого юзера
        const response = await fetch(`${BASE_URL}/roulette/spin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: CURRENT_USER, 
                bet_type: betType,
                bet_value: betValue,
                bet_amount: betAmount
            })
        });

        const data = await response.json();

        if (response.status !== 200) {
            alert(data.detail || "Помилка сервера");
            document.getElementById("spin-btn").disabled = false;
            return;
        }

        // --- МАГІЯ ОБЕРТАННЯ ---
        const targetSectorIndex = data.wheel_index;
        const targetAngle = targetSectorIndex * anglePerSector;
        const extraRotations = 5 * 360;
        
        currentRotation += extraRotations - (currentRotation % 360) - targetAngle;
        wheelElement.style.transform = `rotate(${currentRotation}deg)`;

        // Чекаємо 5 секунд, поки колесо крутиться
        setTimeout(() => {
            // Беремо поточну кількість кредитів з екрана, щоб UI не скидався
            const currentCredits = parseInt(document.getElementById("credits-count").innerText);
            
            // Оновлюємо інтерфейс даними, що прийшли з бази даних бекенду
            updateProfileUI(CURRENT_USER, data.new_balance, currentCredits);

            // Виводимо результат в лог
            const colorEmoji = data.winning_color === "red" ? "🔴" : data.winning_color === "black" ? "⚫" : "🟢";
            let resultText = `• Випало: ${colorEmoji} ${data.winning_number}. `;
            
            if (data.is_win) {
                resultText += `<span class="text-green-400 font-bold">Ти виграв ${data.win_amount}$! 🎉</span>`;
            } else {
                resultText += `<span class="text-red-400 font-bold">Програш. Мінус ${betAmount}$ 😢</span>`;
            }

            logElement.innerHTML = `<div>${resultText}</div>` + logElement.innerHTML;
            
            // Вмикаємо кнопку назад
            document.getElementById("spin-btn").disabled = false;
        }, 5000);

    } catch (error) {
        console.error(error);
        alert("Не вдалося зв'язатися з сервером. Перевір, чи запущений Python!");
        document.getElementById("spin-btn").disabled = false;
    }
}

// Запускаємо профіль при відкритті
initUserProfile();