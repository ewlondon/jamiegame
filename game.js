const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800; // Your canvas width
canvas.height = 600; // Your canvas height
const dpr = window.devicePixelRatio || 1;
canvas.style.width = canvas.width + "px";
canvas.style.height = canvas.height + "px";
canvas.width *= dpr;
canvas.height *= dpr;
ctx.scale(dpr, dpr);
ctx.imageSmoothingEnabled = false; // Optional: combine with no smoothing

const TILE_SIZE = 40;
const ROOM_WIDTH = 40;
const ROOM_HEIGHT = 30;
const PLAYER_SPEED = 5;
const INVULNERABILITY_DURATION = 1000;
const FLASH_INTERVAL = 100;
const SHOOT_COOLDOWN = 300;
const PLAYER_FRAME_WIDTH = 64;
const PLAYER_FRAME_HEIGHT = 64;
const PLAYER_ANIMATION_SPEED = 1000 / 12;
const PROJECTILE_SIZE = 5;
const PROJECTILE_SPEED = 2.5;
const TOTAL_ROOMS_X = 3;
const TOTAL_ROOMS_Y = 3;
const TRANSITION_SPEED = 0.035;
const DOOR_WIDTH = 4;
const MIN_PATH_WIDTH = 2;
const DOOR_OFFSET = 90;
const CAMERA_DEADZONE_WIDTH = canvas.width * 0.7;
const CAMERA_DEADZONE_HEIGHT = canvas.height * 0.7;

const MINIMAP_WIDTH = 150;
const MINIMAP_HEIGHT = 100;
const MINIMAP_PADDING = 10;
const MINIMAP_X = canvas.width - MINIMAP_WIDTH - MINIMAP_PADDING;
const MINIMAP_Y = MINIMAP_PADDING;
const MINIMAP_SCALE_X =
    MINIMAP_WIDTH / (TOTAL_ROOMS_X * ROOM_WIDTH * TILE_SIZE);
const MINIMAP_SCALE_Y =
    MINIMAP_HEIGHT / (TOTAL_ROOMS_Y * ROOM_HEIGHT * TILE_SIZE);
const MINIMAP_TILE_SIZE_X = TILE_SIZE * MINIMAP_SCALE_X;
const MINIMAP_TILE_SIZE_Y = TILE_SIZE * MINIMAP_SCALE_Y;
const MINIMAP_PLAYER_SIZE = 4;

const playerSprite = new Image();
playerSprite.src = "jamie.png";

const enemySprite = new Image();
enemySprite.src = "enemy.png";

const enemySprite2 = new Image();
enemySprite2.src = "charger.png";

const enemySprite3 = new Image();
enemySprite3.src = "shooter.png";

const terrainSprite = new Image();
terrainSprite.src = "terrain.png";

// Audio setup
const titleAudio = new Audio("title.mp3");
titleAudio.loop = true;
const bgAudio = new Audio("bg.mp3");
bgAudio.loop = true;

// SFX pool to handle overlapping sounds
const SFX_POOL_SIZE = 5;
const playerHurtSFX = Array(SFX_POOL_SIZE)
    .fill()
    .map(() => {
        const audio = new Audio("player_hurt.wav");
        audio.volume = 0.2;
        return audio;
    });
const enemyHurtSFX = Array(SFX_POOL_SIZE)
    .fill()
    .map(() => {
        const audio = new Audio("enemy_hurt.wav");
        audio.volume = 0.2;
        return audio;
    });
const shootSFX = Array(SFX_POOL_SIZE)
    .fill()
    .map(() => {
        const audio = new Audio("shoot.wav");
        audio.volume = 1;
        return audio;
    });

let gameState = "title"; // "title", "playing", "gameOver"
let isPaused = false;
let isFading = false;
let fadeVolume = 0.05;

let player = {
    x: (ROOM_WIDTH * TILE_SIZE) / 2,
    y: (ROOM_HEIGHT * TILE_SIZE) / 2,
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

let camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
};

let enemiesPerRoom = Array(TOTAL_ROOMS_Y)
    .fill()
    .map(() =>
        Array(TOTAL_ROOMS_X)
            .fill()
            .map(() => [])
    );
let enemies = [];
let projectiles = [];
let keys = {};
let showHitboxes = false;
let currentRoomX = 1;
let currentRoomY = 1;
let transitionAlpha = 0;
let isTransitioning = false;
let transitionDirection = null;

let visitedRooms = Array(TOTAL_ROOMS_Y)
    .fill()
    .map(() => Array(TOTAL_ROOMS_X).fill(false));

let rooms = [];

class Graph {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.nodes = new Map();
    }

    addNode(x, y) {
        this.nodes.set(`${x},${y}`, new Set());
    }

    addEdge(x1, y1, x2, y2) {
        const key1 = `${x1},${y1}`;
        const key2 = `${x2},${y2}`;
        if (this.nodes.has(key1) && this.nodes.has(key2)) {
            this.nodes.get(key1).add(key2);
            this.nodes.get(key2).add(key1);
        }
    }

    getNeighbors(x, y) {
        return Array.from(this.nodes.get(`${x},${y}`) || []);
    }
}

function generateRooms() {
    const graph = new Graph(TOTAL_ROOMS_X, TOTAL_ROOMS_Y);
    rooms = [];

    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        let row = [];
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let room = Array(ROOM_HEIGHT)
                .fill()
                .map(() => Array(ROOM_WIDTH).fill(1));
            row.push(room);
            graph.addNode(x, y);
        }
        rooms.push(row);
    }

    const visited = new Set();
    let currentX = Math.floor(TOTAL_ROOMS_X / 2);
    let currentY = Math.floor(TOTAL_ROOMS_Y / 2);
    visited.add(`${currentX},${currentY}`);

    const directions = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
    ];

    let stack = [[currentX, currentY]];
    while (stack.length > 0) {
        let [x, y] = stack.pop();
        let shuffledDirs = directions.slice().sort(() => Math.random() - 0.5);

        for (let [dx, dy] of shuffledDirs) {
            let newX = x + dx;
            let newY = y + dy;
            let key = `${newX},${newY}`;

            if (
                newX >= 0 &&
                newX < TOTAL_ROOMS_X &&
                newY >= 0 &&
                newY < TOTAL_ROOMS_Y &&
                !visited.has(key)
            ) {
                visited.add(key);
                graph.addEdge(x, y, newX, newY);
                stack.push([newX, newY]);
            }
        }
    }

    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let neighbors = graph.getNeighbors(x, y);
            let room = rooms[y][x];
            let doorY = Math.floor(ROOM_HEIGHT / 2);
            let doorX = Math.floor(ROOM_WIDTH / 2);

            for (let neighborKey of neighbors) {
                let [nx, ny] = neighborKey.split(",").map(Number);

                if (nx < x) {
                    for (
                        let dy = doorY - Math.floor(DOOR_WIDTH / 2);
                        dy <= doorY + Math.floor(DOOR_WIDTH / 2);
                        dy++
                    ) {
                        if (dy >= 0 && dy < ROOM_HEIGHT) room[dy][0] = 0;
                    }
                } else if (nx > x) {
                    for (
                        let dy = doorY - Math.floor(DOOR_WIDTH / 2);
                        dy <= doorY + Math.floor(DOOR_WIDTH / 2);
                        dy++
                    ) {
                        if (dy >= 0 && dy < ROOM_HEIGHT)
                            room[dy][ROOM_WIDTH - 1] = 0;
                    }
                } else if (ny < y) {
                    for (
                        let dx = doorX - Math.floor(DOOR_WIDTH / 2);
                        dx <= doorX + Math.floor(DOOR_WIDTH / 2);
                        dx++
                    ) {
                        if (dx >= 0 && dx < ROOM_WIDTH) room[0][dx] = 0;
                    }
                } else if (ny > y) {
                    for (
                        let dx = doorX - Math.floor(DOOR_WIDTH / 2);
                        dx <= doorX + Math.floor(DOOR_WIDTH / 2);
                        dx++
                    ) {
                        if (dx >= 0 && dx < ROOM_HEIGHT)
                            room[ROOM_HEIGHT - 1][dx] = 0;
                    }
                }
            }

            let shapeType = Math.floor(Math.random() * 4);
            let doors = [];
            for (let dy = 0; dy < ROOM_HEIGHT; dy++) {
                if (room[dy][0] === 0) doors.push({ x: 0, y: dy });
                if (room[dy][ROOM_WIDTH - 1] === 0)
                    doors.push({ x: ROOM_WIDTH - 1, y: dy });
            }
            for (let dx = 0; dx < ROOM_WIDTH; dx++) {
                if (room[0][dx] === 0) doors.push({ x: dx, y: 0 });
                if (room[ROOM_HEIGHT - 1][dx] === 0)
                    doors.push({ x: dx, y: ROOM_HEIGHT - 1 });
            }

            switch (shapeType) {
                case 0:
                    let squareSize = Math.min(ROOM_WIDTH - 4, ROOM_HEIGHT - 4);
                    let centerX = Math.floor((ROOM_WIDTH - squareSize) / 2);
                    let centerY = Math.floor((ROOM_HEIGHT - squareSize) / 2);
                    for (let ry = centerY; ry < centerY + squareSize; ry++) {
                        for (
                            let rx = centerX;
                            rx < centerX + squareSize;
                            rx++
                        ) {
                            if (room[ry][rx] !== 0) room[ry][rx] = 0;
                        }
                    }
                    ensurePathToDoors(
                        room,
                        centerX + Math.floor(squareSize / 2),
                        centerY + Math.floor(squareSize / 2),
                        doors
                    );
                    break;
                case 1:
                    let rectWidth =
                        Math.floor(Math.random() * (ROOM_WIDTH - 6)) + 4;
                    let rectHeight =
                        Math.floor(Math.random() * (ROOM_HEIGHT - 6)) + 4;
                    let rectX = Math.floor((ROOM_WIDTH - rectWidth) / 2);
                    let rectY = Math.floor((ROOM_HEIGHT - rectHeight) / 2);
                    for (let ry = rectY; ry < rectY + rectHeight; ry++) {
                        for (let rx = rectX; rx < rectX + rectWidth; rx++) {
                            if (room[ry][rx] !== 0) room[ry][rx] = 0;
                        }
                    }
                    ensurePathToDoors(
                        room,
                        rectX + Math.floor(rectWidth / 2),
                        rectY + Math.floor(rectHeight / 2),
                        doors
                    );
                    break;
                case 2:
                    let lWidth = Math.floor(ROOM_WIDTH / 3);
                    let lHeight = Math.floor(ROOM_HEIGHT / 3);
                    let lX = Math.floor(ROOM_WIDTH / 2);
                    let lY = Math.floor(ROOM_HEIGHT / 2);
                    for (let ry = lY - lHeight; ry < lY; ry++) {
                        for (let rx = lX - lWidth; rx < lX; rx++) {
                            if (
                                rx >= 0 &&
                                rx < ROOM_WIDTH &&
                                ry >= 0 &&
                                ry < ROOM_HEIGHT &&
                                room[ry][rx] !== 0
                            )
                                room[ry][rx] = 0;
                        }
                    }
                    for (let ry = lY - lHeight; ry < lY + lHeight; ry++) {
                        for (let rx = lX; rx < lX + lWidth; rx++) {
                            if (
                                rx >= 0 &&
                                rx < ROOM_WIDTH &&
                                ry >= 0 &&
                                ry < ROOM_HEIGHT &&
                                room[ry][rx] !== 0
                            )
                                room[ry][rx] = 0;
                        }
                    }
                    ensurePathToDoors(room, lX, lY, doors);
                    break;
                case 3:
                    let hallDirection =
                        Math.random() > 0.5 ? "horizontal" : "vertical";
                    let hallLength =
                        Math.floor(
                            Math.random() *
                                (hallDirection === "horizontal"
                                    ? ROOM_WIDTH - 6
                                    : ROOM_HEIGHT - 6)
                        ) + 6;
                    let hallWidth = MIN_PATH_WIDTH;
                    let hallStart =
                        Math.floor(
                            (hallDirection === "horizontal"
                                ? ROOM_WIDTH
                                : ROOM_HEIGHT) / 2
                        ) - Math.floor(hallLength / 2);
                    if (hallDirection === "horizontal") {
                        for (
                            let rx = hallStart;
                            rx < hallStart + hallLength;
                            rx++
                        ) {
                            for (
                                let ry =
                                    Math.floor(ROOM_HEIGHT / 2) -
                                    Math.floor(hallWidth / 2);
                                ry <=
                                Math.floor(ROOM_HEIGHT / 2) +
                                    Math.floor(hallWidth / 2);
                                ry++
                            ) {
                                if (
                                    rx >= 0 &&
                                    rx < ROOM_WIDTH &&
                                    ry >= 0 &&
                                    ry < ROOM_HEIGHT &&
                                    room[ry][rx] !== 0
                                )
                                    room[ry][rx] = 0;
                            }
                        }
                        ensurePathToDoors(
                            room,
                            hallStart + Math.floor(hallLength / 2),
                            Math.floor(ROOM_HEIGHT / 2),
                            doors
                        );
                    } else {
                        for (
                            let ry = hallStart;
                            ry < hallStart + hallLength;
                            ry++
                        ) {
                            for (
                                let rx =
                                    Math.floor(ROOM_WIDTH / 2) -
                                    Math.floor(hallWidth / 2);
                                rx <=
                                Math.floor(ROOM_WIDTH / 2) +
                                    Math.floor(hallWidth / 2);
                                rx++
                            ) {
                                if (
                                    rx >= 0 &&
                                    rx < ROOM_WIDTH &&
                                    ry >= 0 &&
                                    ry < ROOM_HEIGHT &&
                                    room[ry][rx] !== 0
                                )
                                    room[ry][rx] = 0;
                            }
                        }
                        ensurePathToDoors(
                            room,
                            Math.floor(ROOM_WIDTH / 2),
                            hallStart + Math.floor(hallLength / 2),
                            doors
                        );
                    }
                    break;
            }
        }
    }

    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let numEnemies = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < numEnemies; i++) {
                let enemyType = Math.floor(Math.random() * 3);
                if (enemyType === 0) spawnBasicEnemy(x, y);
                else if (enemyType === 1) spawnChargerEnemy(x, y);
                else spawnShooterEnemy(x, y);
            }
        }
    }

    visitedRooms = Array(TOTAL_ROOMS_Y)
        .fill()
        .map(() => Array(TOTAL_ROOMS_X).fill(false));
    visitedRooms[currentRoomY][currentRoomX] = true;
}

function ensurePathToDoors(room, startX, startY, doors) {
    let visited = Array(ROOM_HEIGHT)
        .fill()
        .map(() => Array(ROOM_WIDTH).fill(false));
    let queue = [[startY, startX]];

    while (queue.length > 0) {
        let [y, x] = queue.shift();
        if (visited[y][x]) continue;
        visited[y][x] = true;

        let directions = [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
        ];
        for (let [dy, dx] of directions) {
            let newY = y + dy;
            let newX = x + dx;
            if (
                newY >= 0 &&
                newY < ROOM_HEIGHT &&
                newX >= 0 &&
                newX < ROOM_WIDTH &&
                !visited[newY][newX] &&
                room[newY][newX] !== 1
            ) {
                queue.push([newY, newX]);
            }
        }
    }

    for (let door of doors) {
        let y = door.y,
            x = door.x;
        if (!visited[y][x]) {
            let pathY = startY,
                pathX = startX;
            while (pathY !== y || pathX !== x) {
                if (pathY < y && pathY + 1 < ROOM_HEIGHT) {
                    for (
                        let offsetX = -Math.floor(MIN_PATH_WIDTH / 2);
                        offsetX <= Math.floor(MIN_PATH_WIDTH / 2);
                        offsetX++
                    ) {
                        if (
                            pathX + offsetX >= 0 &&
                            pathX + offsetX < ROOM_WIDTH
                        ) {
                            room[pathY][pathX + offsetX] = 0;
                            if (pathY + 1 < ROOM_HEIGHT)
                                room[pathY + 1][pathX + offsetX] = 0;
                        }
                    }
                    pathY++;
                } else if (pathY > y && pathY - 1 >= 0) {
                    for (
                        let offsetX = -Math.floor(MIN_PATH_WIDTH / 2);
                        offsetX <= Math.floor(MIN_PATH_WIDTH / 2);
                        offsetX++
                    ) {
                        if (
                            pathX + offsetX >= 0 &&
                            pathX + offsetX < ROOM_WIDTH
                        ) {
                            room[pathY][pathX + offsetX] = 0;
                            if (pathY - 1 >= 0)
                                room[pathY - 1][pathX + offsetX] = 0;
                        }
                    }
                    pathY--;
                } else if (pathX < x && pathX + 1 < ROOM_WIDTH) {
                    for (
                        let offsetY = -Math.floor(MIN_PATH_WIDTH / 2);
                        offsetY <= Math.floor(MIN_PATH_WIDTH / 2);
                        offsetY++
                    ) {
                        if (
                            pathY + offsetY >= 0 &&
                            pathY + offsetY < ROOM_HEIGHT
                        ) {
                            room[pathY + offsetY][pathX] = 0;
                            if (pathX + 1 < ROOM_WIDTH)
                                room[pathY + offsetY][pathX + 1] = 0;
                        }
                    }
                    pathX++;
                } else if (pathX > x && pathX - 1 >= 0) {
                    for (
                        let offsetY = -Math.floor(MIN_PATH_WIDTH / 2);
                        offsetY <= Math.floor(MIN_PATH_WIDTH / 2);
                        offsetY++
                    ) {
                        if (
                            pathY + offsetY >= 0 &&
                            pathY + offsetY < ROOM_HEIGHT
                        ) {
                            room[pathY + offsetY][pathX] = 0;
                            if (pathX - 1 >= 0)
                                room[pathY + offsetY][pathX - 1] = 0;
                        }
                    }
                    pathX--;
                }
            }
        }
    }
}

async function saveDungeon(stage = 1) {
    const dungeonData = {
        rooms: rooms,
        enemiesPerRoom: enemiesPerRoom.map((row) =>
            row.map((roomEnemies) =>
                roomEnemies.map((enemy) => ({
                    x: enemy.x,
                    y: enemy.y,
                    width: enemy.width,
                    height: enemy.height,
                    speed: enemy.speed,
                    hp: enemy.hp,
                    maxHp: enemy.maxHp,
                    roomX: enemy.roomX,
                    roomY: enemy.roomY,
                    type: enemy.type,
                    chargeTimer: enemy.chargeTimer || 0,
                    chargeDx: enemy.chargeDx || 0,
                    chargeDy: enemy.chargeDy || 0,
                    shootCooldown: enemy.shootCooldown || 0,
                    isCharging: enemy.isCharging || false,
                    hoverTimer: enemy.hoverTimer || 0,
                    isHovering: enemy.isHovering || false,
                }))
            )
        ),
        visitedRooms: visitedRooms,
    };

    try {
        const response = await fetch("/save-dungeon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage, dungeonData }),
        });
        const result = await response.json();
        if (response.ok) {
            console.log(result.message);
        } else {
            console.error(result.error);
        }
    } catch (error) {
        console.error("Error saving dungeon:", error);
    }
}

async function loadDungeon(stage = 1) {
    try {
        const response = await fetch(`/load-dungeon/${stage}`);
        if (!response.ok) {
            const errorData = await response.json();
            console.log(errorData.error);
            return false;
        }

        const dungeonData = await response.json();
        rooms = dungeonData.rooms;
        enemiesPerRoom = dungeonData.enemiesPerRoom.map((row) =>
            row.map((roomEnemies) =>
                roomEnemies.map((enemy) => ({
                    ...enemy,
                    hp: enemy.hp,
                }))
            )
        );
        visitedRooms =
            dungeonData.visitedRooms ||
            Array(TOTAL_ROOMS_Y)
                .fill()
                .map(() => Array(TOTAL_ROOMS_X).fill(false));

        resetGameState();
        console.log(`Dungeon loaded from Stage ${stage}`);
        return true;
    } catch (error) {
        console.error("Error loading dungeon:", error);
        return false;
    }
}

function resetGameState() {
    currentRoomX = 1;
    currentRoomY = 1;
    player = {
        x: (ROOM_WIDTH * TILE_SIZE) / 2,
        y: (ROOM_HEIGHT * TILE_SIZE) / 2,
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
    enemies = enemiesPerRoom[currentRoomY][currentRoomX];
    projectiles = [];
    isTransitioning = false;
    transitionAlpha = 0;
    transitionDirection = null;
    gameState = "playing";
    visitedRooms[currentRoomY][currentRoomX] = true;
    camera.x = player.x - camera.width / 2;
    camera.y = player.y - camera.height / 2;
    updateCamera();

    bgAudio.volume = 0.25;
    bgAudio.play();
}

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "h" && gameState === "playing") showHitboxes = !showHitboxes;
    if (e.key === "1" && gameState === "playing") saveDungeon();
    if (e.key === "4" && gameState === "playing") loadDungeon();
    if (e.key === "r" && gameState === "playing") {
        generateRooms();
        resetGameState();
    }
    if (e.key === "Enter") {
        if (gameState === "title" && !isFading) {
            isFading = true;
            fadeOutAudio(titleAudio, () => {
                generateRooms();
                resetGameState();
                isFading = false;
                fadeVolume = 1.0;
            });
        } else if (gameState === "gameOver" || gameState === "title") {
            bgAudio.pause();
            bgAudio.currentTime = 0;
            titleAudio.volume = 0.25;
            titleAudio.play();
            gameState = "title";
        }
    }
    if (e.key === "Escape" && gameState === "playing") {
        isPaused = !isPaused;
        if (isPaused) {
            gameState = "paused";
        }
    } else if (e.key === "Escape" && gameState === "paused") {
        isPaused = !isPaused;
        if (!isPaused) {
            gameState = "playing";
        }
    }
});
document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});

function fadeOutAudio(audio, callback) {
    const fadeDuration = 1000;
    const fadeStep = 16 / fadeDuration;
    function fade() {
        fadeVolume -= fadeStep;
        if (fadeVolume <= 0) {
            fadeVolume = 0;
            audio.pause();
            audio.currentTime = 0;
            callback();
        } else {
            audio.volume = fadeVolume;
            requestAnimationFrame(fade);
        }
    }
    fade();
}

function playSFX(sfxArray) {
    for (let sfx of sfxArray) {
        if (sfx.paused || sfx.currentTime === 0 || sfx.ended) {
            sfx.currentTime = 0; // Reset to start
            sfx.play();
            break;
        }
    }
}

function updateCamera() {
    let deadzoneLeft = camera.x + CAMERA_DEADZONE_WIDTH / 2;
    let deadzoneRight = camera.x + camera.width - CAMERA_DEADZONE_WIDTH / 2;
    let deadzoneTop = camera.y + CAMERA_DEADZONE_HEIGHT / 2;
    let deadzoneBottom = camera.y + camera.height - CAMERA_DEADZONE_HEIGHT / 2;

    if (player.x < deadzoneLeft) {
        camera.x = player.x - CAMERA_DEADZONE_WIDTH / 2;
    } else if (player.x > deadzoneRight) {
        camera.x = player.x - camera.width + CAMERA_DEADZONE_WIDTH / 2;
    }

    if (player.y < deadzoneTop) {
        camera.y = player.y - CAMERA_DEADZONE_HEIGHT / 2;
    } else if (player.y > deadzoneBottom) {
        camera.y = player.y - camera.height + CAMERA_DEADZONE_HEIGHT / 2;
    }

    camera.x = Math.max(
        0,
        Math.min(camera.x, ROOM_WIDTH * TILE_SIZE - camera.width)
    );
    camera.y = Math.max(
        0,
        Math.min(camera.y, ROOM_HEIGHT * TILE_SIZE - camera.height)
    );
}

function gameLoop(timestamp) {
    update(timestamp);
    render();
    requestAnimationFrame(gameLoop);
    if (gameState === "paused") {
        drawPauseScreen();
    }
}

function drawPauseScreen() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    ctx.font = "24px Arial";
    ctx.fillText(
        "Press ESC to resume",
        canvas.width / 2,
        canvas.height / 2 + 50
    );
}
function update(timestamp) {
    if (gameState === "title") {
        bgAudio.pause();
        bgAudio.currentTime = 0;
        titleAudio.volume = 0.25;
        titleAudio.play();
        return;
    }

    if (gameState === "playing") {
        if (isTransitioning) {
            projectiles = [];
            transitionAlpha += TRANSITION_SPEED;
            if (transitionAlpha >= 1) {
                isTransitioning = false;
                transitionAlpha = 0;
                repositionPlayer();
                spawnRoomEnemies();
                transitionDirection = null;
                visitedRooms[currentRoomY][currentRoomX] = true;
                camera.x = player.x - camera.width / 2;
                camera.y = player.y - camera.height / 2;
                updateCamera();
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
            player.facing.x * player.facing.x +
                player.facing.y * player.facing.y
        );
        if (magnitude > 0) {
            player.facing.x /= magnitude;
            player.facing.y /= magnitude;
        }

        movePlayer();
        updateCamera();
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
            shootProjectile(player, true);
            playSFX(shootSFX); // Player shoot sound
            player.shootCooldown = SHOOT_COOLDOWN;
        }

        player.animationTimer += 16;
        if (player.animationTimer >= PLAYER_ANIMATION_SPEED) {
            player.animationFrame = (player.animationFrame + 1) % 2;
            player.animationTimer = 0;
        }

        updateEnemies();
        updateProjectiles();

        if (player.hp <= 0) {
            gameState = "gameOver";
            bgAudio.pause();
            bgAudio.currentTime = 0;
        }
    }
}

function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === "title") {
        ctx.fillStyle = "#fff";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
            "Adventure of Jamie",
            canvas.width / 2,
            canvas.height / 2 - 80
        );

        ctx.font = "24px Arial";
        ctx.fillText("Controls:", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText("WASD to Move", canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(
            "Arrow Keys to Fire",
            canvas.width / 2,
            canvas.height / 2 + 60
        );

        ctx.font = "32px Arial";
        ctx.fillText(
            "Press Enter to Start",
            canvas.width / 2,
            canvas.height / 2 + 120
        );

        ctx.font = "24px Arial";
        ctx.fillText(
            "Press ESC to Pause",
            canvas.width / 2,
            canvas.height / 2 + 180
        );
        return;
    }

    if (gameState === "gameOver") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#fff";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);

        ctx.font = "24px Arial";
        ctx.fillText(
            "Press Enter to Start New Game",
            canvas.width / 2,
            canvas.height / 2 + 20
        );
        return;
    }

    // Playing state rendering
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawRoom();

    if (!player.invulnerable || (player.invulnerable && !player.flash)) {
        ctx.save();
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10;
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
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
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
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10;
        if (enemy.type === "basic") {
            ctx.drawImage(
                enemySprite,
                0,
                0,
                64,
                64,
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
        } else if (enemy.type === "charger") {
            ctx.drawImage(
                enemySprite2,
                0,
                0,
                64,
                64,
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
        } else if (enemy.type === "shooter") {
            ctx.shadowColor = "black";
            ctx.shadowBlur = 10;
            ctx.drawImage(
                enemySprite3,
                0,
                0,
                64,
                64,
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
        }

        ctx.fillStyle = "#f00";
        ctx.fillRect(
            enemy.x - enemy.width / 2,
            enemy.y - enemy.height / 2 - 10,
            enemy.width * (enemy.hp / enemy.maxHp),
            5
        );
        ctx.strokeStyle = "#000";
        ctx.strokeRect(
            enemy.x - enemy.width / 2,
            enemy.y - enemy.height / 2 - 10,
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
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
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
            ctx.fillStyle = projectile.isPlayer
                ? `rgba(255, 255, 255, ${0.2 * (i + 1)})`
                : `rgba(255, 0, 0, ${0.2 * (i + 1)})`;
            ctx.shadowColor = projectile.isPlayer ? "cyan" : "red";
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, PROJECTILE_SIZE, 0, Math.PI * 2);
        ctx.fillStyle = projectile.isPlayer ? "#fff" : "#f00";
        ctx.shadowColor = projectile.isPlayer ? "cyan" : "red";
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

    ctx.restore();

    ctx.fillStyle = "#f00";
    ctx.fillRect(10, 10, 100 * (player.hp / player.maxHp), 20);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(10, 10, 100, 20);
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 140, 25);

    drawMinimap();

    if (isTransitioning) {
        ctx.fillStyle = `rgba(0, 0, 0, ${transitionAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawMinimap() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    const roomColors = [
        ["#FF6F61", "#6B5B95", "#88B04B"],
        ["#F7CAC9", "#92A8D1", "#955251"],
        ["#B565A7", "#009B77", "#DD4124"],
    ];

    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            if (!visitedRooms[y][x]) continue;

            let room = rooms[y][x];
            let roomX =
                MINIMAP_X + x * ROOM_WIDTH * TILE_SIZE * MINIMAP_SCALE_X;
            let roomY =
                MINIMAP_Y + y * ROOM_HEIGHT * TILE_SIZE * MINIMAP_SCALE_Y;

            ctx.fillStyle = roomColors[y][x];
            for (let ry = 0; ry < ROOM_HEIGHT; ry++) {
                for (let rx = 0; rx < ROOM_WIDTH; rx++) {
                    if (room[ry][rx] === 0) {
                        ctx.fillRect(
                            roomX + rx * MINIMAP_TILE_SIZE_X,
                            roomY + ry * MINIMAP_TILE_SIZE_Y,
                            MINIMAP_TILE_SIZE_X,
                            MINIMAP_TILE_SIZE_Y
                        );
                    }
                }
            }

            if (x === currentRoomX && y === currentRoomY) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                for (let ry = 0; ry < ROOM_HEIGHT; ry++) {
                    for (let rx = 0; rx < ROOM_WIDTH; rx++) {
                        if (room[ry][rx] === 0) {
                            ctx.fillRect(
                                roomX + rx * MINIMAP_TILE_SIZE_X,
                                roomY + ry * MINIMAP_TILE_SIZE_Y,
                                MINIMAP_TILE_SIZE_X,
                                MINIMAP_TILE_SIZE_Y
                            );
                        }
                    }
                }
            }
        }
    }

    let playerRoomX =
        MINIMAP_X + currentRoomX * ROOM_WIDTH * TILE_SIZE * MINIMAP_SCALE_X;
    let playerRoomY =
        MINIMAP_Y + currentRoomY * ROOM_HEIGHT * TILE_SIZE * MINIMAP_SCALE_Y;
    let playerOffsetX = player.x * MINIMAP_SCALE_X;
    let playerOffsetY = player.y * MINIMAP_SCALE_Y;

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

function shootProjectile(shooter, isPlayer = false) {
    let facing = shooter.facing || {
        x: player.x - shooter.x,
        y: player.y - shooter.y,
    };
    let magnitude = Math.sqrt(facing.x * facing.x + facing.y * facing.y);
    if (magnitude === 0) return;

    facing.x /= magnitude;
    facing.y /= magnitude;

    let projectile = {
        x: shooter.x,
        y: shooter.y,
        width: PROJECTILE_SIZE,
        height: PROJECTILE_SIZE,
        dx: facing.x * 5,
        dy: facing.y * 5,
        trail: [],
        isPlayer: isPlayer,
    };
    projectiles.push(projectile);
    playSFX(shootSFX); // Play shoot sound for both player and enemy
}

function checkRoomTransition() {
    let playerLeft = player.x - PLAYER_FRAME_WIDTH / 2;
    let playerRight = player.x + PLAYER_FRAME_WIDTH / 2;
    let playerTop = player.y - PLAYER_FRAME_HEIGHT / 2;
    let playerBottom = player.y + PLAYER_FRAME_HEIGHT / 2;

    if (playerLeft < 0 && currentRoomX > 0) {
        currentRoomX--;
        transitionDirection = "left";
        isTransitioning = true;
        enemies = [];
    } else if (
        playerRight > ROOM_WIDTH * TILE_SIZE &&
        currentRoomX < TOTAL_ROOMS_X - 1
    ) {
        currentRoomX++;
        transitionDirection = "right";
        isTransitioning = true;
        enemies = [];
    } else if (playerTop < 0 && currentRoomY > 0) {
        currentRoomY--;
        transitionDirection = "up";
        isTransitioning = true;
        enemies = [];
    } else if (
        playerBottom > ROOM_HEIGHT * TILE_SIZE &&
        currentRoomY < TOTAL_ROOMS_Y - 1
    ) {
        currentRoomY++;
        transitionDirection = "down";
        isTransitioning = true;
        enemies = [];
    }
}

function repositionPlayer() {
    let currentRoom = rooms[currentRoomY][currentRoomX];
    let roomCenterX = (ROOM_WIDTH * TILE_SIZE) / 2;
    let roomCenterY = (ROOM_HEIGHT * TILE_SIZE) / 2;
    let doorPosX = Math.floor(ROOM_WIDTH / 2);
    let doorPosY = Math.floor(ROOM_HEIGHT / 2);
    let targetX = 0,
        targetY = 0;

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

    let attempts = 0;
    const maxAttempts = 10;
    while (
        isColliding(targetX, targetY, player.width, player.height) &&
        attempts < maxAttempts
    ) {
        let offsetX = (Math.random() - 0.5) * TILE_SIZE;
        let offsetY = (Math.random() - 0.5) * TILE_SIZE;
        targetX += offsetX;
        targetY += offsetY;
        attempts++;
    }
    if (attempts >= maxAttempts) {
        targetX = roomCenterX;
        targetY = roomCenterY;
    }

    player.x = targetX;
    player.y = targetY;
}

function spawnRoomEnemies() {
    // Create a deep copy of the enemies for the current room to avoid modifying the original array
    enemies = JSON.parse(
        JSON.stringify(enemiesPerRoom[currentRoomY][currentRoomX])
    );
}

function drawRoom() {
    if (!isTransitioning) {
        let currentRoom = rooms[currentRoomY][currentRoomX];
        // Draw floor and walls
        for (let y = 0; y < ROOM_HEIGHT; y++) {
            for (let x = 0; x < ROOM_WIDTH; x++) {
                let screenX = Math.floor(x * TILE_SIZE);
                let screenY = Math.floor(y * TILE_SIZE);
                if (
                    screenX + TILE_SIZE < camera.x ||
                    screenX > camera.x + camera.width ||
                    screenY + TILE_SIZE < camera.y ||
                    screenY > camera.y + camera.height
                ) {
                    continue;
                }

                let tileIndex = 0;
                if (currentRoom[y][x] === 1) {
                    tileIndex = getWallTileIndex(currentRoom, x, y);
                }

                let spriteX = (tileIndex % 4) * 16;
                let spriteY = Math.floor(tileIndex / 4) * 16;
                ctx.drawImage(
                    terrainSprite,
                    spriteX,
                    spriteY,
                    16,
                    16,
                    screenX,
                    screenY,
                    TILE_SIZE,
                    TILE_SIZE
                );
            }
        }

        // Draw door indicators
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // 50% opacity white
        for (let y = 0; y < ROOM_HEIGHT; y++) {
            if (currentRoom[y][0] === 0) {
                // Left door
                ctx.fillRect(0, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
            if (currentRoom[y][ROOM_WIDTH - 1] === 0) {
                // Right door
                ctx.fillRect(
                    (ROOM_WIDTH - 1) * TILE_SIZE,
                    y * TILE_SIZE,
                    TILE_SIZE,
                    TILE_SIZE
                );
            }
        }
        for (let x = 0; x < ROOM_WIDTH; x++) {
            if (currentRoom[0][x] === 0) {
                // Top door
                ctx.fillRect(x * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
            }
            if (currentRoom[ROOM_HEIGHT - 1][x] === 0) {
                // Bottom door
                ctx.fillRect(
                    x * TILE_SIZE,
                    (ROOM_HEIGHT - 1) * TILE_SIZE,
                    TILE_SIZE,
                    TILE_SIZE
                );
            }
        }
    }
}

function getWallTileIndex(room, x, y) {
    let mask = 0;
    if (y > 0 && room[y - 1][x] === 1) mask |= 8; // Up
    if (x < ROOM_WIDTH - 1 && room[y][x + 1] === 1) mask |= 1; // Right
    if (y < ROOM_HEIGHT - 1 && room[y + 1][x] === 1) mask |= 4; // Down
    if (x > 0 && room[y][x - 1] === 1) mask |= 2; // Left
    return mask;
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
        (tileX1 >= 0 &&
            tileX1 < ROOM_WIDTH &&
            tileY1 >= 0 &&
            tileY1 < ROOM_HEIGHT &&
            currentRoom[tileY1][tileX1] === 1) ||
        (tileX2 >= 0 &&
            tileX2 < ROOM_WIDTH &&
            tileY1 >= 0 &&
            tileY1 < ROOM_HEIGHT &&
            currentRoom[tileY1][tileX2] === 1) ||
        (tileX1 >= 0 &&
            tileX1 < ROOM_WIDTH &&
            tileY2 >= 0 &&
            tileY2 < ROOM_HEIGHT &&
            currentRoom[tileY2][tileX1] === 1) ||
        (tileX2 >= 0 &&
            tileX2 < ROOM_WIDTH &&
            tileY2 >= 0 &&
            tileY2 < ROOM_HEIGHT &&
            currentRoom[tileY2][tileX2] === 1)
    );
}

function spawnBasicEnemy(roomX, roomY) {
    let enemy;
    let attempts = 0;
    const maxAttempts = 50;
    const playerSpawnRadius = 150;

    do {
        enemy = {
            x:
                Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) +
                TILE_SIZE / 4,
            y:
                Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) +
                TILE_SIZE / 4,
            width: 64,
            height: 64,
            speed: 1,
            hp: 7,
            maxHp: 7,
            roomX: roomX,
            roomY: roomY,
            type: "basic",
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(enemy.x, enemy.y, enemy.width, enemy.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt(
                    (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2
                ) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        enemiesPerRoom[roomY][roomX].push(enemy);
    }
}

function spawnChargerEnemy(roomX, roomY) {
    let enemy;
    let attempts = 0;
    const maxAttempts = 50;
    const playerSpawnRadius = 150;

    do {
        enemy = {
            x:
                Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) +
                TILE_SIZE / 4,
            y:
                Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) +
                TILE_SIZE / 4,
            width: 32,
            height: 32,
            speed: 4,
            hp: 5,
            maxHp: 5,
            roomX: roomX,
            roomY: roomY,
            type: "charger",
            chargeTimer: 1000,
            isCharging: false,
            chargeDx: 0,
            chargeDy: 0,
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(enemy.x, enemy.y, enemy.width, enemy.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt(
                    (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2
                ) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        enemiesPerRoom[roomY][roomX].push(enemy);
    }
}

function spawnShooterEnemy(roomX, roomY) {
    let enemy;
    let attempts = 0;
    const maxAttempts = 50;
    const playerSpawnRadius = 150;

    do {
        enemy = {
            x:
                Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) +
                TILE_SIZE / 4,
            y:
                Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) +
                TILE_SIZE / 4,
            width: 32,
            height: 32,
            speed: 2,
            hp: 3,
            maxHp: 3,
            roomX: roomX,
            roomY: roomY,
            type: "shooter",
            shootCooldown: 700,
            hoverTimer: 3000,
            isHovering: true,
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(enemy.x, enemy.y, enemy.width, enemy.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt(
                    (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2
                ) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        enemiesPerRoom[roomY][roomX].push(enemy);
    }
}

// Modify updateEnemies to not overwrite enemiesPerRoom unless intended
function updateEnemies() {
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    enemies.forEach((enemy) => {
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (enemy.type === "basic") {
            if (distance > 0) {
                let moveX = (dx / distance) * enemy.speed;
                let moveY = (dy / distance) * enemy.speed;
                let newX = enemy.x + moveX;
                let newY = enemy.y + moveY;

                if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                    enemy.x = newX;
                    enemy.y = newY;
                } else {
                    let altDirections = [
                        { dx: enemy.speed, dy: 0 },
                        { dx: -enemy.speed, dy: 0 },
                        { dx: 0, dy: enemy.speed },
                        { dx: 0, dy: -enemy.speed },
                    ];

                    for (let alt of altDirections) {
                        newX = enemy.x + alt.dx;
                        newY = enemy.y + alt.dy;
                        if (
                            !isColliding(newX, newY, enemy.width, enemy.height)
                        ) {
                            enemy.x = newX;
                            enemy.y = newY;
                            break;
                        }
                    }
                }
            }
        } else if (enemy.type === "charger") {
            const detectionRadius = 200;
            if (!enemy.isCharging) {
                if (distance < detectionRadius) {
                    enemy.chargeTimer -= 16;
                    if (enemy.chargeTimer <= 0) {
                        enemy.isCharging = true;
                        if (distance > 0) {
                            enemy.chargeDx = dx / distance;
                            enemy.chargeDy = dy / distance;
                        } else {
                            enemy.chargeDx = 0;
                            enemy.chargeDy = 0;
                        }
                    }
                }
            } else {
                let targetDx = dx / distance;
                let targetDy = dy / distance;
                enemy.chargeDx += (targetDx - enemy.chargeDx) * 0.05;
                enemy.chargeDy += (targetDy - enemy.chargeDy) * 0.05;
                let magnitude = Math.sqrt(
                    enemy.chargeDx * enemy.chargeDx +
                        enemy.chargeDy * enemy.chargeDy
                );
                if (magnitude > 0) {
                    enemy.chargeDx /= magnitude;
                    enemy.chargeDy /= magnitude;
                }

                let newX = enemy.x + enemy.chargeDx * enemy.speed;
                let newY = enemy.y + enemy.chargeDy * enemy.speed;
                if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                    enemy.x = newX;
                    enemy.y = newY;
                } else {
                    let altX = enemy.x + enemy.chargeDx * enemy.speed;
                    let altY = enemy.y;
                    if (!isColliding(altX, altY, enemy.width, enemy.height)) {
                        enemy.x = altX;
                    } else {
                        altX = enemy.x;
                        altY = enemy.y + enemy.chargeDy * enemy.speed;
                        if (
                            !isColliding(altX, altY, enemy.width, enemy.height)
                        ) {
                            enemy.y = altY;
                        } else {
                            enemy.isCharging = false;
                            enemy.chargeTimer = 1000;
                            enemy.chargeDx = 0;
                            enemy.chargeDy = 0;
                        }
                    }
                }
            }
        } else if (enemy.type === "shooter") {
            if (enemy.isHovering) {
                enemy.hoverTimer -= 16;
                enemy.shootCooldown -= 16;
                if (enemy.shootCooldown <= 0) {
                    shootProjectile(enemy, false);
                    enemy.shootCooldown = 700;
                }
                if (enemy.hoverTimer <= 0) {
                    enemy.isHovering = false;
                    let angle = Math.random() * Math.PI * 2;
                    let distance = 100 + Math.random() * 50;
                    enemy.targetX = player.x + Math.cos(angle) * distance;
                    enemy.targetY = player.y + Math.sin(angle) * distance;
                    enemy.targetX = Math.max(
                        enemy.width / 2,
                        Math.min(
                            enemy.targetX,
                            ROOM_WIDTH * TILE_SIZE - enemy.width / 2
                        )
                    );
                    enemy.targetY = Math.max(
                        enemy.height / 2,
                        Math.min(
                            enemy.targetY,
                            ROOM_HEIGHT * TILE_SIZE - enemy.height / 2
                        )
                    );
                }
            } else {
                let dxToTarget = enemy.targetX - enemy.x;
                let dyToTarget = enemy.targetY - enemy.y;
                let distToTarget = Math.sqrt(
                    dxToTarget * dxToTarget + dyToTarget * dyToTarget
                );
                if (distToTarget > enemy.speed) {
                    let moveX = (dxToTarget / distToTarget) * enemy.speed;
                    let moveY = (dyToTarget / distToTarget) * enemy.speed;
                    let newX = enemy.x + moveX;
                    let newY = enemy.y + moveY;

                    if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                        enemy.x = newX;
                        enemy.y = newY;
                    } else {
                        let altX = enemy.x + moveX;
                        let altY = enemy.y;
                        if (
                            !isColliding(altX, altY, enemy.width, enemy.height)
                        ) {
                            enemy.x = altX;
                        } else {
                            altX = enemy.x;
                            altY = enemy.y + moveY;
                            if (
                                !isColliding(
                                    altX,
                                    altY,
                                    enemy.width,
                                    enemy.height
                                )
                            ) {
                                enemy.y = altY;
                            } else {
                                enemy.isHovering = true;
                                enemy.hoverTimer = 3000;
                            }
                        }
                    }
                } else {
                    enemy.x = enemy.targetX;
                    enemy.y = enemy.targetY;
                    enemy.isHovering = true;
                    enemy.hoverTimer = 3000;
                }
            }
        }

        if (!player.invulnerable && isCollidingWith(enemy, player)) {
            player.hp--;
            player.invulnerable = true;
            player.invulnerabilityTimer = INVULNERABILITY_DURATION;
            player.flashTimer = FLASH_INTERVAL;
            player.flash = true;
            playSFX(playerHurtSFX); // Player hurt sound
        }
    });
    // Remove this line to prevent overwriting the original enemiesPerRoom data
    // enemiesPerRoom[currentRoomY][currentRoomX] = enemies;
}

function updateProjectiles() {
    projectiles = projectiles.filter((p) => {
        p.x += p.isPlayer ? p.dx * PROJECTILE_SPEED : p.dx;
        p.y += p.isPlayer ? p.dy * PROJECTILE_SPEED : p.dy;
        if (
            p.x < 0 ||
            p.x > ROOM_WIDTH * TILE_SIZE ||
            p.y < 0 ||
            p.y > ROOM_HEIGHT * TILE_SIZE
        )
            return false;

        if (p.isPlayer) {
            for (let enemy of enemies) {
                if (isCollidingWith(p, enemy)) {
                    enemy.hp--;
                    playSFX(enemyHurtSFX); // Enemy hurt sound
                    return false;
                }
            }
        } else {
            if (!player.invulnerable && isCollidingWith(p, player)) {
                player.hp--;
                player.invulnerable = true;
                player.invulnerabilityTimer = INVULNERABILITY_DURATION;
                player.flashTimer = FLASH_INTERVAL;
                player.flash = true;
                playSFX(playerHurtSFX); // Player hurt sound
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

// Wait for assets to load before starting
Promise.all([
    new Promise((resolve) => (playerSprite.onload = resolve)),
    new Promise((resolve) => (enemySprite.onload = resolve)),
    new Promise((resolve) => (terrainSprite.onload = resolve)),
]).then(() => {
    titleAudio.play();
    gameLoop();
});
