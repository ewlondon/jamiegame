const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 600;
const dpr = window.devicePixelRatio || 1;
canvas.style.width = canvas.width + "px";
canvas.style.height = canvas.height + "px";
canvas.width *= dpr;
canvas.height *= dpr;
ctx.scale(dpr, dpr);
ctx.imageSmoothingEnabled = false;

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


const POWERUP_SIZE = 32;
const POWERUP_DURATION = 10000; // 10 seconds
const INVENTORY_X = 10;
const INVENTORY_Y = canvas.height - 60;
const INVENTORY_WIDTH = 200;
const INVENTORY_HEIGHT = 50;



// Arrays for items
let itemsPerRoom = Array(TOTAL_ROOMS_Y)
    .fill()
    .map(() => Array(TOTAL_ROOMS_X).fill([]));
let items = [];


const playerSprite = new Image();
playerSprite.src = "jamie.png";

const enemySprite = new Image();
enemySprite.src = "enemy.png";

const enemySprite2 = new Image();
enemySprite2.src = "charger.png";

const enemySprite3 = new Image();
enemySprite3.src = "shooter.png";

const powerUpSprite = new Image();
powerUpSprite.src = "powerup.png"; // Add your power-up sprite image


const terrainSprite = new Image();
terrainSprite.src = "terrain.png";

const enemySpriteCanvas = document.createElement("canvas");
const enemySpriteCtx = enemySpriteCanvas.getContext("2d");
enemySpriteCanvas.width = 64; // Match sprite dimensions
enemySpriteCanvas.height = 64;

const enemySprite2Canvas = document.createElement("canvas");
const enemySprite2Ctx = enemySprite2Canvas.getContext("2d");
enemySprite2Canvas.width = 64;
enemySprite2Canvas.height = 64;

const enemySprite3Canvas = document.createElement("canvas");
const enemySprite3Ctx = enemySprite3Canvas.getContext("2d");
enemySprite3Canvas.width = 64;
enemySprite3Canvas.height = 64;


let enemySpriteData, enemySprite2Data, enemySprite3Data;

let lastModified = 0;

async function checkTilesetUpdate() {
    try {
        const response = await fetch('/tileset-info');
        const data = await response.json();
        if (data.lastModified > lastModified) {
            console.log('Tileset updated, reloading...');
            lastModified = data.lastModified;
            reloadTileset();
        }
    } catch (error) {
        console.error('Error checking tileset update:', error);
    }
}

function reloadTileset() {
    const newTerrainSprite = new Image();
    newTerrainSprite.src = `terrain.png?${Date.now()}`; // Cache-busting with timestamp
    newTerrainSprite.onload = () => {
        terrainSprite.src = newTerrainSprite.src; // Replace the old sprite
        console.log('Tileset reloaded successfully');
    };
    newTerrainSprite.onerror = () => {
        console.error('Failed to reload tileset');
    };
}

// Poll every 2 seconds
setInterval(checkTilesetUpdate, 2000);

function preprocessSprite(sprite, offscreenCtx) {
    offscreenCtx.drawImage(sprite, 0, 0, 64, 64);
    return offscreenCtx.getImageData(0, 0, 64, 64);
}

function createRedFlashImageData(originalData) {
    const newData = new ImageData(
        new Uint8ClampedArray(originalData.data),
        originalData.width,
        originalData.height
    );
    const pixels = newData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 128) {
            pixels[i] = 255;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
        }
    }

    return newData;
}

const titleAudio = new Audio("title.mp3");
titleAudio.loop = true;
const bgAudio = new Audio("bg.mp3");
bgAudio.loop = true;


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

let gameState = "title";
let isPaused = false;
let isFading = false;
let fadeVolume = 0.05;

let lastTime = 0;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

let player = {
    x: (ROOM_WIDTH * TILE_SIZE) / 2,
    y: (ROOM_HEIGHT * TILE_SIZE) / 2,
    width: PLAYER_FRAME_WIDTH,
    height: PLAYER_FRAME_HEIGHT,
    speed: PLAYER_SPEED,
    dx: 0,
    dy: 0,
    hp: 15,
    maxHp: 15,
    invulnerable: false,
    invulnerabilityTimer: 0,
    flash: false,
    flashTimer: 0,
    facing: { x: 0, y: 0 },
    shootCooldown: 0,
    animationFrame: 0,
    animationTimer: 0,
    facingRight: false,
    spreadShots: 0,
};
// Add to player object
player.powerUp = null;
player.powerUpTimer = 0;
let camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
};

let enemiesPerRoom = Array(TOTAL_ROOMS_Y)
    .fill()
    .map(() => Array(TOTAL_ROOMS_X).fill([]));
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

function spawnPowerUp(roomX, roomY) {
    let powerUp;
    let attempts = 0;
    const maxAttempts = 250;
    const playerSpawnRadius = 150;

    do {
        powerUp = {
            x: Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 2,
            y: Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 2,
            width: POWERUP_SIZE,
            height: POWERUP_SIZE,
            type: "spreadShot",
            roomX: roomX,
            roomY: roomY,
            collected: false,
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(powerUp.x, powerUp.y, powerUp.width, powerUp.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt((powerUp.x - player.x) ** 2 + (powerUp.y - player.y) ** 2) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        itemsPerRoom[roomY][roomX].push(powerUp);
    }
}

async function saveDungeon(stage = 1) {
    const dungeonData = {
        rooms: rooms,
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
        hp: 15,
        maxHp: 15,
        invulnerable: false,
        invulnerabilityTimer: 0,
        flash: false,
        flashTimer: 0,
        facing: { x: 0, y: 0 },
        shootCooldown: 0,
        animationFrame: 0,
        animationTimer: 0,
        facingRight: false,
        spreadShots: 0,
    };
    enemies = [];
    projectiles = [];
    isTransitioning = false;
    transitionAlpha = 0;
    transitionDirection = null;
    gameState = "playing";
    visitedRooms[currentRoomY][currentRoomX] = true;
    camera.x = player.x - camera.width / 2;
    camera.y = player.y - camera.height / 2;
    updateCamera();
    spawnRoomEnemies();

    bgAudio.volume = 0.25;
    bgAudio.play();
}

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === 'p') {
        player.hp = 99999;
        player.maxHp = 99999;
    }
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
                fadeVolume = .25;
            });
        } else if (gameState === "gameOver" || gameState === "title") {
            bgAudio.pause();
            titleAudio.volume = 0.25;
            titleAudio.play();
            gameState = "title";
        }
    }
    if (e.key === "Escape" && gameState === "playing") {
        bgAudio.pause();
        isPaused = !isPaused;
        if (isPaused) {
            gameState = "paused";
        }
    } else if (e.key === "Escape" && gameState === "paused") {
        bgAudio.play();
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
            sfx.currentTime = 0;
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
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;

    if (deltaTime >= FRAME_TIME) {
        if (gameState !== "paused") {
            update(timestamp);
        }
        render();
        lastTime = timestamp - (deltaTime % FRAME_TIME);
    }

    requestAnimationFrame(gameLoop);
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

        // Player movement
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

        // Player facing direction for shooting
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

        // Move player and update camera
        movePlayer();
        updateCamera();
        checkRoomTransition();

        // Handle player invulnerability
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

        // Handle shooting cooldown
        if (player.shootCooldown > 0) {
            player.shootCooldown -= 16;
        }

        if (shouldShoot && player.shootCooldown <= 0) {
            shootProjectile(player, true);
            playSFX(shootSFX);
            player.shootCooldown = SHOOT_COOLDOWN;
        }

        // Player animation
        player.animationTimer += 16;
        if (player.animationTimer >= PLAYER_ANIMATION_SPEED) {
            player.animationFrame = (player.animationFrame + 1) % 2;
            player.animationTimer = 0;
        }

        // Check for item pickup
        itemsPerRoom[currentRoomY][currentRoomX].forEach((item, index) => {
            if (!item.collected && isCollidingWith(player, item)) {
                item.collected = true;
                if (item.type === "spreadShot") {
                    player.powerUp = "spreadShot";
                    // Progress spreadShots: 0 -> 3 -> 5 -> 7
                    if (player.spreadShots === 0) {
                        player.spreadShots = 3;
                    } else if (player.spreadShots === 3) {
                        player.spreadShots = 5;
                    } else if (player.spreadShots === 5) {
                        player.spreadShots = 7;
                    } // No change if already 7
                    player.powerUpTimer = POWERUP_DURATION;
                    console.log(`Picked up spreadShot, now ${player.spreadShots} shots`);
                }
            }
        });

        // // Update power-up timer
        // if (player.powerUp && player.powerUpTimer > 0) {
        //     player.powerUpTimer -= 16;
        //     if (player.powerUpTimer <= 0) {
        //         player.powerUp = null;
        //         player.powerUpTimer = 0;
        //         console.log("Power-up expired");
        //     }
        // }



        // Update game entities
        updateEnemies();
        updateProjectiles();

        // Check for game over
        if (player.hp <= 0) {
            gameState = "gameOver";
            bgAudio.pause();
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

        ctx.save();

        let sprite, originalData, offscreenCanvas, offscreenCtx;
        if (enemy.type === "basic") {
            sprite = enemySprite;
            originalData = enemySpriteData;
            offscreenCanvas = enemySpriteCanvas;
            offscreenCtx = enemySpriteCtx;
        } else if (enemy.type === "charger") {
            sprite = enemySprite2;
            originalData = enemySprite2Data;
            offscreenCanvas = enemySprite2Canvas;
            offscreenCtx = enemySprite2Ctx;
        } else if (enemy.type === "shooter") {
            sprite = enemySprite3;
            originalData = enemySprite3Data;
            offscreenCanvas = enemySprite3Canvas;
            offscreenCtx = enemySprite3Ctx;
        }

        // Flip sprite if facing left
        if (!enemy.facingRight) {
            ctx.scale(-1, 1);
            ctx.translate(-enemy.x * 2, 0); // Adjust position after flip
        }

        if (enemy.flash) {
            offscreenCtx.clearRect(0, 0, 64, 64);
            const redFlashData = createRedFlashImageData(originalData, offscreenCtx);
            offscreenCtx.putImageData(redFlashData, 0, 0);
            ctx.drawImage(
                offscreenCanvas,
                0,
                0,
                64,
                64,
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
        } else {
            ctx.drawImage(
                sprite,
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

        ctx.restore();


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
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 150, 25);

    drawMinimap();

    if (isTransitioning) {
        ctx.fillStyle = `rgba(0, 0, 0, ${transitionAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (gameState === "paused") {
        drawPauseScreen();
    }

    if (gameState === "playing") {
        // Draw inventory
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(INVENTORY_X, INVENTORY_Y, INVENTORY_WIDTH, INVENTORY_HEIGHT);
        ctx.fillStyle = "#fff";
        ctx.font = "16px Arial";
        if (player.powerUp) {
            ctx.drawImage(
                powerUpSprite,
                0, 0, 32, 32,
                INVENTORY_X + 10,
                INVENTORY_Y+ 8,
                32, 32


            );
        }

        // Draw items
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        items.forEach(item => {
            if (!item.collected) {
                ctx.drawImage(
                    powerUpSprite,
                    0, 0, 32, 32,
                    item.x - item.width / 2,
                    item.y - item.height / 2,
                    item.width,
                    item.height
                );
            }
        });
        ctx.restore();
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
    itemsPerRoom.forEach((row, y) => {
        row.forEach((roomItems, x) => {
            if (visitedRooms[y][x]) {
                roomItems.forEach(item => {
                    if (!item.collected) {
                        let itemX = MINIMAP_X + x * ROOM_WIDTH * TILE_SIZE * MINIMAP_SCALE_X + item.x * MINIMAP_SCALE_X;
                        let itemY = MINIMAP_Y + y * ROOM_HEIGHT * TILE_SIZE * MINIMAP_SCALE_Y + item.y * MINIMAP_SCALE_Y;
                        ctx.fillStyle = "gold";
                        ctx.beginPath();
                        ctx.arc(itemX, itemY, MINIMAP_PLAYER_SIZE / 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
            }
        });
    });

    let playerRoomX =
        MINIMAP_X + currentRoomX * ROOM_WIDTH * TILE_SIZE * MINIMAP_SCALE_X;
    let playerRoomY =
        MINIMAP_Y + currentRoomY * ROOM_HEIGHT * TILE_SIZE * MINIMAP_SCALE_Y;
    let playerOffsetX = player.x * MINIMAP_SCALE_X;
    let playerOffsetY = player.y * MINIMAP_SCALE_Y;
    if (!isTransitioning) {

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

    const projectileSpeed = 5; // Base speed consistent across all shots

    if (isPlayer && player.powerUp === "spreadShot" && player.spreadShots > 0) {
        const numShots = player.spreadShots; // Use spreadShots directly (3, 5, or 7)
        const maxAngle = Math.PI / 6; // Maximum spread angle (30 degrees total)
        const angleStep = numShots > 1 ? maxAngle / ((numShots - 1) / 2) : 0;

        for (let i = 0; i < numShots; i++) {
            let angleOffset = (i - (numShots - 1) / 2) * angleStep;
            let shotDx = Math.cos(angleOffset) * facing.x - Math.sin(angleOffset) * facing.y;
            let shotDy = Math.sin(angleOffset) * facing.x + Math.cos(angleOffset) * facing.y;

            let shotMag = Math.sqrt(shotDx * shotDx + shotDy * shotDy);
            shotDx = (shotDx / shotMag) * projectileSpeed;
            shotDy = (shotDy / shotMag) * projectileSpeed;

            projectiles.push({
                x: shooter.x,
                y: shooter.y,
                width: PROJECTILE_SIZE,
                height: PROJECTILE_SIZE,
                dx: shotDx,
                dy: shotDy,
                trail: [],
                isPlayer: true,
            });
        }
    } else {
        let projectile = {
            x: shooter.x,
            y: shooter.y,
            width: PROJECTILE_SIZE,
            height: PROJECTILE_SIZE,
            dx: facing.x * projectileSpeed,
            dy: facing.y * projectileSpeed,
            trail: [],
            isPlayer: isPlayer,
        };
        projectiles.push(projectile);
    }
    playSFX(shootSFX);
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
        enemies = []; // Clear enemies on room change
    } else if (
        playerRight > ROOM_WIDTH * TILE_SIZE &&
        currentRoomX < TOTAL_ROOMS_X - 1
    ) {
        currentRoomX++;
        transitionDirection = "right";
        isTransitioning = true;
        enemies = []; // Clear enemies on room change
    } else if (playerTop < 0 && currentRoomY > 0) {
        currentRoomY--;
        transitionDirection = "up";
        isTransitioning = true;
        enemies = []; // Clear enemies on room change
    } else if (
        playerBottom > ROOM_HEIGHT * TILE_SIZE &&
        currentRoomY < TOTAL_ROOMS_Y - 1
    ) {
        currentRoomY++;
        transitionDirection = "down";
        isTransitioning = true;
        enemies = []; // Clear enemies on room change
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
    enemies = [];
    let numEnemies = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numEnemies; i++) {
        let enemyType = Math.floor(Math.random() * 3);
        if (enemyType === 0) spawnBasicEnemy(currentRoomX, currentRoomY);
        else if (enemyType === 1) spawnChargerEnemy(currentRoomX, currentRoomY);
        else spawnShooterEnemy(currentRoomX, currentRoomY);
    }
    // 20% chance to spawn a power-up
    if (Math.random() > 0 && itemsPerRoom[currentRoomY][currentRoomX].length === 0) {
        spawnPowerUp(currentRoomX, currentRoomY);
    }
    items = itemsPerRoom[currentRoomY][currentRoomX];
}

function drawRoom() {
    if (!isTransitioning) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the rendering area

        let currentRoom = rooms[currentRoomY][currentRoomX];
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

        // Draw items in the current room
        itemsPerRoom[currentRoomY][currentRoomX].forEach((item) => {
            if (!item.collected) {
                ctx.drawImage(
                    powerUpSprite,
                    0,
                    0,
                    32,
                    32,
                    item.x - item.width / 2,
                    item.y - item.height / 2,
                    item.width,
                    item.height
                );
            }
        });

        // Draw door shadows
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        for (let y = 0; y < ROOM_HEIGHT; y++) {
            if (currentRoom[y][0] === 0) {
                ctx.fillRect(0, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
            if (currentRoom[y][ROOM_WIDTH - 1] === 0) {
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
                ctx.fillRect(x * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
            }
            if (currentRoom[ROOM_HEIGHT - 1][x] === 0) {
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
    if (y > 0 && room[y - 1][x] === 1) mask |= 8;
    if (x < ROOM_WIDTH - 1 && room[y][x + 1] === 1) mask |= 1;
    if (y < ROOM_HEIGHT - 1 && room[y + 1][x] === 1) mask |= 4;
    if (x > 0 && room[y][x - 1] === 1) mask |= 2;
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
    let tileX1 = Math.floor((x - width / 4) / TILE_SIZE); // Reduced hitbox
    let tileY1 = Math.floor((y - height / 4) / TILE_SIZE);
    let tileX2 = Math.floor((x + width / 4) / TILE_SIZE);
    let tileY2 = Math.floor((y + height / 4) / TILE_SIZE);

    let result =
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
            currentRoom[tileY2][tileX2] === 1);

    console.log(`Collision check at (${x}, ${y}) with size (${width}, ${height}): ${result}`);
    return result;
}


function spawnBasicEnemy(roomX, roomY) {
    let enemy;
    let attempts = 0;
    const maxAttempts = 50;
    const playerSpawnRadius = 150;

    do {
        enemy = {
            x: Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 4,
            y: Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 4,
            width: 64,
            height: 64,
            speed: 3.5, // Ensure this is set
            hp: 7,
            maxHp: 7,
            roomX: roomX,
            roomY: roomY,
            type: "basic",
            invulnerable: false,
            invulnerabilityTimer: 0,
            flash: false,
            flashTimer: 0,
            facingRight: true,
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(enemy.x, enemy.y, enemy.width, enemy.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        enemies.push(enemy);
        console.log(`Spawned basic enemy at (${enemy.x}, ${enemy.y}) with speed ${enemy.speed}`);
    } else {
        enemy.x = ROOM_WIDTH * TILE_SIZE / 2;
        enemy.y = ROOM_HEIGHT * TILE_SIZE / 2;
        enemies.push(enemy);
        console.log(`Fallback spawn at (${enemy.x}, ${enemy.y}) with speed ${enemy.speed}`);
    }
}


function spawnChargerEnemy(roomX, roomY) {
    let enemy;
    let attempts = 0;
    const maxAttempts = 50;
    const playerSpawnRadius = 150;

    do {
        enemy = {
            x: Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 4,
            y: Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 4,
            width: 32,
            height: 32,
            speed: 2, // Slow base speed
            chargeSpeed: 8, // Fast charge speed
            hp: 5,
            maxHp: 5,
            roomX: roomX,
            roomY: roomY,
            type: "charger",
            chargeTimer: 1500, // 1.5 seconds
            isCharging: false,
            chargeDx: 0,
            chargeDy: 0,
            invulnerable: false,
            invulnerabilityTimer: 0,
            flash: false,
            flashTimer: 0,
            facingRight: true,
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(enemy.x, enemy.y, enemy.width, enemy.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        enemies.push(enemy);
    }
}

function updateEnemies() {
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    enemies.forEach((enemy) => {
        if (enemy.invulnerable) {
            enemy.invulnerabilityTimer -= 16;
            enemy.flashTimer -= 16;
            if (enemy.flashTimer <= 0) {
                enemy.flash = !enemy.flash;
                enemy.flashTimer = FLASH_INTERVAL;
            }
            if (enemy.invulnerabilityTimer <= 0) {
                enemy.invulnerable = false;
                enemy.flash = false;
            }
        }

        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (enemy.type === "basic") {
            console.log(`Basic enemy at (${enemy.x}, ${enemy.y}), distance to player: ${distance}`); // Debug log

            if (distance > 0) {
                let moveX = (dx / distance) * enemy.speed;
                let moveY = (dy / distance) * enemy.speed;
                let newX = enemy.x + moveX;
                let newY = enemy.y + moveY;

                // Update facing direction
                enemy.facingRight = moveX >= 0;

                console.log(`Attempting move: (${moveX}, ${moveY}) to (${newX}, ${newY})`); // Debug log

                if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                    console.log(`Moving to (${newX}, ${newY})`); // Debug log
                    enemy.x = newX;
                    enemy.y = newY;
                } else {
                    console.log("Collision detected, trying alternatives"); // Debug log
                    let altDirections = [
                        { dx: enemy.speed, dy: 0 },
                        { dx: -enemy.speed, dy: 0 },
                        { dx: 0, dy: enemy.speed },
                        { dx: 0, dy: -enemy.speed },
                    ];

                    for (let alt of altDirections) {
                        newX = enemy.x + alt.dx;
                        newY = enemy.y + alt.dy;
                        if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                            console.log(`Alternative move to (${newX}, ${newY})`); // Debug log
                            enemy.x = newX;
                            enemy.y = newY;
                            enemy.facingRight = alt.dx >= 0;
                            break;
                        }
                    }
                }
            } else {
                console.log("Enemy too close to player, no movement"); // Debug log
            }
        } else if (enemy.type === "charger") {
            const detectionRadius = 1200;
            if (!enemy.isCharging) {
                if (distance > 0) {
                    let moveX = (dx / distance) * enemy.speed;
                    let moveY = (dy / distance) * enemy.speed;
                    let newX = enemy.x + moveX;
                    let newY = enemy.y + moveY;
                    enemy.facingRight = moveX >= 0;

                    if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                        enemy.x = newX;
                        enemy.y = newY;
                    }
                }

                if (distance < detectionRadius) {
                    enemy.chargeTimer -= 16;
                    if (enemy.chargeTimer <= 0) {
                        enemy.isCharging = true;
                        if (distance > 0) {
                            enemy.chargeDx = dx / distance;
                            enemy.chargeDy = dy / distance;
                            enemy.facingRight = enemy.chargeDx >= 0;
                        } else {
                            enemy.chargeDx = 0;
                            enemy.chargeDy = 0;
                        }
                    }
                }
            } else {
                let newX = enemy.x + enemy.chargeDx * enemy.chargeSpeed;
                let newY = enemy.y + enemy.chargeDy * enemy.chargeSpeed;
                enemy.facingRight = enemy.chargeDx >= 0;

                if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                    enemy.x = newX;
                    enemy.y = newY;
                } else {
                    enemy.isCharging = false;
                    enemy.chargeTimer = 1500;
                    enemy.chargeDx = 0;
                    enemy.chargeDy = 0;
                }
            }
        } else if (enemy.type === "shooter") {
            enemy.facingRight = dx >= 0;

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
                        Math.min(enemy.targetX, ROOM_WIDTH * TILE_SIZE - enemy.width / 2)
                    );
                    enemy.targetY = Math.max(
                        enemy.height / 2,
                        Math.min(enemy.targetY, ROOM_HEIGHT * TILE_SIZE - enemy.height / 2)
                    );
                }
            } else {
                let dxToTarget = enemy.targetX - enemy.x;
                let dyToTarget = enemy.targetY - enemy.y;
                let distToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);
                if (distToTarget > enemy.speed) {
                    let moveX = (dxToTarget / distToTarget) * enemy.speed;
                    let moveY = (dyToTarget / distToTarget) * enemy.speed;
                    let newX = enemy.x + moveX;
                    let newY = enemy.y + moveY;

                    enemy.facingRight = moveX >= 0;

                    if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                        enemy.x = newX;
                        enemy.y = newY;
                    } else {
                        let altX = enemy.x + moveX;
                        let altY = enemy.y;
                        if (!isColliding(altX, altY, enemy.width, enemy.height)) {
                            enemy.x = altX;
                        } else {
                            altX = enemy.x;
                            altY = enemy.y + moveY;
                            if (!isColliding(altX, altY, enemy.width, enemy.height)) {
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
            playSFX(playerHurtSFX);
        }
    });
}

function spawnShooterEnemy(roomX, roomY) {
    let enemy;
    let attempts = 0;
    const maxAttempts = 50;
    const playerSpawnRadius = 150;

    do {
        enemy = {
            x: Math.random() * (ROOM_WIDTH * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 4,
            y: Math.random() * (ROOM_HEIGHT * TILE_SIZE - TILE_SIZE) + TILE_SIZE / 4,
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
            invulnerable: false,
            invulnerabilityTimer: 0,
            flash: false,
            flashTimer: 0,
            facingRight: true, // Default facing right
        };
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isColliding(enemy.x, enemy.y, enemy.width, enemy.height) ||
            (roomX === currentRoomX &&
                roomY === currentRoomY &&
                Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2) < playerSpawnRadius))
    );

    if (attempts < maxAttempts) {
        enemies.push(enemy);
    }
}


// Update enemy direction in updateEnemies()
function updateEnemies() {
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    enemies.forEach((enemy) => {
        if (enemy.invulnerable) {
            enemy.invulnerabilityTimer -= 16;
            enemy.flashTimer -= 16;
            if (enemy.flashTimer <= 0) {
                enemy.flash = !enemy.flash;
                enemy.flashTimer = FLASH_INTERVAL;
            }
            if (enemy.invulnerabilityTimer <= 0) {
                enemy.invulnerable = false;
                enemy.flash = false;
            }
        }

        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (enemy.type === "basic") {
            console.log(`Basic enemy update - Position: (${enemy.x}, ${enemy.y}), Speed: ${enemy.speed}, Distance to player: ${distance}`);

            if (distance > 0) {
                // Normalize direction and apply speed
                let moveX = (dx / distance) * enemy.speed;
                let moveY = (dy / distance) * enemy.speed;
                let newX = enemy.x + moveX;
                let newY = enemy.y + moveY;

                enemy.facingRight = moveX >= 0;
                console.log(`Calculated move: (${moveX}, ${moveY}) -> New position: (${newX}, ${newY})`);

                // Check collision and move if clear
                let collision = isColliding(newX, newY, enemy.width, enemy.height);
                console.log(`Collision check at (${newX}, ${newY}): ${collision}`);

                if (!collision) {
                    enemy.x = newX;
                    enemy.y = newY;
                    console.log(`Moved basic enemy to (${enemy.x}, ${enemy.y})`);
                } else {
                    console.log("Collision detected, attempting alternative movement");
                    // Simplified alternative movement: try moving in cardinal directions
                    let altDirections = [
                        { dx: enemy.speed, dy: 0 },  // Right
                        { dx: -enemy.speed, dy: 0 }, // Left
                        { dx: 0, dy: enemy.speed },  // Down
                        { dx: 0, dy: -enemy.speed }, // Up
                    ];

                    for (let alt of altDirections) {
                        newX = enemy.x + alt.dx;
                        newY = enemy.y + alt.dy;
                        if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                            enemy.x = newX;
                            enemy.y = newY;
                            enemy.facingRight = alt.dx >= 0;
                            console.log(`Alternative move succeeded to (${enemy.x}, ${enemy.y})`);
                            break;
                        }
                    }
                    console.log("No valid alternative movement found");
                }
            } else {
                console.log("Basic enemy too close to player, no movement needed");
            }
        } else if (enemy.type === "charger") {
            const detectionRadius = 1200;
            if (!enemy.isCharging) {
                if (distance > 0) {
                    let moveX = (dx / distance) * enemy.speed;
                    let moveY = (dy / distance) * enemy.speed;
                    let newX = enemy.x + moveX;
                    let newY = enemy.y + moveY;
                    enemy.facingRight = moveX >= 0;

                    if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                        enemy.x = newX;
                        enemy.y = newY;
                    }
                }

                if (distance < detectionRadius) {
                    enemy.chargeTimer -= 16;
                    if (enemy.chargeTimer <= 0) {
                        enemy.isCharging = true;
                        if (distance > 0) {
                            enemy.chargeDx = dx / distance;
                            enemy.chargeDy = dy / distance;
                            enemy.facingRight = enemy.chargeDx >= 0;
                        } else {
                            enemy.chargeDx = 0;
                            enemy.chargeDy = 0;
                        }
                    }
                }
            } else {
                let newX = enemy.x + enemy.chargeDx * enemy.chargeSpeed;
                let newY = enemy.y + enemy.chargeDy * enemy.chargeSpeed;
                enemy.facingRight = enemy.chargeDx >= 0;

                if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                    enemy.x = newX;
                    enemy.y = newY;
                } else {
                    enemy.isCharging = false;
                    enemy.chargeTimer = 1500;
                    enemy.chargeDx = 0;
                    enemy.chargeDy = 0;
                }
            }
        } else if (enemy.type === "shooter") {
            enemy.facingRight = dx >= 0;

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
                        Math.min(enemy.targetX, ROOM_WIDTH * TILE_SIZE - enemy.width / 2)
                    );
                    enemy.targetY = Math.max(
                        enemy.height / 2,
                        Math.min(enemy.targetY, ROOM_HEIGHT * TILE_SIZE - enemy.height / 2)
                    );
                }
            } else {
                let dxToTarget = enemy.targetX - enemy.x;
                let dyToTarget = enemy.targetY - enemy.y;
                let distToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);
                if (distToTarget > enemy.speed) {
                    let moveX = (dxToTarget / distToTarget) * enemy.speed;
                    let moveY = (dyToTarget / distToTarget) * enemy.speed;
                    let newX = enemy.x + moveX;
                    let newY = enemy.y + moveY;

                    enemy.facingRight = moveX >= 0;

                    if (!isColliding(newX, newY, enemy.width, enemy.height)) {
                        enemy.x = newX;
                        enemy.y = newY;
                    } else {
                        let altX = enemy.x + moveX;
                        let altY = enemy.y;
                        if (!isColliding(altX, altY, enemy.width, enemy.height)) {
                            enemy.x = altX;
                        } else {
                            altX = enemy.x;
                            altY = enemy.y + moveY;
                            if (!isColliding(altX, altY, enemy.width, enemy.height)) {
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
            playSFX(playerHurtSFX);
        }
    });
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
                if (!enemy.invulnerable && isCollidingWith(p, enemy)) {
                    enemy.hp--;
                    enemy.invulnerable = true;
                    enemy.invulnerabilityTimer = 200;
                    enemy.flash = true;
                    enemy.flashTimer = FLASH_INTERVAL;
                    playSFX(enemyHurtSFX);
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
                playSFX(playerHurtSFX);
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

Promise.all([
    new Promise((resolve) => (playerSprite.onload = resolve)),
    new Promise((resolve) => {
        enemySprite.onload = () => {
            enemySpriteData = preprocessSprite(enemySprite, enemySpriteCtx);
            resolve();
        };
    }),
    new Promise((resolve) => {
        enemySprite2.onload = () => {
            enemySprite2Data = preprocessSprite(enemySprite2, enemySprite2Ctx);
            resolve();
        };
    }),
    new Promise((resolve) => {
        enemySprite3.onload = () => {
            enemySprite3Data = preprocessSprite(enemySprite3, enemySprite3Ctx);
            resolve();
        };
    }),
    new Promise((resolve) => (terrainSprite.onload = resolve)),
    new Promise((resolve) => (powerUpSprite.onload = resolve)),
]).then(() => {
    titleAudio.play();
    gameLoop();
});

console.clear();