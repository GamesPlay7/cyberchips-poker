import random
import time
import sqlite3
from collections import Counter
from datetime import datetime
import zoneinfo
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Дозволяємо фронтенду робити запити до нашого сервера
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "casino.db"

# ==========================================
# 🗄️ РОБОТА З БАЗОЮ ДАНИХ (SQLite)
# ==========================================

def init_db():
    """Створення таблиці користувачів, якщо вона не існує"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            balance INTEGER DEFAULT 1000,
            credits_taken INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

# Ініціалізуємо БД при запуску сервера
init_db()


# ==========================================
# 📊 СИСТЕМА ЛОГУВАННЯ ВІДВІДУВАЧІВ
# ==========================================

@app.middleware("http")
async def log_visitor_activity(request: Request, call_next):
    ukraine_tz = zoneinfo.ZoneInfo("Europe/Kyiv")
    current_time = datetime.now(ukraine_tz).strftime("%Y-%m-%d %H:%M:%S")
    
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else "Unknown IP"
        
    user_agent = request.headers.get("User-Agent", "Unknown Device")
    endpoint = request.url.path
    method = request.method

    start_time = time.time()
    response = await call_next(request)
    process_time = round((time.time() - start_time) * 1000, 2)

    log_entry = (
        f"[{current_time}] | IP: {ip_address} | {method} {endpoint} | "
        f"Статус: {response.status_code} ({process_time}ms) | Пристрій: {user_agent}\n"
    )

    with open("casino_visitors.log", "a", encoding="utf-8") as log_file:
        log_file.write(log_entry)

    print(log_entry, end="")
    return response


# ==========================================
# 🔐 АВТОРІЗАЦІЯ ТА ПРОФІЛЬ (Нове!)
# ==========================================

class AuthRequest(BaseModel):
    username: str
    password: str

class CreditRequest(BaseModel):
    username: str

@app.post("/register")
def register_user(req: AuthRequest):
    username = req.username.strip()
    password = req.password.strip()
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Логін та пароль не можуть бути порожніми")
        
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password, balance, credits_taken) VALUES (?, ?, 1000, 0)",
            (username, password)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Користувач з таким логіном вже існує")
    
    conn.close()
    return {"message": "Реєстрація успішна!", "username": username, "balance": 1000, "credits_taken": 0}

@app.post("/login")
def login_user(req: AuthRequest):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT username, balance, credits_taken FROM users WHERE username = ? AND password = ?", (req.username, req.password))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=400, detail="Неправильний логін або пароль")
        
    return {"username": user[0], "balance": user[1], "credits_taken": user[2]}

@app.post("/take_credit")
def take_credit(req: CreditRequest):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("SELECT balance, credits_taken FROM users WHERE username = ?", (req.username,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
    balance, credits_taken = user[0], user[1]
    
    if balance > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Ви можете взяти кредит тільки якщо ваш баланс рівний 0$")
        
    new_balance = 1000
    new_credits = credits_taken + 1
    
    cursor.execute("UPDATE users SET balance = ?, credits_taken = ? WHERE username = ?", (new_balance, new_credits, req.username))
    conn.commit()
    conn.close()
    
    return {"message": "Кредит видано!", "balance": new_balance, "credits_taken": new_credits}


# ==========================================
# 🃏 ЛОГІКА ПОКЕРУ
# ==========================================

class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value
        values_map = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        }
        self.rank = values_map[value]
        
    def to_dict(self):
        return {"suit": self.suit, "value": self.value}

def evaluate_hand(hand):
    if len(hand) < 5:
        return (0, "Старша карта")
    ranks = sorted([card.rank for card in hand], reverse=True)
    suits = [card.suit for card in hand]
    suit_counts = Counter(suits)
    is_flush = any(count >= 5 for count in suit_counts.values())
    rank_counts = Counter(ranks)
    counts = sorted(rank_counts.values(), reverse=True)
    
    if is_flush: return (5, "Флеш")
    if counts in [[4, 1], [4, 2], [4, 3]]: return (7, "Каре")
    if counts in [[3, 2], [3, 3], [3, 2, 1]]: return (6, "Фул-Хаус")
    if counts in [[3, 1, 1], [3, 1, 1, 1]]: return (3, "Трійка")
    if counts in [[2, 2, 1], [2, 2, 2], [2, 2, 1, 1]]: return (2, "Дві пари")
    if counts in [[2, 1, 1, 1], [2, 1, 1, 1, 1], [2, 1, 1, 1, 1, 1]]: return (1, "Пара")
    return (0, "Старша карта")

class GameRoom:
    def __init__(self):
        self.deck = []
        self.player_hand = []
        self.bots_hands = {}
        self.community_cards = []
        self.round_state = "preflop"

game = GameRoom()

@app.get("/start_game")
def start_game():
    suits = ['♣', '♦', '♥', '♠']
    values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    game.deck = [Card(suit, value) for suit in suits for value in values]
    random.shuffle(game.deck)
    game.player_hand = [game.deck.pop(), game.deck.pop()]
    game.bots_hands = {
        "bot1": [game.deck.pop(), game.deck.pop()],
        "bot2": [game.deck.pop(), game.deck.pop()],
        "bot3": [game.deck.pop(), game.deck.pop()]
    }
    game.community_cards = []
    game.round_state = "preflop"
    return {"player_cards": [c.to_dict() for c in game.player_hand], "round": game.round_state}

@app.get("/next_round")
def next_round():
    if not game.deck:
        suits = ['♣', '♦', '♥', '♠']
        values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        game.deck = [Card(suit, value) for suit in suits for value in values]
        random.shuffle(game.deck)

    if game.round_state == "preflop":
        game.round_state = "flop"
        if len(game.deck) > 0: game.deck.pop()
        game.community_cards = [game.deck.pop(), game.deck.pop(), game.deck.pop()]
    elif game.round_state == "flop":
        game.round_state = "turn"
        if len(game.deck) > 0: game.deck.pop()
        game.community_cards.append(game.deck.pop())
    elif game.round_state == "turn":
        game.round_state = "river"
        if len(game.deck) > 0: game.deck.pop()
        game.community_cards.append(game.deck.pop())
    elif game.round_state == "river":
        game.round_state = "showdown"
        
    return {"round": game.round_state, "community_cards": [c.to_dict() for c in game.community_cards]}

@app.get("/determine_winner")
def determine_winner():
    results = {}
    p_score, p_name = evaluate_hand(game.player_hand + game.community_cards)
    results["player"] = {"score": p_score, "name": p_name}
    
    for bot_id, hand in game.bots_hands.items():
        b_score, b_name = evaluate_hand(hand + game.community_cards)
        results[bot_id] = {"score": b_score, "name": b_name}
        
    winner = max(results, key=lambda k: results[k]["score"])
    names_map = {"player": "Ти", "bot1": "Бот 1 (Агресор)", "bot2": "Бот 2 (Профі)", "bot3": "Бот 3 (Рандом)"}
    winner_name = names_map.get(winner, winner)
    
    return {
        "results": results,
        "winner": winner,
        "winner_text": f"🎉 Переміг {winner_name} з комбінацією \"{results[winner]['name']}\"!"
    }


# ==========================================
# 🎰 ЛОГІКА АМЕРИКАНСЬКОЇ РУЛЕТКИ
# ==========================================

AMERICAN_ROULETTE_WHEEL = [
    "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15", "3", "24", "36", "13", "1",
    "00", "27", "10", "25", "29", "12", "8", "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2"
]

def get_number_color(num: str) -> str:
    if num in ["0", "00"]: return "green"
    red_numbers = ["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"]
    return "red" if num in red_numbers else "black"

class SpinRequest(BaseModel):
    username: str  # додаємо ім'я юзера, щоб оновлювати баланс в БД
    bet_type: str  
    bet_value: str 
    bet_amount: int

@app.post("/roulette/spin")
def roulette_spin(request: SpinRequest):
    if request.bet_amount <= 0:
        raise HTTPException(status_code=400, detail="Ставка повинна бути більшою за 0")

    # Перевіряємо баланс гравця в базі даних перед грою
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT balance FROM users WHERE username = ?", (request.username,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Користувача не знайдено. Увійдіть в акаунт!")
        
    current_balance = user[0]
    if current_balance < request.bet_amount:
        conn.close()
        raise HTTPException(status_code=400, detail="Недостатньо грошей на балансі!")

    winning_number = random.choice(AMERICAN_ROULETTE_WHEEL)
    winning_color = get_number_color(winning_number)
    wheel_index = AMERICAN_ROULETTE_WHEEL.index(winning_number)

    is_win = False
    payout_multiplier = 0

    if request.bet_type == "red" and winning_color == "red":
        is_win = True
        payout_multiplier = 2
    elif request.bet_type == "black" and winning_color == "black":
        is_win = True
        payout_multiplier = 2
    elif winning_number not in ["0", "00"]:
        num_int = int(winning_number)
        if request.bet_type == "even" and num_int % 2 == 0:
            is_win = True
            payout_multiplier = 2
        elif request.bet_type == "odd" and num_int % 2 != 0:
            is_win = True
            payout_multiplier = 2

    if request.bet_type == "number" and request.bet_value == winning_number:
        is_win = True
        payout_multiplier = 36

    win_amount = request.bet_amount * payout_multiplier if is_win else 0
    
    # Вираховуємо новий баланс
    new_balance = current_balance - request.bet_amount + win_amount
    
    # Зберігаємо новий баланс в БД
    cursor.execute("UPDATE users SET balance = ? WHERE username = ?", (new_balance, request.username))
    conn.commit()
    conn.close()

    return {
        "winning_number": winning_number,
        "winning_color": winning_color,
        "wheel_index": wheel_index,
        "is_win": is_win,
        "win_amount": win_amount,
        "new_balance": new_balance
    }