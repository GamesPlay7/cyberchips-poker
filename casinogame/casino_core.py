import random
from collections import Counter
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Дозволяємо браузеру відкривати цей API (захист CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- ГЛОБАЛЬНИЙ СТАН ГРИ НА БЕКЕНДІ ---
class GameRoom:
    def __init__(self):
        self.deck = []
        self.player_hand = []
        self.bots_hands = {}
        self.community_cards = []


game = GameRoom()


# --- КЛАСИ КАРТ ТА КОЛОДИ (ТВОЇ МИШНУЛІ КРОКИ) ---
class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value
        values_map = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12,
                      'K': 13, 'A': 14}
        self.rank = values_map[value]

    def to_dict(self):
        return {"suit": self.suit, "value": self.value}


def evaluate_hand(hand):
    ranks = sorted([card.rank for card in hand], reverse=True)
    rank_counts = Counter(ranks)
    counts = sorted(rank_counts.values(), reverse=True)
    if counts == [4, 1]:
        return (7, "Каре")
    elif counts == [3, 2]:
        return (6, "Фул-Хаус")
    elif counts == [3, 1, 1]:
        return (3, "Трійка")
    elif counts == [2, 2, 1]:
        return (2, "Дві пари")
    elif counts == [2, 1, 1, 1]:
        return (1, "Пара")
    return (0, "Старша карта")


# --- API МАРШРУТИ ДЛЯ БРАУЗЕРА ---

@app.get("/start_game")
def start_game():
    """ Початок нової роздачі. Створюємо і перемішуємо колоду. """
    suits = ['♣', '♦', '♥', '♠']
    values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    game.deck = [Card(suit, value) for suit in suits for value in values]
    random.shuffle(game.deck)

    # Роздаємо карти (по 2 кожному)
    game.player_hand = [game.deck.pop(), game.deck.pop()]
    game.bots_hands = {
        "bot1": [game.deck.pop(), game.deck.pop()],
        "bot2": [game.deck.pop(), game.deck.pop()],
        "bot3": [game.deck.pop(), game.deck.pop()]
    }
    # Очищуємо стіл
    game.community_cards = []

    # Повертаємо фронтенду ТІЛЬКИ карти гравця для безпеки (щоб ніхто не підгледів карти ботів)
    return {
        "player_cards": [c.to_dict() for c in game.player_hand],
        "status": "game_started"
    }


class BotDecisionRequest(BaseModel):
    bot_id: str
    current_bet: int


@app.post("/bot_turn")
def bot_turn(request: BotDecisionRequest):
    """ Прораховує хід конкретного бота на основі його карт """
    bot_hand = game.bots_hands.get(request.bot_id, [])
    full_hand = bot_hand + game.community_cards
    score, comb_name = evaluate_hand(full_hand)

    # Твоя логіка "мізків" ботів
    if request.bot_id == "bot2":  # Профі
        if score >= 1:
            return {"action": "call", "amount": request.current_bet}
        return {"action": "fold", "amount": 0}
    elif request.bot_id == "bot1":  # Агресор
        if score >= 1 or random.random() < 0.3:
            return {"action": "raise", "amount": request.current_bet + 50}
        return {"action": "call", "amount": request.current_bet}
    else:  # Рандом
        return {"action": random.choice(["call", "fold"]), "amount": request.current_bet}

# Запуск сервера командою в терміналі: uvicorn casino_core:app --reload