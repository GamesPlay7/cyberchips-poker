import random
from collections import Counter
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Дозволяємо фронтенду робити запити до нашого сервера
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
    
    if is_flush: 
        return (5, "Флеш")
    if counts in [[4, 1], [4, 2], [4, 3]]: 
        return (7, "Каре")
    if counts in [[3, 2], [3, 3], [3, 2, 1]]: 
        return (6, "Фул-Хаус")
    if counts in [[3, 1, 1], [3, 1, 1, 1]]: 
        return (3, "Трійка")
    if counts in [[2, 2, 1], [2, 2, 2], [2, 2, 1, 1]]: 
        return (2, "Дві пари")
    if counts in [[2, 1, 1, 1], [2, 1, 1, 1, 1], [2, 1, 1, 1, 1, 1]]: 
        return (1, "Пара")
    
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
    
    return {
        "player_cards": [c.to_dict() for c in game.player_hand],
        "round": game.round_state
    }

@app.get("/next_round")
def next_round():
    if game.round_state == "preflop":
        game.round_state = "flop"
        game.deck.pop()  # Спалюємо
        game.community_cards = [game.deck.pop(), game.deck.pop(), game.deck.pop()]
    elif game.round_state == "flop":
        game.round_state = "turn"
        game.deck.pop()  # Спалюємо
        game.community_cards.append(game.deck.pop())
    elif game.round_state == "turn":
        game.round_state = "river"
        game.deck.pop()  # Спалюємо
        game.community_cards.append(game.deck.pop())
    elif game.round_state == "river":
        game.round_state = "showdown"
        
    return {
        "round": game.round_state,
        "community_cards": [c.to_dict() for c in game.community_cards]
    }

@app.get("/determine_winner")
def determine_winner():
    results = {}
    
    p_score, p_name = evaluate_hand(game.player_hand + game.community_cards)
    results["player"] = {"score": p_score, "name": p_name}
    
    for bot_id, hand in game.bots_hands.items():
        b_score, b_name = evaluate_hand(hand + game.community_cards)
        results[bot_id] = {"score": b_score, "name": b_name}
        
    winner = max(results, key=lambda k: results[k]["score"])
    
    # Гарне ім'я для виведення на екран
    names_map = {"player": "Ти", "bot1": "Бот 1 (Агресор)", "bot2": "Бот 2 (Профі)", "bot3": "Бот 3 (Рандом)"}
    winner_name = names_map.get(winner, winner)
    
    return {
        "results": results,
        "winner": winner,
        "winner_text": f"🎉 Переміг {winner_name} з комбінацією \"{results[winner]['name']}\"!"
    }