class Connect4:
    def __init__(self):
        self.rows = 6
        self.cols = 7
        self.reset()

    def reset(self):
        self.board = [[0 for _ in range(self.cols)] for _ in range(self.rows)]
        self.current_player = 1
        self.winner = None
        self.game_over = False

    def make_move(self, column):
        if self.game_over:
            return False, "Game is over"
        if column < 0 or column >= self.cols:
            return False, "Invalid column"
        
        # Find the lowest empty row in the column
        for row in range(self.rows - 1, -1, -1):
            if self.board[row][column] == 0:
                self.board[row][column] = self.current_player
                if self.check_winner(row, column):
                    self.winner = self.current_player
                    self.game_over = True
                elif self.check_draw():
                    self.winner = 0  # Draw
                    self.game_over = True
                else:
                    self.current_player = 3 - self.current_player  # Switch player (1 -> 2, 2 -> 1)
                return True, None
        
        return False, "Column is full"

    def check_winner(self, row, col):
        player = self.board[row][col]
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]  # Horizontal, Vertical, Diagonal 1, Diagonal 2

        for dr, dc in directions:
            count = 1
            # Check one direction
            r, c = row + dr, col + dc
            while 0 <= r < self.rows and 0 <= c < self.cols and self.board[r][c] == player:
                count += 1
                r += dr
                c += dc
            # Check opposite direction
            r, c = row - dr, col - dc
            while 0 <= r < self.rows and 0 <= c < self.cols and self.board[r][c] == player:
                count += 1
                r -= dr
                c -= dc
            
            if count >= 4:
                return True
        return False

    def check_draw(self):
        return all(self.board[0][c] != 0 for c in range(self.cols))

    def get_state(self):
        return {
            "board": self.board,
            "current_player": self.current_player,
            "winner": self.winner,
            "game_over": self.game_over
        }

    def get_ai_move(self):
        # AI is always player 2
        col, _, _ = self.minimax(self.board, 4, -float('inf'), float('inf'), True)
        return col

    def get_move_analysis(self, column):
        # Analyze a specific move for the current player
        if self.game_over or self.board[0][column] != 0:
            return None
        
        row = self.get_next_open_row(self.board, column)
        b_copy = [row[:] for row in self.board]
        b_copy[row][column] = self.current_player
        
        # Initial analysis state
        is_maximizing = self.current_player == 2
        _, score, path_data = self.minimax(b_copy, 3, -float('inf'), float('inf'), not is_maximizing)
        
        # Build states and scores list
        # Perspective: higher is better for the player who just moved
        analysis_steps = []
        
        # First step: the move just made
        # We need its heuristic value
        step_score = self.score_position(b_copy, 2)
        if self.current_player == 1: step_score = -step_score
        analysis_steps.append({"board": [row[:] for row in b_copy], "score": step_score})
        
        # Subsequent steps
        for _, board_state, s_val in path_data:
            display_score = s_val
            # Minimax 's_val' is always from Player 2's perspective
            if self.current_player == 1:
                display_score = -display_score
            analysis_steps.append({"board": board_state, "score": display_score})
        
        if self.current_player == 1:
            score = -score
            
        return {
            "score": score,
            "steps": analysis_steps
        }

    def minimax(self, board, depth, alpha, beta, maximizing_player):
        valid_locations = self.get_valid_locations(board)
        is_terminal = self.is_terminal_node(board)
        
        if depth == 0 or is_terminal:
            if is_terminal:
                if self.has_won(board, 2):
                    return (None, 100000000000000, [])
                elif self.has_won(board, 1):
                    return (None, -100000000000000, [])
                else: # Game is over, no more valid moves
                    return (None, 0, [])
            else: # Depth is zero
                return (None, self.score_position(board, 2), [])

        # path_data stores: (column, board_after_move, score_of_this_move)
        best_path_data = []
        if maximizing_player:
            value = -float('inf')
            column = valid_locations[0]
            for col in valid_locations:
                row = self.get_next_open_row(board, col)
                b_copy = [row[:] for row in board]
                b_copy[row][col] = 2
                _, new_score, p_data = self.minimax(b_copy, depth-1, alpha, beta, False)
                if new_score > value:
                    value = new_score
                    column = col
                    best_path_data = [(col, b_copy, new_score)] + p_data
                alpha = max(alpha, value)
                if alpha >= beta:
                    break
            return column, value, best_path_data

        else: # Minimizing player
            value = float('inf')
            column = valid_locations[0]
            for col in valid_locations:
                row = self.get_next_open_row(board, col)
                b_copy = [row[:] for row in board]
                b_copy[row][col] = 1
                _, new_score, p_data = self.minimax(b_copy, depth-1, alpha, beta, True)
                if new_score < value:
                    value = new_score
                    column = col
                    best_path_data = [(col, b_copy, new_score)] + p_data
                beta = min(beta, value)
                if alpha >= beta:
                    break
            return column, value, best_path_data

    def score_position(self, board, player):
        score = 0
        # Score center column
        center_array = [board[r][self.cols//2] for r in range(self.rows)]
        center_count = center_array.count(player)
        score += center_count * 3

        # Score Horizontal
        for r in range(self.rows):
            row_array = [int(i) for i in list(board[r])]
            for c in range(self.cols-3):
                window = row_array[c:c+4]
                score += self.evaluate_window(window, player)

        # Score Vertical
        for c in range(self.cols):
            col_array = [int(board[r][c]) for r in range(self.rows)]
            for r in range(self.rows-3):
                window = col_array[r:r+4]
                score += self.evaluate_window(window, player)

        # Score positive sloped diagonal
        for r in range(self.rows-3):
            for c in range(self.cols-3):
                window = [board[r+i][c+i] for i in range(4)]
                score += self.evaluate_window(window, player)

        # Score negative sloped diagonal
        for r in range(self.rows-3):
            for c in range(3, self.cols):
                window = [board[r+i][c-i] for i in range(4)]
                score += self.evaluate_window(window, player)

        return score

    def evaluate_window(self, window, player):
        score = 0
        opp_player = 1 if player == 2 else 2

        if window.count(player) == 4:
            score += 100
        elif window.count(player) == 3 and window.count(0) == 1:
            score += 5
        elif window.count(player) == 2 and window.count(0) == 2:
            score += 2

        if window.count(opp_player) == 3 and window.count(0) == 1:
            score -= 4

        return score

    def is_terminal_node(self, board):
        return self.has_won(board, 1) or self.has_won(board, 2) or len(self.get_valid_locations(board)) == 0

    def get_valid_locations(self, board):
        valid_locations = []
        for col in range(self.cols):
            if board[0][col] == 0:
                valid_locations.append(col)
        return valid_locations

    def get_next_open_row(self, board, col):
        for r in range(self.rows-1, -1, -1):
            if board[r][col] == 0:
                return r

    def has_won(self, board, player):
        # Check horizontal
        for c in range(self.cols-3):
            for r in range(self.rows):
                if board[r][c] == player and board[r][c+1] == player and board[r][c+2] == player and board[r][c+3] == player:
                    return True
        # Check vertical
        for c in range(self.cols):
            for r in range(self.rows-3):
                if board[r][c] == player and board[r+1][c] == player and board[r+2][c] == player and board[r+3][c] == player:
                    return True
        # Check positive sloped diagonals
        for c in range(self.cols-3):
            for r in range(self.rows-3):
                if board[r][c] == player and board[r+1][c+1] == player and board[r+2][c+2] == player and board[r+3][c+3] == player:
                    return True
        # Check negative sloped diagonals
        for c in range(self.cols-3):
            for r in range(3, self.rows):
                if board[r][c] == player and board[r-1][c+1] == player and board[r-2][c+2] == player and board[r-3][c+3] == player:
                    return True
        return False
