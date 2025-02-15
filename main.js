// main.js

const ROOM_WIDTH = 10;
const ROOM_HEIGHT = 10;
const TILE_SIZE = 48;

let app;
let tileSprites = []; // 2D array of PIXI Sprites
let playerSprite;
let currentRoom = null;
let playerRoomX = 0;
let playerRoomY = 0;
let playerTileX = 1; 
let playerTileY = 1;

window.addEventListener("DOMContentLoaded", async () => {
  initPixi();
  await loadOrCreatePlayerState();
  await loadCurrentRoom();

  // Set up button events
  document.getElementById("up-btn").addEventListener("click", () => attemptMove(0, -1));
  document.getElementById("down-btn").addEventListener("click", () => attemptMove(0, 1));
  document.getElementById("left-btn").addEventListener("click", () => attemptMove(-1, 0));
  document.getElementById("right-btn").addEventListener("click", () => attemptMove(1, 0));

  document.getElementById("pick-up-btn").addEventListener("click", pickUpItems);

  // Puzzle input
  document.getElementById("puzzle-submit-btn").addEventListener("click", solvePuzzle);

  // Keyboard controls
  window.addEventListener("keydown", handleKeyDown);
});

function initPixi() {
  const container = document.getElementById("game-container");
  app = new PIXI.Application({
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundColor: 0x222222
  });
  container.appendChild(app.view);

  // Create tile sprites
  tileSprites = [];
  for (let y = 0; y < ROOM_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < ROOM_WIDTH; x++) {
      const sprite = new PIXI.Sprite();
      sprite.x = x * TILE_SIZE;
      sprite.y = y * TILE_SIZE;
      app.stage.addChild(sprite);
      row.push(sprite);
    }
    tileSprites.push(row);
  }

  // Create player sprite (gold square)
  const g = new PIXI.Graphics();
  g.beginFill(0xffd700);
  g.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.endFill();
  playerSprite = new PIXI.Sprite(app.renderer.generateTexture(g));
  app.stage.addChild(playerSprite);
}

function logMessage(msg) {
  const logEl = document.getElementById("log");
  logEl.textContent += `\n${msg}`;
  logEl.scrollTop = logEl.scrollHeight;
}

function handleKeyDown(e) {
  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      attemptMove(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      attemptMove(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      attemptMove(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      attemptMove(1, 0);
      break;
  }
}

async function attemptMove(dx, dy) {
  if (!currentRoom) return;
  const newX = playerTileX + dx;
  const newY = playerTileY + dy;

  // Out of room bounds -> move to adjacent room
  if (newX < 0) {
    playerRoomX -= 1;
    playerTileX = ROOM_WIDTH - 1;
    await updatePlayerServer();
    await loadCurrentRoom();
    return;
  } else if (newX >= ROOM_WIDTH) {
    playerRoomX += 1;
    playerTileX = 0;
    await updatePlayerServer();
    await loadCurrentRoom();
    return;
  } else if (newY < 0) {
    playerRoomY -= 1;
    playerTileY = ROOM_HEIGHT - 1;
    await updatePlayerServer();
    await loadCurrentRoom();
    return;
  } else if (newY >= ROOM_HEIGHT) {
    playerRoomY += 1;
    playerTileY = 0;
    await updatePlayerServer();
    await loadCurrentRoom();
    return;
  }

  // Check collision
  if (currentRoom.tilemap[newY][newX] === "wall") {
    logMessage("You bump into a wall!");
    return;
  }

  // Otherwise, valid move
  playerTileX = newX;
  playerTileY = newY;
  await updatePlayerServer();
  renderRoom();
}

async function loadOrCreatePlayerState() {
  const userId = getOrCreateUserId();
  const res = await fetch("/api/createOrFetchRoom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      getPlayer: true,
      userId
    })
  });
  const data = await res.json();
  if (data.error) {
    logMessage("Error loading player state: " + data.error);
    return;
  }
  if (data.playerState) {
    playerRoomX = data.playerState.x;
    playerRoomY = data.playerState.y;
    playerTileX = data.playerState.pos_x || 1;
    playerTileY = data.playerState.pos_y || 1;
  }
}

async function loadCurrentRoom() {
  try {
    const response = await fetch("/api/createOrFetchRoom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: playerRoomX, y: playerRoomY })
    });
    const data = await response.json();
    if (data.error) {
      logMessage("Error loading room: " + data.error);
      return;
    }
    currentRoom = data.room;
    logMessage(`Loaded room at (${playerRoomX}, ${playerRoomY})`);
    renderRoom();
  } catch (err) {
    console.error(err);
    logMessage("Failed to load room");
  }
}

function renderRoom() {
  if (!currentRoom) return;
  const { tilemap } = currentRoom;

  for (let y = 0; y < ROOM_HEIGHT; y++) {
    for (let x = 0; x < ROOM_WIDTH; x++) {
      const cell = tilemap[y][x];
      const sprite = tileSprites[y][x];
      let color = 0x00ff00; // floor
      if (cell === "wall") color = 0x555555; // wall

      const g = new PIXI.Graphics();
      g.beginFill(color);
      g.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
      g.endFill();
      sprite.texture = app.renderer.generateTexture(g);
    }
  }

  // Position player sprite
  playerSprite.x = playerTileX * TILE_SIZE;
  playerSprite.y = playerTileY * TILE_SIZE;

  // If there's an unsolved puzzle
  if (currentRoom.puzzle && !currentRoom.puzzle.solved) {
    logMessage(`Puzzle found: ${currentRoom.puzzle.question}`);
  } else if (currentRoom.puzzle && currentRoom.puzzle.solved) {
    logMessage("Puzzle here has been solved already.");
  }

  // If there are items
  if (currentRoom.items && currentRoom.items.length > 0) {
    logMessage(
      `Items on the floor: ${currentRoom.items.map(i => i.name).join(", ")}`
    );
  }
}

async function updatePlayerServer() {
  const userId = getOrCreateUserId();
  await fetch("/api/createOrFetchRoom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updatePlayer: true,
      userId,
      x: playerRoomX,
      y: playerRoomY,
      pos_x: playerTileX,
      pos_y: playerTileY
    })
  });
}

async function solvePuzzle() {
  if (!currentRoom || !currentRoom.puzzle || currentRoom.puzzle.solved) {
    logMessage("No unsolved puzzle here.");
    return;
  }
  const userId = getOrCreateUserId();
  const input = document.getElementById("puzzle-input");
  const answer = input.value.trim();
  if (!answer) return;

  const res = await fetch("/api/puzzleAction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "solvePuzzle",
      roomX: playerRoomX,
      roomY: playerRoomY,
      userId,
      answer
    })
  });
  const data = await res.json();
  logMessage(data.message || JSON.stringify(data));
  if (data.success) {
    // Refresh to mark puzzle solved
    await loadCurrentRoom();
  }
}

async function pickUpItems() {
  if (!currentRoom || !currentRoom.items || currentRoom.items.length === 0) {
    logMessage("No items to pick up here.");
    return;
  }
  const userId = getOrCreateUserId();
  const res = await fetch("/api/puzzleAction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "pickUpItems",
      roomX: playerRoomX,
      roomY: playerRoomY,
      userId
    })
  });
  const data = await res.json();
  logMessage(data.message || JSON.stringify(data));
  if (data.success) {
    await loadCurrentRoom();
  }
}

function getOrCreateUserId() {
  let id = localStorage.getItem("everEvolvingUserId");
  if (!id) {
    id = "user_" + Math.floor(Math.random() * 999999999);
    localStorage.setItem("everEvolvingUserId", id);
  }
  return id;
}
