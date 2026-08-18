const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const turnIndicator = document.getElementById('turn-indicator');
const functionInput = document.getElementById('functionInput');
const fireBtn = document.getElementById('fireBtn');

// Grid configuration
const GRID_SIZE = 100;
const CANVAS_SIZE = canvas.width;
const SCALE = CANVAS_SIZE / GRID_SIZE;

const PLAYER_RADIUS = 1.5;
const OBSTACLE_COUNT = Math.floor(Math.random() * 4) + 3; // Obstacles amount

let currentPlayer = 1;
let isAnimating = false;

const p1 = { x: 10, y: 50 };
const p2 = { x: 90, y: 50 };

let obstacles = [];

function generateObstacles() {
    obstacles = [];
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
        let obs;
        let valid = false;
        
        while (!valid) {
            const radius = (Math.random() * 3 + 3) * PLAYER_RADIUS;
            const x = Math.random() * (GRID_SIZE - 40) + 20;
            const y = Math.random() * (GRID_SIZE - 20) + 10;
            
            obs = { x, y, radius };
            
            const distP1 = Math.hypot(obs.x - p1.x, obs.y - p1.y);
            const distP2 = Math.hypot(obs.x - p2.x, obs.y - p2.y);
            
            if (distP1 > obs.radius + 5 && distP2 > obs.radius + 5) {
                valid = true;
            }
        }
        obstacles.push(obs);
    }
}

function gridToCanvas(gx, gy) {
    return {
        x: gx * SCALE,
        y: CANVAS_SIZE - (gy * SCALE)
    };
}

function drawGrid() {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;

    for (let i = 0; i <= GRID_SIZE; i += 10) {
        const start = gridToCanvas(i, 0);
        const end = gridToCanvas(i, GRID_SIZE);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const startH = gridToCanvas(0, i);
        const endH = gridToCanvas(GRID_SIZE, i);

        ctx.beginPath();
        ctx.moveTo(startH.x, startH.y);
        ctx.lineTo(endH.x, endH.y);
        ctx.stroke();
    }
}

function drawPlayers() {
    // Player 1
    const p1Canvas = gridToCanvas(p1.x, p1.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p1Canvas.x, p1Canvas.y, PLAYER_RADIUS * SCALE, 0, Math.PI * 2);
    ctx.fill();

    // Player 2
    const p2Canvas = gridToCanvas(p2.x, p2.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p2Canvas.x, p2Canvas.y, PLAYER_RADIUS * SCALE, 0, Math.PI * 2);
    ctx.fill();
}

function drawObstacles() {
    ctx.fillStyle = '#ff0000'; // Red obstacles
    for (const obs of obstacles) {
        const obsCanvas = gridToCanvas(obs.x, obs.y);
        ctx.beginPath();
        ctx.arc(obsCanvas.x, obsCanvas.y, obs.radius * SCALE, 0, Math.PI * 2);
        ctx.fill();
    }
}

function render() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
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
    const direction = currentPlayer === 1 ? 1 : -1;

    let points = [];
    let hitOpponent = false;
    let hitObstacle = false;

    const step = 0.2; // Step resolution
    let maxDistance = 100;

    for (let dx = 0; dx <= maxDistance; dx += step) {
        const xRel = dx * direction;
        const yRel = evaluateFunction(expr, xRel);

        if (yRel === null || isNaN(yRel)) break;

        const gridX = shooter.x + xRel;
        const gridY = shooter.y + yRel;

        // Grid boundry check
        if (gridX < 0 || gridX > GRID_SIZE || gridY < 0 || gridY > GRID_SIZE) {
            break;
        }

        points.push({ x: gridX, y: gridY });

        // Collision check (obstacles)
        for (const obs of obstacles) {
            const dist = Math.hypot(gridX - obs.x, gridY - obs.y);
            if (dist <= obs.radius) {
                hitObstacle = true;
                break;
            }
        }
        if (hitObstacle) break;

        // Collision check (player)
        const distTarget = Math.hypot(gridX - target.x, gridY - target.y);
        if (distTarget <= PLAYER_RADIUS) {
            hitOpponent = true;
            break;
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
    const speed = 2;

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
    generateObstacles();
    render();
}

fireBtn.addEventListener('click', fireFunction);
functionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fireFunction();
});

generateObstacles();
render();