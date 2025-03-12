// Get canvas and context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game constants
const TILE_SIZE = 40;
const ROOM_WIDTH = canvas.width / TILE_SIZE; // 20 tiles
const ROOM_HEIGHT = canvas.height / TILE_SIZE; // 15 tiles
const PLAYER_SPEED = 3;
const INVULNERABILITY_DURATION = 1000;
const FLASH_INTERVAL = 100;
const SHOOT_COOLDOWN = 300;
const PLAYER_FRAME_WIDTH = 64;
const PLAYER_FRAME_HEIGHT = 64;
const PLAYER_ANIMATION_SPEED = 1000 / 12;
const PROJECTILE_SIZE = 5;
const TOTAL_ROOMS_X = 3;
const TOTAL_ROOMS_Y = 3;
const TRANSITION_SPEED = 0.05;
const DOOR_WIDTH = 2;
const DOOR_OFFSET = 90;

// Minimap constants
const MINIMAP_SCALE = 1.2; // Increase size by 1.2x
const MINIMAP_ROOM_SIZE = 20 * MINIMAP_SCALE;
const MINIMAP_PADDING = 10 * MINIMAP_SCALE;
const MINIMAP_X = canvas.width - (TOTAL_ROOMS_X * MINIMAP_ROOM_SIZE + MINIMAP_PADDING * 2);
const MINIMAP_Y = MINIMAP_PADDING;
const MINIMAP_PLAYER_SIZE = 4 * MINIMAP_SCALE;

// Load player sprite
const playerSprite = new Image();
playerSprite.src = "jamie.png";

// Game state
let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: PLAYER_FRAME_WIDTH,
    height: PLAYER_FRAME_HEIGHT,
    speed: PLAYER_SPEED,
    dx: 0,
    dy: 0,
    hp: 5,
    maxHp: 5,
    invulnerable: false,
    invulnerabilityTimer: 0,
    flash: false,
    flashTimer: 0,
    facing: { x: 0, y: 0 },
    shootCooldown: 0,
    animationFrame: 0,
    animationTimer: 0,
    facingRight: false,
};

// Store enemies for each room in a 2D array
let enemiesPerRoom = Array(TOTAL_ROOMS_Y).fill().map(() => Array(TOTAL_ROOMS_X).fill().map(() => []));
let enemies = [];
let projectiles = [];
let keys = {};
let showHitboxes = false;
let currentRoomX = 1;
let currentRoomY = 1;
let transitionAlpha = 0;
let isTransitioning = false;
let transitionDirection = null;

let rooms = [];
function generateRooms() {
    // Initialize all rooms with outer walls
    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        let row = [];
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let room = Array(ROOM_HEIGHT).fill().map(() => Array(ROOM_WIDTH).fill(1)); // Start with all walls
            row.push(room);
        }
        rooms.push(row);
    }

    // Use Prim's algorithm to connect rooms
    let frontier = new Set();
    let visited = new Set();
    let startX = Math.floor(Math.random() * TOTAL_ROOMS_X);
    let startY = Math.floor(Math.random() * TOTAL_ROOMS_Y);
    visited.add(`${startX},${startY}`);

    // Add unvisited neighbors to frontier
    function addToFrontier(x, y) {
        if (x >= 0 && x < TOTAL_ROOMS_X && y >= 0 && y < TOTAL_ROOMS_Y && !visited.has(`${x},${y}`)) {
            frontier.add(`${x},${y}`);
        }
    }
    addToFrontier(startX - 1, startY);
    addToFrontier(startX + 1, startY);
    addToFrontier(startX, startY - 1);
    addToFrontier(startX, startY + 1);

    while (frontier.size > 0) {
        let [nextX, nextY] = frontier.values().next().value.split(",").map(Number);
        frontier.delete(`${nextX},${nextY}`);
        visited.add(`${nextX},${nextY}`);

        // Connect to a random visited neighbor
        let neighbors = [];
        if (nextX > 0 && visited.has(`${nextX - 1},${nextY}`)) neighbors.push([nextX - 1, nextY]);
        if (nextX < TOTAL_ROOMS_X - 1 && visited.has(`${nextX + 1},${nextY}`)) neighbors.push([nextX + 1, nextY]);
        if (nextY > 0 && visited.has(`${nextX},${nextY - 1}`)) neighbors.push([nextX, nextY - 1]);
        if (nextY < TOTAL_ROOMS_Y - 1 && visited.has(`${nextX},${nextY + 1}`)) neighbors.push([nextX, nextY + 1]);

        if (neighbors.length > 0) {
            let [fromX, fromY] = neighbors[Math.floor(Math.random() * neighbors.length)];
            let doorY = Math.floor(ROOM_HEIGHT / 2);
            let doorX = Math.floor(ROOM_WIDTH / 2);

            if (fromX < nextX) {
                for (let dy = doorY - Math.floor(DOOR_WIDTH / 2); dy <= doorY + Math.floor(DOOR_WIDTH / 2); dy++) {
                    if (dy >= 0 && dy < ROOM_HEIGHT) rooms[nextY][nextX][dy][0] = 0;
                }
                for (let dy = doorY - Math.floor(DOOR_WIDTH / 2); dy <= doorY + Math.floor(DOOR_WIDTH / 2); dy++) {
                    if (dy >= 0 && dy < ROOM_HEIGHT) rooms[fromY][fromX][dy][ROOM_WIDTH - 1] = 0;
                }
            } else if (fromX > nextX) {
                for (let dy = doorY - Math.floor(DOOR_WIDTH / 2); dy <= doorY + Math.floor(DOOR_WIDTH / 2); dy++) {
                    if (dy >= 0 && dy < ROOM_HEIGHT) rooms[nextY][nextX][dy][ROOM_WIDTH - 1] = 0;
                }
                for (let dy = doorY - Math.floor(DOOR_WIDTH / 2); dy <= doorY + Math.floor(DOOR_WIDTH / 2); dy++) {
                    if (dy >= 0 && dy < ROOM_HEIGHT) rooms[fromY][fromX][dy][0] = 0;
                }
            } else if (fromY < nextY) {
                for (let dx = doorX - Math.floor(DOOR_WIDTH / 2); dx <= doorX + Math.floor(DOOR_WIDTH / 2); dx++) {
                    if (dx >= 0 && dx < ROOM_WIDTH) rooms[nextY][nextX][0][dx] = 0;
                }
                for (let dx = doorX - Math.floor(DOOR_WIDTH / 2); dx <= doorX + Math.floor(DOOR_WIDTH / 2); dx++) {
                    if (dx >= 0 && dx < ROOM_WIDTH) rooms[fromY][fromX][ROOM_HEIGHT - 1][dx] = 0;
                }
            } else if (fromY > nextY) {
                for (let dx = doorX - Math.floor(DOOR_WIDTH / 2); dx <= doorX + Math.floor(DOOR_WIDTH / 2); dx++) {
                    if (dx >= 0 && dx < ROOM_WIDTH) rooms[nextY][nextX][ROOM_HEIGHT - 1][dx] = 0;
                }
                for (let dx = doorX - Math.floor(DOOR_WIDTH / 2); dx <= doorX + Math.floor(DOOR_WIDTH / 2); dx++) {
                    if (dx >= 0 && dx < ROOM_WIDTH) rooms[fromY][fromX][0][dx] = 0;
                }
            }
        }

        // Add new unvisited neighbors to frontier
        addToFrontier(nextX - 1, nextY);
        addToFrontier(nextX + 1, nextY);
        addToFrontier(nextX, nextY - 1);
        addToFrontier(nextX, nextY + 1);
    }

    // Generate unique room shapes with path to doors
    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let room = rooms[y][x];
            let shapeType = Math.floor(Math.random() * 4); // 0: Square, 1: Rectangle, 2: L-Shape, 3: Hallway
            let doors = [];
            // Identify door positions
            for (let dy = 0; dy < ROOM_HEIGHT; dy++) {
                if (room[dy][0] === 0) doors.push({ x: 0, y: dy });
                if (room[dy][ROOM_WIDTH - 1] === 0) doors.push({ x: ROOM_WIDTH - 1, y: dy });
            }
            for (let dx = 0; dx < ROOM_WIDTH; dx++) {
                if (room[0][dx] === 0) doors.push({ x: dx, y: 0 });
                if (room[ROOM_HEIGHT - 1][dx] === 0) doors.push({ x: dx, y: ROOM_HEIGHT - 1 });
            }

            // Generate shape and ensure path to doors
            switch (shapeType) {
                case 0: // Perfect Square
                    let squareSize = Math.min(ROOM_WIDTH - 4, ROOM_HEIGHT - 4);
                    let centerX = Math.floor((ROOM_WIDTH - squareSize) / 2);
                    let centerY = Math.floor((ROOM_HEIGHT - squareSize) / 2);
                    for (let ry = centerY; ry < centerY + squareSize; ry++) {
                        for (let rx = centerX; rx < centerX + squareSize; rx++) {
                            if (room[ry][rx] !== 0) room[ry][rx] = 0;
                        }
                    }
                    ensurePathToDoors(room, centerX + Math.floor(squareSize / 2), centerY + Math.floor(squareSize / 2), doors);
                    break;
                case 1: // Rectangle
                    let rectWidth = Math.floor(Math.random() * (ROOM_WIDTH - 6)) + 4;
                    let rectHeight = Math.floor(Math.random() * (ROOM_HEIGHT - 6)) + 4;
                    let rectX = Math.floor((ROOM_WIDTH - rectWidth) / 2);
                    let rectY = Math.floor((ROOM_HEIGHT - rectHeight) / 2);
                    for (let ry = rectY; ry < rectY + rectHeight; ry++) {
                        for (let rx = rectX; rx < rectX + rectWidth; rx++) {
                            if (room[ry][rx] !== 0) room[ry][rx] = 0;
                        }
                    }
                    ensurePathToDoors(room, rectX + Math.floor(rectWidth / 2), rectY + Math.floor(rectHeight / 2), doors);
                    break;
                case 2: // L-Shape
                    let lWidth = Math.floor(ROOM_WIDTH / 3);
                    let lHeight = Math.floor(ROOM_HEIGHT / 3);
                    let lX = Math.floor(ROOM_WIDTH / 2);
                    let lY = Math.floor(ROOM_HEIGHT / 2);
                    // Vertical leg
                    for (let ry = lY - lHeight; ry < lY; ry++) {
                        for (let rx = lX - lWidth; rx < lX; rx++) {
                            if (rx >= 0 && rx < ROOM_WIDTH && ry >= 0 && ry < ROOM_HEIGHT && room[ry][rx] !== 0) room[ry][rx] = 0;
                        }
                    }
                    // Horizontal leg
                    for (let ry = lY - lHeight; ry < lY + lHeight; ry++) {
                        for (let rx = lX; rx < lX + lWidth; rx++) {
                            if (rx >= 0 && rx < ROOM_WIDTH && ry >= 0 && ry < ROOM_HEIGHT && room[ry][rx] !== 0) room[ry][rx] = 0;
                        }
                    }
                    ensurePathToDoors(room, lX, lY, doors);
                    break;
                case 3: // Long Hallway
                    let hallDirection = Math.random() > 0.5 ? "horizontal" : "vertical";
                    let hallLength = Math.floor(Math.random() * (hallDirection === "horizontal" ? ROOM_WIDTH - 6 : ROOM_HEIGHT - 6)) + 6;
                    let hallWidth = 3;
                    let hallStart = Math.floor((hallDirection === "horizontal" ? ROOM_WIDTH : ROOM_HEIGHT) / 2) - Math.floor(hallLength / 2);
                    if (hallDirection === "horizontal") {
                        for (let rx = hallStart; rx < hallStart + hallLength; rx++) {
                            for (let ry = Math.floor(ROOM_HEIGHT / 2) - 1; ry <= Math.floor(ROOM_HEIGHT / 2) + 1; ry++) {
                                if (rx >= 0 && rx < ROOM_WIDTH && ry >= 0 && ry < ROOM_HEIGHT && room[ry][rx] !== 0) room[ry][rx] = 0;
                            }
                        }
                        ensurePathToDoors(room, hallStart + Math.floor(hallLength / 2), Math.floor(ROOM_HEIGHT / 2), doors);
                    } else {
                        for (let ry = hallStart; ry < hallStart + hallLength; ry++) {
                            for (let rx = Math.floor(ROOM_WIDTH / 2) - 1; rx <= Math.floor(ROOM_WIDTH / 2) + 1; rx++) {
                                if (rx >= 0 && rx < ROOM_WIDTH && ry >= 0 && ry < ROOM_HEIGHT && room[ry][rx] !== 0) room[ry][rx] = 0;
                            }
                        }
                        ensurePathToDoors(room, Math.floor(ROOM_WIDTH / 2), hallStart + Math.floor(hallLength / 2), doors);
                    }
                    break;
            }
        }
    }

    // Spawn at least one enemy per room
    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let numEnemies = Math.floor(Math.random() * 3) + 1; // 1-3 enemies per room
            for (let i = 0; i < numEnemies; i++) {
                spawnEnemy(x, y);
            }
        }
    }
}

// Helper function to ensure a path to all doors
function ensurePathToDoors(room, startX, startY, doors) {
    let visited = Array(ROOM_HEIGHT).fill().map(() => Array(ROOM_WIDTH).fill(false));
    let queue = [[startY, startX]];

    while (queue.length > 0) {
        let [y, x] = queue.shift();
        if (visited[y][x]) continue;
        visited[y][x] = true;

        // Check all four directions
        let directions = [
            [0, 1], [1, 0], [0, -1], [-1, 0] // right, down, left, up
        ];
        for (let [dy, dx] of directions) {
            let newY = y + dy;
            let newX = x + dx;
            if (newY >= 0 && newY < ROOM_HEIGHT && newX >= 0 && newX < ROOM_WIDTH && !visited[newY][newX] && room[newY][newX] !== 1) {
                queue.push([newY, newX]);
            }
        }
    }

    // If any door is unreachable, carve a path
    for (let door of doors) {
        let y = door.y, x = door.x;
        if (!visited[y][x]) {
            // Carve a simple path from start to door
            let pathY = startY, pathX = startX;
            while (pathY !== y || pathX !== x) {
                if (pathY < y && pathY + 1 < ROOM_HEIGHT) pathY++;
                else if (pathY > y && pathY - 1 >= 0) pathY--;
                else if (pathX < x && pathX + 1 < ROOM_WIDTH) pathX++;
                else if (pathX > x && pathX - 1 >= 0) pathX--;
                if (room[pathY][pathX] === 1) room[pathY][pathX] = 0;
            }
        }
    }
}

// Event listeners
document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "h") showHitboxes = !showHitboxes;
});
document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});

// Game loop
function gameLoop(timestamp) {
    update(timestamp);
    render();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update(timestamp) {
    if (isTransitioning) {
        transitionAlpha += TRANSITION_SPEED;
        if (transitionAlpha >= 1) {
            isTransitioning = false;
            transitionAlpha = 0;
            repositionPlayer();
            spawnRoomEnemies();
            transitionDirection = null;
        }
        return;
    }

    player.dx = 0;
    player.dy = 0;
    if (keys["w"]) player.dy = -player.speed;
    if (keys["s"]) player.dy = player.speed;
    if (keys["a"]) {
        player.dx = -player.speed;
        player.facingRight = false;
    }
    if (keys["d"]) {
        player.dx = player.speed;
        player.facingRight = true;
    }

    player.facing = { x: 0, y: 0 };
    let shouldShoot = false;
    if (keys["ArrowUp"]) {
        player.facing.y = -1;
        shouldShoot = true;
    }
    if (keys["ArrowDown"]) {
        player.facing.y = 1;
        shouldShoot = true;
    }
    if (keys["ArrowLeft"]) {
        player.facing.x = -1;
        shouldShoot = true;
        player.facingRight = false;
    }
    if (keys["ArrowRight"]) {
        player.facing.x = 1;
        shouldShoot = true;
        player.facingRight = true;
    }

    let magnitude = Math.sqrt(
        player.facing.x * player.facing.x + player.facing.y * player.facing.y
    );
    if (magnitude > 0) {
        player.facing.x /= magnitude;
        player.facing.y /= magnitude;
    }

    movePlayer();
    checkRoomTransition();

    if (player.invulnerable) {
        player.invulnerabilityTimer -= 16;
        player.flashTimer -= 16;
        if (player.flashTimer <= 0) {
            player.flash = !player.flash;
            player.flashTimer = FLASH_INTERVAL;
        }
        if (player.invulnerabilityTimer <= 0) {
            player.invulnerable = false;
            player.flash = false;
        }
    }

    if (player.shootCooldown > 0) {
        player.shootCooldown -= 16;
    }

    if (shouldShoot && player.shootCooldown <= 0) {
        shootProjectile();
        player.shootCooldown = SHOOT_COOLDOWN;
    }

    player.animationTimer += 16;
    if (player.animationTimer >= PLAYER_ANIMATION_SPEED) {
        player.animationFrame = (player.animationFrame + 1) % 2;
        player.animationTimer = 0;
    }

    updateEnemies();
    updateProjectiles();
}

// Render the game
function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawRoom();

    if (!player.invulnerable || (player.invulnerable && !player.flash)) {
        ctx.save();
        if (player.facingRight) {
            ctx.scale(-1, 1);
            ctx.drawImage(
                playerSprite,
                player.animationFrame * PLAYER_FRAME_WIDTH,
                0,
                PLAYER_FRAME_WIDTH,
                PLAYER_FRAME_HEIGHT,
                -(player.x + PLAYER_FRAME_WIDTH / 2),
                player.y - PLAYER_FRAME_HEIGHT / 2,
                PLAYER_FRAME_WIDTH,
                PLAYER_FRAME_HEIGHT
            );
        } else {
            ctx.drawImage(
                playerSprite,
                player.animationFrame * PLAYER_FRAME_WIDTH,
                0,
                PLAYER_FRAME_WIDTH,
                PLAYER_FRAME_HEIGHT,
                player.x - PLAYER_FRAME_WIDTH / 2,
                player.y - PLAYER_FRAME_HEIGHT / 2,
                PLAYER_FRAME_WIDTH,
                PLAYER_FRAME_HEIGHT
            );
        }
        ctx.restore();
    }

    if (showHitboxes) {
        ctx.strokeStyle = "#00ff00";
        ctx.strokeRect(
            player.x - PLAYER_FRAME_WIDTH / 2,
            player.y - PLAYER_FRAME_HEIGHT / 2,
            PLAYER_FRAME_WIDTH,
            PLAYER_FRAME_HEIGHT
        );
        ctx.beginPath();
        ctx.strokeStyle = "cyan";
        ctx.moveTo(player.x - PLAYER_FRAME_WIDTH / 2, player.y);
        ctx.lineTo(player.x + PLAYER_FRAME_WIDTH / 2, player.y);
        ctx.moveTo(player.x, player.y - PLAYER_FRAME_HEIGHT / 2);
        ctx.lineTo(player.x, player.y + PLAYER_FRAME_HEIGHT / 2);
        ctx.stroke();
    }

    enemies.forEach((enemy) => {
        ctx.fillStyle = "#f00";
        ctx.fillRect(
            enemy.x - enemy.width / 2,
            enemy.y - enemy.height / 2,
            enemy.width,
            enemy.height
        );
        ctx.fillStyle = "#f00";
        ctx.fillRect(
            enemy.x - enemy.width / 2,
            (enemy.y - enemy.height / 2) - 10,
            enemy.width * (enemy.hp / enemy.maxHp),
            5
        );
        ctx.strokeStyle = "#000";
        ctx.strokeRect(
            enemy.x - enemy.width / 2,
            (enemy.y - enemy.height / 2) - 10,
            enemy.width,
            5
        );

        if (showHitboxes) {
            ctx.strokeStyle = "gold";
            ctx.strokeRect(
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
            ctx.beginPath();
            ctx.strokeStyle = "aqua";
            ctx.moveTo(enemy.x - enemy.width / 2, enemy.y);
            ctx.lineTo(enemy.x + enemy.width / 2, enemy.y);
            ctx.moveTo(enemy.x, enemy.y - enemy.height / 2);
            ctx.lineTo(enemy.x, enemy.y + enemy.height / 2);
            ctx.stroke();
        }
    });

    projectiles.forEach((projectile) => {
        if (!projectile.trail) projectile.trail = [];
        projectile.trail.push({ x: projectile.x, y: projectile.y });
        if (projectile.trail.length > 5) projectile.trail.shift();

        ctx.save();
        for (let i = projectile.trail.length - 1; i >= 0; i--) {
            ctx.beginPath();
            ctx.arc(
                projectile.trail[i].x,
                projectile.trail[i].y,
                PROJECTILE_SIZE,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * (i + 1)})`;
            ctx.shadowColor = "cyan";
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, PROJECTILE_SIZE, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "cyan";
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (showHitboxes) {
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(
                projectile.x - projectile.width / 2,
                projectile.y - projectile.height / 2,
                projectile.width,
                projectile.height
            );
        }
    });

    ctx.fillStyle = "#f00";
    ctx.fillRect(10, 10, 100 * (player.hp / player.maxHp), 20);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(10, 10, 100, 20);
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 120, 25);

    drawMinimap();

    if (isTransitioning) {
        ctx.fillStyle = `rgba(0, 0, 0, ${transitionAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Draw the minimap
function drawMinimap() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(
        MINIMAP_X,
        MINIMAP_Y,
        TOTAL_ROOMS_X * MINIMAP_ROOM_SIZE + MINIMAP_PADDING * 2,
        TOTAL_ROOMS_Y * MINIMAP_ROOM_SIZE + MINIMAP_PADDING * 2
    );

    // Array of colors for rooms
    const roomColors = [
        ["#FF6F61", "#6B5B95", "#88B04B"], // Row 0
        ["#F7CAC9", "#92A8D1", "#955251"], // Row 1
        ["#B565A7", "#009B77", "#DD4124"]  // Row 2
    ];

    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let room = rooms[y][x];
            let roomX = MINIMAP_X + MINIMAP_PADDING + x * MINIMAP_ROOM_SIZE;
            let roomY = MINIMAP_Y + MINIMAP_PADDING + y * MINIMAP_ROOM_SIZE;

            // Use the color from the roomColors array
            ctx.fillStyle = roomColors[y][x];
            ctx.fillRect(roomX, roomY, MINIMAP_ROOM_SIZE, MINIMAP_ROOM_SIZE);

            // Highlight current room with a slightly brighter overlay
            if (x === currentRoomX && y === currentRoomY) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; // White overlay for current room
                ctx.fillRect(roomX, roomY, MINIMAP_ROOM_SIZE, MINIMAP_ROOM_SIZE);
            }

            // Draw doors with a more visible color
            ctx.fillStyle = "#FFFFFF"; // White for better visibility
            const doorSize = MINIMAP_ROOM_SIZE / 4;

            for (let dy = 0; dy < ROOM_HEIGHT; dy++) {
                if (room[dy][0] === 0) {
                    let doorY = roomY + (dy / ROOM_HEIGHT) * MINIMAP_ROOM_SIZE;
                    ctx.fillRect(roomX - doorSize / 2, doorY, doorSize, doorSize / 2);
                    break;
                }
            }
            for (let dy = 0; dy < ROOM_HEIGHT; dy++) {
                if (room[dy][ROOM_WIDTH - 1] === 0) {
                    let doorY = roomY + (dy / ROOM_HEIGHT) * MINIMAP_ROOM_SIZE;
                    ctx.fillRect(roomX + MINIMAP_ROOM_SIZE - doorSize / 2, doorY, doorSize, doorSize / 2);
                    break;
                }
            }
            for (let dx = 0; dx < ROOM_WIDTH; dx++) {
                if (room[0][dx] === 0) {
                    let doorX = roomX + (dx / ROOM_WIDTH) * MINIMAP_ROOM_SIZE;
                    ctx.fillRect(doorX, roomY - doorSize / 2, doorSize / 2, doorSize);
                    break;
                }
            }
            for (let dx = 0; dx < ROOM_WIDTH; dx++) {
                if (room[ROOM_HEIGHT - 1][dx] === 0) {
                    let doorX = roomX + (dx / ROOM_WIDTH) * MINIMAP_ROOM_SIZE;
                    ctx.fillRect(doorX, roomY + MINIMAP_ROOM_SIZE - doorSize / 2, doorSize / 2, doorSize);
                    break;
                }
            }
        }
    }

    let playerRoomX = MINIMAP_X + MINIMAP_PADDING + currentRoomX * MINIMAP_ROOM_SIZE;
    let playerRoomY = MINIMAP_Y + MINIMAP_PADDING + currentRoomY * MINIMAP_ROOM_SIZE;

    let playerOffsetX = (player.x / canvas.width) * MINIMAP_ROOM_SIZE;
    let playerOffsetY = (player.y / canvas.height) * MINIMAP_ROOM_SIZE;

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(
        playerRoomX + playerOffsetX,
        playerRoomY + playerOffsetY,
        MINIMAP_PLAYER_SIZE / 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// Projectile logic
function shootProjectile() {
    if (player.facing.x === 0 && player.facing.y === 0) return;
    let projectile = {
        x: player.x,
        y: player.y,
        width: PROJECTILE_SIZE,
        height: PROJECTILE_SIZE,
        dx: player.facing.x * 5,
        dy: player.facing.y * 5,
        trail: []
    };
    projectiles.push(projectile);
}

// Check for room transition
function checkRoomTransition() {
    let playerLeft = player.x - PLAYER_FRAME_WIDTH / 2;
    let playerRight = player.x + PLAYER_FRAME_WIDTH / 2;
    let playerTop = player.y - PLAYER_FRAME_HEIGHT / 2;
    let playerBottom = player.y + PLAYER_FRAME_HEIGHT / 2;

    if (playerLeft < 0 && currentRoomX > 0) {
        currentRoomX--;
        transitionDirection = "left";
        isTransitioning = true;
    } else if (playerRight > canvas.width && currentRoomX < TOTAL_ROOMS_X - 1) {
        currentRoomX++;
        transitionDirection = "right";
        isTransitioning = true;
    } else if (playerTop < 0 && currentRoomY > 0) {
        currentRoomY--;
        transitionDirection = "up";
        isTransitioning = true;
    } else if (playerBottom > canvas.height && currentRoomY < TOTAL_ROOMS_Y - 1) {
        currentRoomY++;
        transitionDirection = "down";
        isTransitioning = true;
    }
}

// Reposition player after transition
function repositionPlayer() {
    let currentRoom = rooms[currentRoomY][currentRoomX];
    const roomCenterX = canvas.width / 2;
    const roomCenterY = canvas.height / 2;
    let doorPosX = Math.floor(ROOM_WIDTH / 2);
    let doorPosY = Math.floor(ROOM_HEIGHT / 2);
    let targetX = 0, targetY = 0;

    // Find the door position based on transition direction
    if (transitionDirection === "left") {
        for (let y = 0; y < ROOM_HEIGHT; y++) {
            if (currentRoom[y][ROOM_WIDTH - 1] === 0) {
                doorPosY = y;
                break;
            }
        }
        targetX = (ROOM_WIDTH - 1) * TILE_SIZE + TILE_SIZE / 2;
        targetY = doorPosY * TILE_SIZE + TILE_SIZE / 2;
        targetX -= DOOR_OFFSET;
        targetY = roomCenterY;
    } else if (transitionDirection === "right") {
        for (let y = 0; y < ROOM_HEIGHT; y++) {
            if (currentRoom[y][0] === 0) {
                doorPosY = y;
                break;
            }
        }
        targetX = 0 * TILE_SIZE + TILE_SIZE / 2;
        targetY = doorPosY * TILE_SIZE + TILE_SIZE / 2;
        targetX += DOOR_OFFSET;
        targetY = roomCenterY;
    } else if (transitionDirection === "up") {
        for (let x = 0; x < ROOM_WIDTH; x++) {
            if (currentRoom[ROOM_HEIGHT - 1][x] === 0) {
                doorPosX = x;
                break;
            }
        }
        targetX = doorPosX * TILE_SIZE + TILE_SIZE / 2;
        targetY = (ROOM_HEIGHT - 1) * TILE_SIZE + TILE_SIZE / 2;
        targetY -= DOOR_OFFSET;
        targetX = roomCenterX;
    } else if (transitionDirection === "down") {
        for (let x = 0; x < ROOM_WIDTH; x++) {
            if (currentRoom[0][x] === 0) {
                doorPosX = x;
                break;
            }
        }
        targetX = doorPosX * TILE_SIZE + TILE_SIZE / 2;
        targetY = 0 * TILE_SIZE + TILE_SIZE / 2;
        targetY += DOOR_OFFSET;
        targetX = roomCenterX;
    }

    // Adjust spawn position to avoid walls
    let attempts = 0;
    const maxAttempts = 10;
    while (isColliding(targetX, targetY, player.width, player.height) && attempts < maxAttempts) {
        // Try nearby open tiles
        let offsetX = (Math.random() - 0.5) * TILE_SIZE;
        let offsetY = (Math.random() - 0.5) * TILE_SIZE;
        targetX += offsetX;
        targetY += offsetY;
        attempts++;
    }
    if (attempts >= maxAttempts) {
        // Fallback to center if no valid spot is found
        targetX = roomCenterX;
        targetY = roomCenterY;
    }

    player.x = targetX;
    player.y = targetY;
}

function spawnRoomEnemies() {
    // Load enemies from the current room's enemy list
    enemies = enemiesPerRoom[currentRoomY][currentRoomX];
}

function drawRoom() {
    let currentRoom = rooms[currentRoomY][currentRoomX];
    for (let y = 0; y < ROOM_HEIGHT; y++) {
        for (let x = 0; x < ROOM_WIDTH; x++) {
            if (currentRoom[y][x] === 1) {
                ctx.fillStyle = "#555";
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else if (currentRoom[y][x] === 0 && (x === 0 || x === ROOM_WIDTH - 1 || y === 0 || y === ROOM_HEIGHT - 1)) {
                ctx.fillStyle = "#888";
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function movePlayer() {
    let newX = player.x + player.dx;
    let newY = player.y + player.dy;
    if (!isColliding(newX, newY, player.width, player.height)) {
        player.x = newX;
        player.y = newY;
    }
}

function isColliding(x, y, width, height) {
    let currentRoom = rooms[currentRoomY][currentRoomX];
    let tileX1 = Math.floor((x - width / 2) / TILE_SIZE);
    let tileY1 = Math.floor((y - height / 2) / TILE_SIZE);
    let tileX2 = Math.floor((x + width / 2) / TILE_SIZE);
    let tileY2 = Math.floor((y + height / 2) / TILE_SIZE);

    return (
        (tileX1 >= 0 && tileX1 < ROOM_WIDTH && tileY1 >= 0 && tileY1 < ROOM_HEIGHT && currentRoom[tileY1][tileX1] === 1) ||
        (tileX2 >= 0 && tileX2 < ROOM_WIDTH && tileY1 >= 0 && tileY1 < ROOM_HEIGHT && currentRoom[tileY1][tileX2] === 1) ||
        (tileX1 >= 0 && tileX1 < ROOM_WIDTH && tileY2 >= 0 && tileY2 < ROOM_HEIGHT && currentRoom[tileY2][tileX1] === 1) ||
        (tileX2 >= 0 && tileX2 < ROOM_WIDTH && tileY2 >= 0 && tileY2 < ROOM_HEIGHT && currentRoom[tileY2][tileX2] === 1)
    );
}

function spawnEnemy(roomX, roomY) {
    let enemy = {
        x: Math.random() * (canvas.width - TILE_SIZE) + TILE_SIZE / 4,
        y: Math.random() * (canvas.height - TILE_SIZE) + TILE_SIZE / 4,
        width: TILE_SIZE / 2,
        height: TILE_SIZE / 2,
        speed: 1,
        hp: 3,
        maxHp: 3,
        roomX: roomX,
        roomY: roomY,
    };
    // Add enemy to the specific room's enemy list
    enemiesPerRoom[roomY][roomX].push(enemy);
}

function updateEnemies() {
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    enemies.forEach((enemy) => {
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }

        if (!player.invulnerable && isCollidingWith(enemy, player)) {
            player.hp--;
            player.invulnerable = true;
            player.invulnerabilityTimer = INVULNERABILITY_DURATION;
            player.flashTimer = FLASH_INTERVAL;
            player.flash = true;
        }
    });
    // Update the room's enemy list to reflect any changes (e.g., enemies killed)
    enemiesPerRoom[currentRoomY][currentRoomX] = enemies;
}

function updateProjectiles() {
    projectiles = projectiles.filter((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) return false;
        for (let enemy of enemies) {
            if (isCollidingWith(p, enemy)) {
                enemy.hp--;
                return false;
            }
        }
        return true;
    });
}

function isCollidingWith(obj1, obj2) {
    const obj1Left = obj1.x - obj1.width / 2;
    const obj1Right = obj1.x + obj1.width / 2;
    const obj1Top = obj1.y - obj1.height / 2;
    const obj1Bottom = obj1.y + obj1.height / 2;

    const obj2Left = obj2.x - obj2.width / 2;
    const obj2Right = obj2.x + obj2.width / 2;
    const obj2Top = obj2.y - obj2.height / 2;
    const obj2Bottom = obj2.y + obj2.height / 2;

    return (
        obj1Right > obj2Left &&
        obj1Left < obj2Right &&
        obj1Bottom > obj2Top &&
        obj1Top < obj2Bottom
    );
}

// Start the game
generateRooms();
spawnRoomEnemies();
gameLoop();