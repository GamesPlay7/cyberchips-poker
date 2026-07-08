import random
from collections import Counter
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value
        values_map = {'2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14}
        self.rank = values_map[value]
        
    def to_dict(self):
        return {"suit": self.suit, "value": self.value}

# Повноцінний оцінювач комбінацій (прокачана версія)
def evaluate_hand(hand):
    if len(hand) < 5:
        return (0, "Старша карта")
        
    ranks = sorted([card.rank for card in hand], reverse=True)
    suits = [card.suit for card in hand]
    
    # Перевірка на Флеш (5 карт однієї масті)
    suit_counts = Counter(suits)
    is_flush = any(count >= 5 for count in suit_counts.values())
    
    rank_counts = Counter(ranks)
    counts = sorted(rank_counts.values(), reverse=True)
    
    # Логіка визначення сили комбінації
    if is_flush: return (5, "Флеш")
    if counts == [4, 1] or counts == [4, 2] or counts == [4, 3]: return (7, "Каре")
    if counts == [3, 2] or counts == [3, 3] or counts == [3, 2, 1]: return (6, "Фул-Хаус")
    if counts == [3, 1, 1] or counts == [3, 1, 1, 1] or counts == [3, 2]: return (3, "Трійка")
    if counts == [2, 2, 1] or counts == [2, 2, 2] or counts == [2, 2, 1, 1]: return (2, "Дві пари")
    if counts == [2, 1, 1, 1] or counts == [2, 1, 1, 1, 1] or counts == [2, 1, 1, 1, 1, 1]: return (1, "Пара")
    
    return (0, "Старша карта")

class GameRoom:
    def __init__(self):
        self.deck = []
        self.player_hand = []
        self.bots_hands = {}
        self.community_cards = []
        self.round_state = "preflop" # preflop -> flop -> turn -> river -> showdown

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
    
    return {
        "player_cards": [c.to_dict() for c in game.player_hand],
        "round": game.round_state
    }

@app.get("/next_round")
def next_round():
    """ Перехід на наступний раунд і спалювання/видача карт на стіл """
    if game.round_state == "preflop":
        game.round_state = "flop"
        game.deck.pop() # Спалюємо одну карту за правилами покеру
        game.community_cards = [game.deck.pop(), game.deck.pop(), game.deck.pop()] # 3 карти на стіл
    elif game.round_state == "flop":
        game.round_state = "turn"
        game.deck.pop() # Спалюємо
        game.community_cards.append(game.deck.pop()) # +1 карта
    elif game.round_state == "turn":
        game.round_state = "river"
        game.deck.pop() # Спалюємо
        game.community_cards.append(game.deck.pop()) # +1 фінальна карта
    elif game.round_state == "river":
        game.round_state = "showdown"
        
    return {
        "round": game.round_state,
        "community_cards": [c.to_dict() for c in game.community_cards]
    }

@app.get("/determine_winner")
def determine_winner():
    """ Фінальний підрахунок результатів """
    results = {}
    
    # Рахуємо комбінацію гравця
    p_score, p_name = evaluate_hand(game.player_hand + game.community_cards)
    results["player"] = {"score": p_score, "name": p_name}
    
    # Рахуємо ботів
    for bot_id, hand in game.bots_hands.items():
        b_score, b_name = evaluate_hand(hand + game.community_cards)
        results[bot_id] = {"score": b_score, "name": b_name}
        
    # Визначаємо переможця з найбільшим score
    winner = max(results, key=lambda k: results[k]["score"])
    
    return {
        "results": results,
        "winner": winner,
        "winner_text": f"Переміг {winner} з комбінацією {results[winner]['name']}!"
    }