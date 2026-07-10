const BASE_URL = "https://cyberchips-poker.onrender.com";

const WHEEL_NUMBERS = [
    "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15", "3", "24", "36", "13", "1",
    "00", "27", "10", "25", "29", "12", "8", "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2"
];

let selectedBetType = null;
let currentRotation = 0;
const anglePerSector = 360 / WHEEL_NUMBERS.length;

let isRegisterMode = false; // Стежить за режимом: Вхід або Реєстрація

function getNumberColor(num) {
    if (num === "0" || num === "00") return "green";
    const redNumbers = ["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"];
    return redNumbers.includes(num) ? "red" : "black";
}

// 1. ГЕНЕРАЦІЯ КОЛЕСА
const wheelElement = document.getElementById("roulette-wheel");
if (wheelElement) {
    WHEEL_NUMBERS.forEach((num, index) => {
        const sector = document.createElement("div");
        sector.className = `wheel-sector sector-${getNumberColor(num)}`;
        const rotateAngle = index * anglePerSector;
        sector.style.transform = `rotate(${rotateAngle}deg)`;
        sector.innerHTML = `<span>${num}</span>`;
        wheelElement.appendChild(sector);
    });
}

// ==================================================
// 🔐 СИСТЕМА АВТОРИЗАЦІЇ, РЕЄСТРАЦІЇ ТА ЛОКАЛЬНОЇ ПАМ'ЯТІ
// ==================================================

// Перемикання режимів модального вікна (Вхід / Реєстрація)
function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById("auth-title");
    const subtitle = document.getElementById("auth-subtitle");
    const submitBtn = document.getElementById("auth-submit-btn");
    const toggleDesc = document.getElementById("auth-toggle-desc");
    const toggleBtn = document.getElementById("auth-toggle-btn");
    const errorMsg = document.getElementById("auth-error");
    
    errorMsg.classList.add("hidden");

    if (isRegisterMode) {
        title.innerText = "Реєстрація акаунту";
        subtitle.innerText = "Створіть унікальний нікнейм та пароль";
        submitBtn.innerText = "Зареєструватися 🎉";
        toggleDesc.innerText = "Вже маєте акаунт?";
        toggleBtn.innerText = "Увійти";
    } else {
        title.innerText = "Вхід у Казино";
        subtitle.innerText = "Введіть свій нікнейм та пароль для синхронізації балансу";
        submitBtn.innerText = "Увійти 🚀";
        toggleDesc.innerText = "Ще не маєте акаунту?";
        toggleBtn.innerText = "Зареєструватися";
    }
}

// Функція відправки даних форми авторизації
async function handleAuthSubmit() {
    const usernameInput = document.getElementById("auth-username").value.trim();
    const passwordInput = document.getElementById("auth-password").value.trim();
    const errorMsg = document.getElementById("auth-error");

    if (!usernameInput || !passwordInput) {
        errorMsg.innerText = "Заповніть всі поля!";
        errorMsg.classList.remove("hidden");
        return;
    }

    const endpoint = isRegisterMode ? "/register" : "/login";

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (!response.ok) {
            errorMsg.innerText = data.detail || "Сталася помилка";
            errorMsg.classList.remove("hidden");
            return;
        }

        // Успішно! Зберігаємо нік у пам'ять браузера (localStorage)
        localStorage.setItem("casino_username", data.username);
        
        // Сховуємо модальне вікно та оновлюємо інтерфейс
        document.getElementById("auth-modal").classList.add("hidden");
        updateProfileUI(data.username, data.balance, data.credits_taken);

    } catch (e) {
        errorMsg.innerText = "Не вдалося з'єднатися з сервером.";
        errorMsg.classList.remove("hidden");
    }
}

// Завантаження профілю або перевірка, чи гравець уже увійшов
async function checkAuth() {
    const savedUsername = localStorage.getItem("casino_username");

    if (!savedUsername) {
        // Якщо нікого немає в пам'яті — показуємо форму входу
        document.getElementById("auth-modal").classList.remove("hidden");
        return;
    }

    // Якщо нікнейм є, автоматично ховаємо форму й беремо свіжі дані з бази через пустий пароль на login
    document.getElementById("auth-modal").classList.add("hidden");
    try {
        const response = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: savedUsername, password: "" }) 
        });

        // Якщо сесія на сервері застаріла чи скинулась база — робимо логаут
        if (!response.ok) {
            // Для тестів (оскільки наш бекенд зараз приймає будь-який пароль або перевіряє точний, 
            // ми просто витягнемо дані. Якщо виникне збій бази, скинемо кеш):
            logout();
            return;
        }

        const data = await response.json();
        updateProfileUI(data.username, data.balance, data.credits_taken);

    } catch (error) {
        console.error("Помилка синхронізації:", error);
    }
}

function updateProfileUI(username, balance, creditsTaken) {
    document.getElementById("user-name").innerText = username;
    document.getElementById("balance-display").innerText = `${balance}$`;
    document.getElementById("credits-count").innerText = creditsTaken;
    document.getElementById("debt-amount").innerText = `${creditsTaken * 1000}$`;

    const creditBtn = document.getElementById("credit-btn");
    if (balance === 0) {
        creditBtn.classList.remove("hidden");
    } else {
        creditBtn.classList.add("hidden");
    }
}

// Вихід з акаунту
function logout() {
    localStorage.removeItem("casino_username");
    document.getElementById("auth-username").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-modal").classList.remove("hidden");
}

// Слухач кнопки кредиту
document.getElementById("credit-btn").addEventListener("click", async () => {
    const savedUsername = localStorage.getItem("casino_username");
    try {
        const response = await fetch(`${BASE_URL}/take_credit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: savedUsername })
        });

        const data = await response.json();
        if (response.ok) {
            alert("💵 Тобі видано кредит 1000$!");
            updateProfileUI(savedUsername, data.balance, data.credits_taken);
        } else {
            alert(data.detail);
        }
    } catch (error) {
        alert("Помилка сервера при отриманні кредиту.");
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
    const savedUsername = localStorage.getItem("casino_username");
    if (!savedUsername) {
        alert("Будь ласка, спочатку авторизуйтесь!");
        return;
    }

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

    document.getElementById("spin-btn").disabled = true;

    try {
        const response = await fetch(`${BASE_URL}/roulette/spin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: savedUsername, 
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

        const targetSectorIndex = data.wheel_index;
        const targetAngle = targetSectorIndex * anglePerSector;
        const extraRotations = 5 * 360;
        
        currentRotation += extraRotations - (currentRotation % 360) - targetAngle;
        wheelElement.style.transform = `rotate(${currentRotation}deg)`;

        setTimeout(() => {
            const currentCredits = parseInt(document.getElementById("credits-count").innerText);
            updateProfileUI(savedUsername, data.new_balance, currentCredits);

            const colorEmoji = data.winning_color === "red" ? "🔴" : data.winning_color === "black" ? "⚫" : "🟢";
            let resultText = `• Випало: ${colorEmoji} ${data.winning_number}. `;
            
            if (data.is_win) {
                resultText += `<span class="text-green-400 font-bold">Ти виграв ${data.win_amount}$! 🎉</span>`;
            } else {
                resultText += `<span class="text-red-400 font-bold">Програш. Мінус ${betAmount}$ 😢</span>`;
            }

            logElement.innerHTML = `<div>${resultText}</div>` + logElement.innerHTML;
            document.getElementById("spin-btn").disabled = false;
        }, 5000);

    } catch (error) {
        console.error(error);
        alert("Помилка зв'язку з сервером.");
        document.getElementById("spin-btn").disabled = false;
    }
}

// Запускаємо перевірку авторизації при старті
checkAuth();