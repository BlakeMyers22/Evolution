// main.js

// The size of each 'tile' in our grid
const TILE_SIZE = 64;

// We'll store the player's position in a global or module variable
let playerX = 0;
let playerY = 0;

// We also store a reference to the Pixi Application
let app;
let playerSprite;

// Called once on page load
window.addEventListener("DOMContentLoaded", async () => {
  initPixi();
  // Load or create player state
  await loadPlayerState();

  // Render the map
  await loadRoom(playerX, playerY);

  // Setup button events
  document.getElementById("up-btn").addEventListener("click", () => move(0, -1));
  document.getElementById("down-btn").addEventListener("click", () => move(0, 1));
  document.getElementById("left-btn").addEventListener("click", () => move(-1, 0));
  document.getElementById("right-btn").addEventListener("click", () => move(1, 0));
});

// Initialize Pixi.js
function initPixi() {
  const container = document.getElementById("game-container");
  app = new PIXI.Application({
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundColor: 0x222222
  });
  container.appendChild(app.view);

  // Create a simple rectangle for the player
  const graphics = new PIXI.Graphics();
  graphics.beginFill(0xffd700); // gold color
  graphics.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
  graphics.endFill();

  // Turn it into a sprite
  playerSprite = new PIXI.Sprite(app.renderer.generateTexture(graphics));
  app.stage.addChild(playerSprite);

  // Position initially (we'll update in loadPlayerState)
  playerSprite.x = 0;
  playerSprite.y = 0;
}

// Move the player by (dx, dy)
async function move(dx, dy) {
  playerX += dx;
  playerY += dy;
  // Save the new position
  await updatePlayerState(playerX, playerY);
  // Load the new room
  await loadRoom(playerX, playerY);
}

// Fetch or create a room at coordinates (x, y)
async function loadRoom(x, y) {
  // Clear background for demonstration
  // In a more advanced version, you'd render the entire tilemap here.
  app.stage.removeChildren();
  app.stage.addChild(playerSprite);

  const logDiv = document.getElementById("log");
  logDiv.textContent = logDiv.textContent + `\nLoading room at (${x}, ${y})...`;

  try {
    // We call our Netlify function to get or create the room
    const response = await fetch(`/api/createOrFetchRoom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y })
    });
    const data = await response.json();

    if (data.error) {
      logDiv.textContent += `\nError: ${data.error}`;
      return;
    }

    const room = data.room;
    logDiv.textContent += `\nRoom: ${room.name} - ${room.description}`;

    // Optionally, we can request extra flavor text from AI
    const aiResponse = await fetch(`/api/generateText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `Expand on this room description: ${room.description}` })
    });
    const aiData = await aiResponse.json();
    logDiv.textContent += `\nAI says: ${aiData.reply}`;

    // Reposition the player sprite in the center
    const container = document.getElementById("game-container");
    playerSprite.x = container.clientWidth / 2 - TILE_SIZE / 2;
    playerSprite.y = container.clientHeight / 2 - TILE_SIZE / 2;
  } catch (err) {
    logDiv.textContent += `\nError: ${err.message}`;
  }
}

// ====================== Player State in Supabase ====================== //

// Load or create the player's state from localStorage or from Supabase
async function loadPlayerState() {
  const localId = getOrCreateUserId();
  // Attempt to fetch from Supabase
  try {
    const response = await fetch(`/api/createOrFetchRoom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ getPlayer: true, userId: localId })
    });
    const data = await response.json();

    if (data.playerState) {
      playerX = data.playerState.x;
      playerY = data.playerState.y;
    } else {
      // fallback
      playerX = 0;
      playerY = 0;
    }
  } catch (err) {
    console.error("Failed to load player state", err);
  }
}

async function updatePlayerState(x, y) {
  const localId = getOrCreateUserId();
  try {
    await fetch(`/api/createOrFetchRoom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updatePlayer: true, userId: localId, x, y })
    });
  } catch (err) {
    console.error("Failed to update player state", err);
  }
}

// Generate or retrieve a "userId" from local storage to track each unique user
function getOrCreateUserId() {
  let id = localStorage.getItem("everEvolvingUserId");
  if (!id) {
    id = "user_" + Math.floor(Math.random() * 999999999);
    localStorage.setItem("everEvolvingUserId", id);
  }
  return id;
}

