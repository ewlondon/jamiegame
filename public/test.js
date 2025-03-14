// Modify generateRooms() to spawn enemies once during room generation
function generateRooms() {
    const graph = new Graph(TOTAL_ROOMS_X, TOTAL_ROOMS_Y);
    rooms = [];
    enemiesPerRoom = Array(TOTAL_ROOMS_Y)
        .fill()
        .map(() => Array(TOTAL_ROOMS_X).fill().map(() => [])); // Reset enemiesPerRoom

    // Generate rooms
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

    // Existing maze generation logic (graph traversal)...

    // After generating rooms, populate enemies
    for (let y = 0; y < TOTAL_ROOMS_Y; y++) {
        for (let x = 0; x < TOTAL_ROOMS_X; x++) {
            let neighbors = graph.getNeighbors(x, y);
            let room = rooms[y][x];
            let doorY = Math.floor(ROOM_HEIGHT / 2);
            let doorX = Math.floor(ROOM_WIDTH / 2);

            // Existing door and room shape generation logic...

            // Spawn enemies for this room
            let numEnemies = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < numEnemies; i++) {
                let enemyType = Math.floor(Math.random() * 3);
                if (enemyType === 0) {
                    spawnBasicEnemy(x, y);
                } else if (enemyType === 1) {
                    spawnChargerEnemy(x, y);
                } else {
                    spawnShooterEnemy(x, y);
                }
            }

            // Existing room shape logic (square, rectangle, L-shape, hallway)...
        }
    }

    // Spawn the spread shot item (from previous code)
    const randomRoomX = Math.floor(Math.random() * TOTAL_ROOMS_X);
    const randomRoomY = Math.floor(Math.random() * TOTAL_ROOMS_Y);
    let itemX, itemY;
    let attempts = 0;
    const maxAttempts = 50;
    do {
        itemX = Math.random() * (ROOM_WIDTH * TILE_SIZE - ITEM_SIZE) + ITEM_SIZE / 2;
        itemY = Math.random() * (ROOM_HEIGHT * TILE_SIZE - ITEM_SIZE) + ITEM_SIZE / 2;
        attempts++;
    } while (
        attempts < maxAttempts &&
        isColliding(itemX, itemY, ITEM_SIZE, ITEM_SIZE)
    );

    if (attempts < maxAttempts) {
        items.push({
            x: itemX,
            y: itemY,
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            roomX: randomRoomX,
            roomY: randomRoomY,
            type: "spreadShot",
        });
    }

    visitedRooms = Array(TOTAL_ROOMS_Y)
        .fill()
        .map(() => Array(TOTAL_ROOMS_X).fill(false));
    visitedRooms[currentRoomY][currentRoomX] = true;
}

// Modify spawn functions to add enemies to enemiesPerRoom instead of enemies array
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
            speed: 3.5,
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
        enemiesPerRoom[roomY][roomX].push(enemy); // Add to enemiesPerRoom instead of enemies
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
        enemiesPerRoom[roomY][roomX].push(enemy); // Add to enemiesPerRoom
    }
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
        enemiesPerRoom[roomY][roomX].push(enemy); // Add to enemiesPerRoom
    }
}

// Update spawnRoomEnemies() to load enemies from enemiesPerRoom
function spawnRoomEnemies() {
    enemies = []; // Clear current enemies
    // Load enemies from enemiesPerRoom for the current room
    enemies = enemiesPerRoom[currentRoomY][currentRoomX].filter(enemy => enemy.hp > 0);
}

// Update updateEnemies() to sync changes back to enemiesPerRoom
function updateEnemies() {
    enemies = enemies.filter((enemy) => enemy.hp > 0); // Remove dead enemies
    enemies.forEach((enemy) => {
        // Existing enemy update logic (movement, invulnerability, etc.)...

        // Sync updated enemy state back to enemiesPerRoom
        let roomEnemies = enemiesPerRoom[enemy.roomY][enemy.roomX];
        let index = roomEnemies.findIndex(e => e.x === enemy.x && e.y === enemy.y && e.type === enemy.type);
        if (index !== -1) {
            roomEnemies[index] = enemy; // Update the enemy in the room's array
        }
    });

    // Update enemiesPerRoom to reflect only living enemies
    enemiesPerRoom[currentRoomY][currentRoomX] = enemies.slice();
}

// Modify resetGameState() to avoid regenerating enemies unnecessarily
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
        hasSpreadShot: false,
        spreadShotTimer: 0,
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
    spawnRoomEnemies(); // Load enemies for the starting room

    bgAudio.volume = 0.25;
    bgAudio.play();
    bgAudio.currentTime = 32;
}

// Update checkRoomTransition() to load enemies instead of clearing them
function checkRoomTransition() {
    let playerLeft = player.x - PLAYER_FRAME_WIDTH / 2;
    let playerRight = player.x + PLAYER_FRAME_WIDTH / 2;
    let playerTop = player.y - PLAYER_FRAME_HEIGHT / 2;
    let playerBottom = player.y + PLAYER_FRAME_HEIGHT / 2;

    if (playerLeft < 0 && currentRoomX > 0) {
        currentRoomX--;
        transitionDirection = "left";
        isTransitioning = true;
    } else if (
        playerRight > ROOM_WIDTH * TILE_SIZE &&
        currentRoomX < TOTAL_ROOMS_X - 1
    ) {
        currentRoomX++;
        transitionDirection = "right";
        isTransitioning = true;
    } else if (playerTop < 0 && currentRoomY > 0) {
        currentRoomY--;
        transitionDirection = "up";
        isTransitioning = true;
    } else if (
        playerBottom > ROOM_HEIGHT * TILE_SIZE &&
        currentRoomY < TOTAL_ROOMS_Y - 1
    ) {
        currentRoomY++;
        transitionDirection = "down";
        isTransitioning = true;
    }
}

// Ensure enemies are loaded after transition
function repositionPlayer() {
    // Existing reposition logic...
    // After repositioning, load enemies for the new room
    spawnRoomEnemies();
}