const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const turnIndicator = document.getElementById('turn-indicator');
const functionInput = document.getElementById('functionInput');
const fireBtn = document.getElementById('fireBtn');

const CANVAS_WIDTH = canvas.width;  // 1200
const CANVAS_HEIGHT = canvas.height; // 600

const X_MIN = -50;
const X_MAX = 50;
const Y_MIN = -25;
const Y_MAX = 25;

const SCALE_X = CANVAS_WIDTH / (X_MAX - X_MIN);
const SCALE_Y = CANVAS_HEIGHT / (Y_MAX - Y_MIN);

const PLAYER_RADIUS = 1.0;
const OBSTACLE_COUNT = Math.floor(Math.random() * 5) + 6;

let currentPlayer = 1; // 1 or 2
let isAnimating = false;

let p1 = { x: 0, y: 0 };
let p2 = { x: 0, y: 0 };
let obstacles = [];

// Pixel to grid
function gridToCanvas(gx, gy) {
    return {
        x: (gx - X_MIN) * SCALE_X,
        y: CANVAS_HEIGHT - ((gy - Y_MIN) * SCALE_Y)
    };
}

function randomizePlayers() {
    let valid = false;
    while (!valid) {
        p1.x = Math.random() * 80 - 40;
        p1.y = Math.random() * 40 - 20;

        p2.x = Math.random() * 80 - 40;
        p2.y = Math.random() * 40 - 20;

        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist >= 70) {
            valid = true;
        }
    }
}

function generateObstacles() {
    obstacles = [];
    const count = Math.floor(Math.random() * 5) + 6;

    for (let i = 0; i < count; i++) {
        let obs;
        let valid = false;

        while (!valid) {
            const radius = (Math.random() * 2 + 2) * PLAYER_RADIUS;
            const x = Math.random() * 80 - 40;
            const y = Math.random() * 40 - 20;

            obs = { x, y, radius };

            const distP1 = Math.hypot(obs.x - p1.x, obs.y - p1.y);
            const distP2 = Math.hypot(obs.x - p2.x, obs.y - p2.y);

            // Obstacle unoverlapping with players
            if (distP1 > obs.radius + PLAYER_RADIUS + 3 && distP2 > obs.radius + PLAYER_RADIUS + 3) {
                valid = true;
            }
        }
        obstacles.push(obs);
    }
}

function drawGrid() {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666666';
    ctx.font = '10px monospace';

    for (let x = X_MIN; x <= X_MAX; x += 5) {
        const start = gridToCanvas(x, Y_MIN);
        const end = gridToCanvas(x, Y_MAX);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        if (x !== 0) {
            const labelPos = gridToCanvas(x, 0);
            ctx.fillText(x.toString(), labelPos.x - 6, labelPos.y + 12);
        }
    }

    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
        const start = gridToCanvas(X_MIN, y);
        const end = gridToCanvas(X_MAX, y);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        if (y !== 0) {
            const labelPos = gridToCanvas(0, y);
            ctx.fillText(y.toString(), labelPos.x + 4, labelPos.y + 4);
        }
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    const yAxisStart = gridToCanvas(0, Y_MIN);
    const yAxisEnd = gridToCanvas(0, Y_MAX);
    ctx.beginPath();
    ctx.moveTo(yAxisStart.x, yAxisStart.y);
    ctx.lineTo(yAxisEnd.x, yAxisEnd.y);
    ctx.stroke();

    const xAxisStart = gridToCanvas(X_MIN, 0);
    const xAxisEnd = gridToCanvas(X_MAX, 0);
    ctx.beginPath();
    ctx.moveTo(xAxisStart.x, xAxisStart.y);
    ctx.lineTo(xAxisEnd.x, xAxisEnd.y);
    ctx.stroke();

    const originPos = gridToCanvas(0, 0);
    ctx.fillText('(0,0)', originPos.x + 4, originPos.y + 12);
}

function drawPlayers() {
    // Player 1
    const p1Canvas = gridToCanvas(p1.x, p1.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p1Canvas.x, p1Canvas.y, PLAYER_RADIUS * SCALE_X, 0, Math.PI * 2);
    ctx.fill();

    // Player 2
    const p2Canvas = gridToCanvas(p2.x, p2.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p2Canvas.x, p2Canvas.y, PLAYER_RADIUS * SCALE_X, 0, Math.PI * 2);
    ctx.fill();
}

function drawObstacles() {
    ctx.fillStyle = '#ff0000'; // Red obstacles
    for (const obs of obstacles) {
        const obsCanvas = gridToCanvas(obs.x, obs.y);
        ctx.beginPath();
        ctx.arc(obsCanvas.x, obsCanvas.y, obs.radius * SCALE_X, 0, Math.PI * 2);
        ctx.fill();
    }
}

function render() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGrid();
    drawObstacles();
    drawPlayers();
}

function evaluateFunction(expr, xVal) {
    try {
        let sanitized = expr
            .replace(/(\d+)\s*x/g, '$1*x')
            .replace(/\^/g, '**')
            .replace(/sin/g, 'Math.sin')
            .replace(/cos/g, 'Math.cos')
            .replace(/tan/g, 'Math.tan')
            .replace(/sqrt/g, 'Math.sqrt')
            .replace(/abs/g, 'Math.abs');

        const fn = new Function('x', `return ${sanitized};`);
        return fn(xVal);
    } catch (e) {
        return null;
    }
}

function fireFunction() {
    if (isAnimating) return;

    const expr = functionInput.value.trim();
    if (!expr) return;

    const shooter = currentPlayer === 1 ? p1 : p2;
    const target = currentPlayer === 1 ? p2 : p1;
    const direction = shooter.x <= target.x ? 1 : -1;

    let points = [];
    let hitOpponent = false;
    let hitObstacle = false;

    const step = 0.1; // Step resolution in grid units
    let maxDistance = 100;

    // Shoot from player's position
    for (let dx = 0; dx <= maxDistance; dx += step) {
        const xRel = dx * direction;
        const yRel = evaluateFunction(expr, xRel);

        if (yRel === null || isNaN(yRel)) break;

        const gridX = shooter.x + xRel;
        const gridY = shooter.y + yRel;

        // Graph bounds check
        if (gridX < X_MIN || gridX > X_MAX || gridY < Y_MIN || gridY > Y_MAX) {
            break;
        }

        points.push({ x: gridX, y: gridY });

        if (dx > PLAYER_RADIUS * 1.5) {
            // Obstacle collision check
            for (const obs of obstacles) {
                const dist = Math.hypot(gridX - obs.x, gridY - obs.y);
                if (dist <= obs.radius) {
                    hitObstacle = true;
                    break;
                }
            }
            if (hitObstacle) break;

            // Opponent collision check
            const distTarget = Math.hypot(gridX - target.x, gridY - target.y);
            if (distTarget <= PLAYER_RADIUS) {
                hitOpponent = true;
                break;
            }
        }
    }

    if (points.length < 2) {
        alert("Invalid function or out of bounds!");
        return;
    }

    animateLine(points, hitOpponent);
}

function animateLine(points, hitOpponent) {
    isAnimating = true;
    let currentIndex = 0;
    const speed = 3; // Line segments per frame

    function step() {
        render();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const startCanvas = gridToCanvas(points[0].x, points[0].y);
        ctx.moveTo(startCanvas.x, startCanvas.y);

        const endIndex = Math.min(currentIndex, points.length - 1);
        for (let i = 1; i <= endIndex; i++) {
            const pt = gridToCanvas(points[i].x, points[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        currentIndex += speed;

        if (currentIndex < points.length) {
            requestAnimationFrame(step);
        } else {
            isAnimating = false;

            if (hitOpponent) {
                setTimeout(() => {
                    alert(`PLAYER ${currentPlayer} WINS!`);
                    resetGame();
                }, 100);
            } else {
                switchTurn();
            }
        }
    }

    requestAnimationFrame(step);
}

function switchTurn() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
}

function resetGame() {
    currentPlayer = 1;
    turnIndicator.textContent = "Player 1's Turn";
    randomizePlayers();
    generateObstacles();
    render();
}

fireBtn.addEventListener('click', fireFunction);
functionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fireFunction();
});

resetGame();
