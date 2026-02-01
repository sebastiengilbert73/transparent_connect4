document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const resetBtn = document.getElementById('reset-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const gameMessage = document.getElementById('game-message');
    const winOverlay = document.getElementById('win-overlay');
    const winText = document.getElementById('win-text');
    const p1Indicator = document.getElementById('p1-indicator');
    const p2Indicator = document.getElementById('p2-indicator');
    const selectionOverlay = document.getElementById('selection-overlay');
    const selectOptions = document.querySelectorAll('.select-opt');
    const analysisModeToggle = document.getElementById('analysis-mode');
    const analysisTooltip = document.getElementById('analysis-tooltip');
    const analysisScore = document.getElementById('analysis-score');
    const analysisSteps = document.getElementById('analysis-steps');

    let gameState = {
        board: Array(6).fill().map(() => Array(7).fill(0)),
        current_player: 1,
        game_over: false,
        winner: null
    };

    let isProcessing = false;
    let analysisEnabled = analysisModeToggle.checked;

    // Initialize the board
    function initBoard() {
        gameBoard.innerHTML = '';
        for (let col = 0; col < 7; col++) {
            const columnEl = document.createElement('div');
            columnEl.className = 'column';
            columnEl.dataset.col = col;
            columnEl.addEventListener('click', () => handleMove(col));
            columnEl.addEventListener('mouseenter', () => showAnalysis(col));
            columnEl.addEventListener('mouseleave', hideAnalysis);
            columnEl.addEventListener('mousemove', moveTooltip);

            for (let row = 0; row < 6; row++) {
                const slotEl = document.createElement('div');
                slotEl.className = 'slot';
                slotEl.dataset.row = row;
                columnEl.appendChild(slotEl);
            }
            gameBoard.appendChild(columnEl);
        }
    }

    async function showAnalysis(col) {
        if (!analysisEnabled || gameState.game_over || gameState.current_player !== 1 || isProcessing) return;

        try {
            const response = await fetch('/api/analyze_move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ column: col })
            });

            if (!response.ok) return;
            const data = await response.json();

            displayAnalysis(data);
        } catch (err) {
            console.error('Analysis failed:', err);
        }
    }

    function createMiniBoard(board) {
        const container = document.createElement('div');
        container.className = 'mini-board-container';

        const grid = document.createElement('div');
        grid.className = 'mini-board';

        // Connect4 is 6x7, usually data is row-first in my game.py
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                const slot = document.createElement('div');
                slot.className = 'mini-slot';
                if (board[r][c] === 1) slot.classList.add('p1');
                if (board[r][c] === 2) slot.classList.add('p2');
                grid.appendChild(slot);
            }
        }

        container.appendChild(grid);
        return container;
    }

    function displayAnalysis(data) {
        analysisScore.textContent = (data.score > 1000000 ? 'WIN' : (data.score < -1000000 ? 'LOSS' : data.score));
        analysisSteps.innerHTML = '';

        data.steps.forEach((step, index) => {
            if (index > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'state-arrow';
                arrow.innerHTML = '&#9660;'; // Down triangle
                analysisSteps.appendChild(arrow);
            }

            const item = document.createElement('div');
            item.className = 'state-item';

            const miniBoard = createMiniBoard(step.board);
            item.appendChild(miniBoard);

            const value = document.createElement('span');
            value.className = 'state-value';

            let displayScore = step.score;
            if (displayScore > 1000000) displayScore = "WIN";
            else if (displayScore < -1000000) displayScore = "LOSS";

            value.textContent = `Val: ${displayScore}`;
            item.appendChild(value);

            analysisSteps.appendChild(item);
        });

        analysisTooltip.classList.remove('hidden');
    }

    function hideAnalysis() {
        analysisTooltip.classList.add('hidden');
    }

    function moveTooltip(e) {
        if (analysisTooltip.classList.contains('hidden')) return;

        // Keep tooltip within viewport
        let x = e.clientX + 15;
        let y = e.clientY + 15;

        const tooltipRect = analysisTooltip.getBoundingClientRect();
        if (x + tooltipRect.width > window.innerWidth) {
            x = e.clientX - tooltipRect.width - 15;
        }
        if (y + tooltipRect.height > window.innerHeight) {
            y = e.clientY - tooltipRect.height - 15;
        }

        analysisTooltip.style.left = x + 'px';
        analysisTooltip.style.top = y + 'px';
    }

    analysisModeToggle.addEventListener('change', (e) => {
        analysisEnabled = e.target.checked;
        if (!analysisEnabled) hideAnalysis();
    });

    async function fetchState() {
        try {
            const response = await fetch('/api/state');
            gameState = await response.json();
            updateUI();
            checkAITurn();
        } catch (err) {
            console.error('Failed to fetch state:', err);
        }
    }

    async function handleMove(col) {
        if (gameState.game_over || gameState.current_player !== 1 || isProcessing) return;
        isProcessing = true;
        hideAnalysis();

        try {
            const response = await fetch('/api/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ column: col })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error(error.error);
                isProcessing = false;
                return;
            }

            const newState = await response.json();

            // Find which row the coin landed in for animation
            const oldBoard = gameState.board;
            const newBoard = newState.board;
            let landedRow = -1;
            for (let r = 5; r >= 0; r--) {
                if (oldBoard[r][col] === 0 && newBoard[r][col] !== 0) {
                    landedRow = r;
                    break;
                }
            }

            if (landedRow !== -1) {
                animateCoin(col, landedRow, gameState.current_player);
            }

            gameState = newState;

            setTimeout(() => {
                updateUI();
                isProcessing = false;
                checkAITurn();
            }, 600); // Wait for animation

        } catch (err) {
            console.error('Failed to make move:', err);
            isProcessing = false;
        }
    }

    async function checkAITurn() {
        if (gameState.game_over || gameState.current_player !== 2 || isProcessing) return;
        isProcessing = true;
        hideAnalysis();

        gameMessage.textContent = "Computer is thinking...";

        try {
            // Add a small delay for realism
            await new Promise(resolve => setTimeout(resolve, 800));

            const response = await fetch('/api/ai_move', { method: 'POST' });
            if (!response.ok) {
                console.error("AI move failed");
                isProcessing = false;
                return;
            }

            const newState = await response.json();

            // Find AI move for animation
            const oldBoard = gameState.board;
            const newBoard = newState.board;
            let landedCol = -1;
            let landedRow = -1;

            for (let c = 0; c < 7; c++) {
                for (let r = 5; r >= 0; r--) {
                    if (oldBoard[r][c] === 0 && newBoard[r][c] !== 0) {
                        landedCol = c;
                        landedRow = r;
                        break;
                    }
                }
                if (landedCol !== -1) break;
            }

            if (landedRow !== -1) {
                animateCoin(landedCol, landedRow, 2);
            }

            gameState = newState;

            setTimeout(() => {
                updateUI();
                isProcessing = false;
            }, 600);

        } catch (err) {
            console.error('AI move error:', err);
            isProcessing = false;
        }
    }

    function animateCoin(col, row, player) {
        const columnEl = gameBoard.children[col];
        const slotEl = columnEl.children[row];

        const coin = document.createElement('div');
        coin.className = `coin p${player}`;
        slotEl.appendChild(coin);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                coin.classList.add('dropped');
            });
        });
    }

    function updateUI() {
        if (!gameBoard.children.length) return;

        p1Indicator.parentElement.classList.toggle('active', gameState.current_player === 1);
        p2Indicator.parentElement.classList.toggle('active', gameState.current_player === 2);

        for (let col = 0; col < 7; col++) {
            const columnEl = gameBoard.children[col];
            for (let row = 0; row < 6; row++) {
                const slotEl = columnEl.children[row];
                const player = gameState.board[row][col];

                const existingCoin = slotEl.querySelector('.coin');
                if (player !== 0) {
                    if (!existingCoin) {
                        const coin = document.createElement('div');
                        coin.className = `coin p${player} dropped`;
                        slotEl.appendChild(coin);
                    } else {
                        // Ensure player class is correct (for resets)
                        existingCoin.className = `coin p${player} dropped`;
                    }
                } else if (existingCoin) {
                    existingCoin.remove();
                }
            }
        }

        if (gameState.game_over) {
            if (gameState.winner === 0) {
                gameMessage.textContent = "It's a Draw!";
                winText.textContent = "It's a Draw!";
                winText.style.color = 'white';
            } else {
                gameMessage.textContent = `Player ${gameState.winner} Wins!`;
                winText.textContent = `Player ${gameState.winner} Wins!`;
                winText.style.color = gameState.winner === 1 ? 'var(--player-1-color)' : 'var(--player-2-color)';
            }
            winOverlay.classList.remove('hidden');
        } else {
            gameMessage.textContent = gameState.current_player === 1 ? "Your Turn" : "Computer is thinking...";
            winOverlay.classList.add('hidden');
        }
    }

    async function requestNewGame(startingPlayer) {
        try {
            const response = await fetch('/api/new_game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ starting_player: startingPlayer })
            });
            gameState = await response.json();

            // Clear board visuals
            document.querySelectorAll('.coin').forEach(c => c.remove());

            selectionOverlay.classList.add('hidden');
            updateUI();
            checkAITurn();
        } catch (err) {
            console.error('Failed to start new game:', err);
        }
    }

    resetBtn.addEventListener('click', () => {
        hideAnalysis();
        selectionOverlay.classList.remove('hidden');
    });

    playAgainBtn.addEventListener('click', () => {
        hideAnalysis();
        selectionOverlay.classList.remove('hidden');
        winOverlay.classList.add('hidden');
    });

    selectOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            requestNewGame(opt.dataset.player);
        });
    });

    initBoard();
});
