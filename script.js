const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const turnIndicator = document.getElementById('turn-indicator');
const functionInput = document.getElementById('functionInput');
const fireBtn = document.getElementById('fireBtn');
const coordDisplay = document.getElementById('coord-info');

const X_MIN = -50, X_MAX = 50;
const Y_MIN = -50, Y_MAX = 50;

const PLAYER_RADIUS = 1.2;
let currentPlayer = 1;
let isAnimating = false;

let p1 = { x: 0, y: 0 };
let p2 = { x: 0, y: 0 };
let obstacles = [];

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    render();
}
window.addEventListener('resize', resizeCanvas);

function gridToCanvas(gx, gy) {
    const scaleX = canvas.width / (X_MAX - X_MIN);
    const scaleY = canvas.height / (Y_MAX - Y_MIN);
    return {
        x: (gx - X_MIN) * scaleX,
        y: canvas.height - ((gy - Y_MIN) * scaleY),
        scaleX, scaleY
    };
}

function canvasToGrid(cx, cy) {
    const scaleX = canvas.width / (X_MAX - X_MIN);
    const scaleY = canvas.height / (Y_MAX - Y_MIN);
    return {
        x: (cx / scaleX) + X_MIN,
        y: ((canvas.height - cy) / scaleY) + Y_MIN
    };
}

function randomizeGame() {
    const p1OnLeft = Math.random() < 0.5;

    if (p1OnLeft) {
        p1.x = -(Math.random() * 35 + 5);
        p1.y = Math.random() * 50 - 25;

        p2.x = Math.random() * 35 + 5;
        p2.y = Math.random() * 50 - 25;
    } else {
        p1.x = Math.random() * 35 + 5;
        p1.y = Math.random() * 50 - 25;

        p2.x = -(Math.random() * 35 + 5);
        p2.y = Math.random() * 50 - 25;
    }

    generateObstacles();
}

function generateObstacles() {
    obstacles = [];
    const count = Math.floor(Math.random() * 5) + 12;

    const midT = 0.3 + Math.random() * 0.4;
    obstacles.push({
        x: p1.x + (p2.x - p1.x) * midT,
        y: p1.y + (p2.y - p1.y) * midT,
        radius: 2 + Math.random() * 1.5
    });

    while (obstacles.length < count) {
        const obs = {
            x: Math.random() * 80 - 40,
            y: Math.random() * 80 - 40,
            radius: 2 + Math.random() * 2
        };

        const distP1 = Math.hypot(obs.x - p1.x, obs.y - p1.y);
        const distP2 = Math.hypot(obs.x - p2.x, obs.y - p2.y);

        if (distP1 > obs.radius + PLAYER_RADIUS + 2 && distP2 > obs.radius + PLAYER_RADIUS + 2) {
            obstacles.push(obs);
        }
    }
}

function drawGrid() {
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';

    for (let x = X_MIN; x <= X_MAX; x += 10) {
        const p = gridToCanvas(x, 0);
        ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke();
        if (x !== 0) ctx.fillText(x, p.x + 2, p.y + 12);
    }

    for (let y = Y_MIN; y <= Y_MAX; y += 10) {
        const p = gridToCanvas(0, y);
        ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(canvas.width, p.y); ctx.stroke();
        if (y !== 0) ctx.fillText(y, p.x + 4, p.y - 2);
    }

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    const origin = gridToCanvas(0, 0);
    ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y); ctx.stroke();
}

function drawEntities() {
    const { scaleX } = gridToCanvas(0, 0);

    ctx.fillStyle = '#ff3333';
    obstacles.forEach(obs => {
        const pos = gridToCanvas(obs.x, obs.y);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, obs.radius * scaleX, 0, Math.PI * 2);
        ctx.fill();
    });

    [ { p: p1, label: 'P1' }, { p: p2, label: 'P2' } ].forEach(({ p, label }) => {
        const pos = gridToCanvas(p.x, p.y);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PLAYER_RADIUS * scaleX, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, pos.x, pos.y - (PLAYER_RADIUS * scaleX) - 6);
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawEntities();
}

function evaluateFunction(expr, xVal) {
    const safeExpr = expr.replace(/[^0-9x\+\-\*\/\^\(\)\.\s|sin|cos|tan|sqrt|abs]/g, '');
    try {
        let sanitized = safeExpr
            .replace(/(\d+)\s*x/g, '$1*x')
            .replace(/\^/g, '**')
            .replace(/\bsin\b/g, 'Math.sin')
            .replace(/\bcos\b/g, 'Math.cos')
            .replace(/\btan\b/g, 'Math.tan')
            .replace(/\bsqrt\b/g, 'Math.sqrt')
            .replace(/\babs\b/g, 'Math.abs');

        return new Function('x', `return ${sanitized};`)(xVal);
    } catch {
        return null;
    }
}

function fireFunction() {
    if (isAnimating) return;
    const expr = functionInput.value.trim();
    if (!expr) return;

    let points = [];
    let hitSelf = false;
    let hitOpponent = false;

    const self = currentPlayer === 1 ? p1 : p2;
    const opponent = currentPlayer === 1 ? p2 : p1;

    for (let x = X_MIN; x <= X_MAX; x += 0.1) {
        const y = evaluateFunction(expr, x);
        if (y === null || isNaN(y) || y < Y_MIN || y > Y_MAX) continue;

        points.push({ x, y });

        if (Math.hypot(x - self.x, y - self.y) <= PLAYER_RADIUS) hitSelf = true;

        if (Math.hypot(x - opponent.x, y - opponent.y) <= PLAYER_RADIUS) hitOpponent = true;

        for (const obs of obstacles) {
            if (Math.hypot(x - obs.x, y - obs.y) <= obs.radius) {
                break;
            }
        }
    }

    if (points.length < 2) {
        alert("Invald function or out of bounds.");
        return;
    }

    animateLine(points, hitSelf, hitOpponent);
}

function animateLine(points, hitSelf, hitOpponent) {
    isAnimating = true;
    let index = 0;

    function step() {
        render();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const start = gridToCanvas(points[0].x, points[0].y);
        ctx.moveTo(start.x, start.y);

        const endIdx = Math.min(index, points.length - 1);
        for (let i = 1; i <= endIdx; i++) {
            const pt = gridToCanvas(points[i].x, points[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        index += 5;

        if (index < points.length) {
            requestAnimationFrame(step);
        } else {
            isAnimating = false;

            if (hitSelf) {
                alert(`PLAYER ${currentPlayer} Friendly fire. Player ${currentPlayer === 1 ? 2 : 1} wins!`);
                resetGame();
            } else if (hitOpponent) {
                alert(`PLAYER ${currentPlayer} wins!`);
                resetGame();
            } else {
                switchTurn();
            }
        }
    }
    requestAnimationFrame(step);
}

function switchTurn() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    turnIndicator.textContent = `Player ${currentPlayer}`;
    functionInput.value = '';
}

function resetGame() {
    currentPlayer = 1;
    turnIndicator.textContent = "Player 1";
    functionInput.value = '';
    randomizeGame();
    render();
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseGrid = canvasToGrid(e.clientX - rect.left, e.clientY - rect.top);

    const overP1 = Math.hypot(mouseGrid.x - p1.x, mouseGrid.y - p1.y) <= PLAYER_RADIUS * 2;
    const overP2 = Math.hypot(mouseGrid.x - p2.x, mouseGrid.y - p2.y) <= PLAYER_RADIUS * 2;

    if (overP1) {
        coordDisplay.textContent = `(${p1.x.toFixed(1)}, ${p1.y.toFixed(1)})`;
    } else if (overP2) {
        coordDisplay.textContent = `(${p2.x.toFixed(1)}, ${p2.y.toFixed(1)})`;
    } else {
        coordDisplay.textContent = "Hover over a player to see coordinates";
    }
});

fireBtn.addEventListener('click', fireFunction);
functionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fireFunction(); });

resizeCanvas();
resetGame();
