const BASE_URL = "https://cyberchips-poker.onrender.com";
// Порядок чисел на американському колесі (має збігатися з Python!)
const WHEEL_NUMBERS = [
    "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15", "3", "24", "36", "13", "1",
    "00", "27", "10", "25", "29", "12", "8", "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2"
];

let currentBalance = 1000;
let selectedBetType = null;
let currentRotation = 0; // Стежимо за поточним кутом повороту

// Функція визначення кольору для малювання колеса
function getNumberColor(num) {
    if (num === "0" || num === "00") return "green";
    const redNumbers = ["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"];
    return redNumbers.includes(num) ? "red" : "black";
}

// 1. ГЕНЕРАЦІЯ КОЛЕСА (Малюємо 38 секторів)
const wheelElement = document.getElementById("roulette-wheel");
const totalSectors = WHEEL_NUMBERS.length;
const anglePerSector = 360 / totalSectors; // ~9.47 градусів на один сектор

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

// 2. ВИБІР ТИПУ СТАВКИ
function setBetType(type) {
    selectedBetType = type;
    // Скидаємо підсвітку з усіх кнопок
    document.querySelectorAll("button[id^='bet-']").forEach(btn => btn.classList.remove("active-bet"));
    // Додаємо підсвітку активній
    document.getElementById(`bet-${type}`).classList.add("active-bet");
    // Очищаємо поле числа, якщо вибрали колір/парність
    document.getElementById("bet-number-val").value = "";
}

// 3. ЗАПУСК РУЛЕТКИ
async function spinWheel() {
    const betAmountInput = document.getElementById("bet-amount");
    const betAmount = parseInt(betAmountInput.value);
    const betNumberVal = document.getElementById("bet-number-val").value.trim();
    const logElement = document.getElementById("roulette-log");

    // Перевірка ставки на число
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

    if (betAmount > currentBalance || betAmount <= 0) {
        alert("Недостатньо балансу або неправильна сума ставки!");
        return;
    }

    // Тимчасово вимикаємо кнопку
    document.getElementById("spin-btn").disabled = true;

    try {
        // Запит до нашого оновленого Python-бекенду
        const response = await fetch(`${BASE_URL}/roulette/spin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
        // Рахуємо кут: щоб число опинилося вгорі (на 12 годин), колесо треба повернути назад
        const targetSectorIndex = data.wheel_index;
        const targetAngle = targetSectorIndex * anglePerSector;
        
        // Робимо 5 повних обертів (5 * 360) + крутимо до потрібного сектора (назад, тому мінус)
        const extraRotations = 5 * 360;
        currentRotation += extraRotations - (currentRotation % 360) - targetAngle;

        wheelElement.style.transform = `rotate(${currentRotation}deg)`;

        // Чекаємо 5 секунд (поки триває CSS анімація transition-duration-[5s])
        setTimeout(() => {
            // Оновлюємо баланс
            currentBalance += data.profit;
            document.getElementById("balance-display").innerText = `${currentBalance}$`;

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