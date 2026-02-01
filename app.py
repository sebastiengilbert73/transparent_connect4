from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from game import Connect4

app = Flask(__name__)
CORS(app)

# Store game state in memory (for simplicity)
game = Connect4()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/new_game', methods=['POST'])
def new_game():
    data = request.json or {}
    starting_player = data.get('starting_player', '1')
    
    game.reset()
    
    if starting_player == 'random':
        import random
        game.current_player = random.choice([1, 2])
    else:
        game.current_player = int(starting_player)
    
    # If AI starts, we can either make the move here or let the frontend trigger it.
    # Letting the frontend trigger it allows for a smoother transition/delay.
    
    return jsonify(game.get_state())

@app.route('/api/move', methods=['POST'])
def make_move():
    data = request.json
    column = data.get('column')
    
    if column is None:
        return jsonify({"error": "Column is required"}), 400
    
    success, error = game.make_move(int(column))
    if not success:
        return jsonify({"error": error}), 400
    
    return jsonify(game.get_state())

@app.route('/api/ai_move', methods=['POST'])
def ai_move():
    if game.game_over or game.current_player != 2:
        return jsonify({"error": "Not AI's turn or game over"}), 400
    
    column = game.get_ai_move()
    success, error = game.make_move(column)
    if not success:
        return jsonify({"error": error}), 400
    
    return jsonify(game.get_state())

@app.route('/api/analyze_move', methods=['POST'])
def analyze_move():
    data = request.json
    column = data.get('column')
    
    if column is None:
        return jsonify({"error": "Column is required"}), 400
    
    analysis = game.get_move_analysis(int(column))
    if analysis is None:
        return jsonify({"error": "Invalid analysis request"}), 400
    
    return jsonify(analysis)

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(game.get_state())

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
