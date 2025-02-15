// functions/createOrFetchRoom.js
const { getSupabase } = require("./supabaseClient");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");

    // 1) Handle getPlayer
    if (body.getPlayer) {
      return await handleGetPlayerState(supabase, body.userId);
    }

    // 2) Handle updatePlayer
    if (body.updatePlayer) {
      return await handleUpdatePlayerState(
        supabase,
        body.userId,
        body.x,
        body.y,
        body.pos_x,
        body.pos_y
      );
    }

    // 3) Otherwise, handle room creation/fetch
    const { x, y } = body;
    if (typeof x !== "number" || typeof y !== "number") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing or invalid x,y" }),
      };
    }

    // Check if room exists
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("x", x)
      .eq("y", y)
      .single();

    if (error && error.code !== "PGRST116") {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    let room = data;
    if (!room) {
      // Create new random tilemap + puzzle + items
      const tilemap = generateTilemap(10, 10);
      const puzzle = Math.random() < 0.2 ? await generatePuzzle() : null;
      const items = Math.random() < 0.2
        ? [{ name: "Mysterious Artifact", description: "A strange glowing orb." }]
        : [];

      const insert = await supabase
        .from("rooms")
        .insert({ x, y, tilemap, puzzle, items })
        .single();

      if (insert.error) {
        return { statusCode: 500, body: JSON.stringify({ error: insert.error.message }) };
      }
      room = insert.data;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ room }),
    };
  } catch (err) {
    console.error("createOrFetchRoom error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

/* ========================================================= */
/*  getPlayer / updatePlayer logic                          */
/* ========================================================= */

async function handleGetPlayerState(supabase, userId) {
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: "No userId" }) };
  }

  // Attempt to fetch from player_states
  const { data, error } = await supabase
    .from("player_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  // If no player row, create one
  if (!data) {
    const insert = await supabase
      .from("player_states")
      .insert({
        user_id: userId,
        x: 0,
        y: 0,
        pos_x: 1,
        pos_y: 1,
        inventory: [],
      })
      .single();
    if (insert.error) {
      return { statusCode: 500, body: JSON.stringify({ error: insert.error.message }) };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ playerState: insert.data }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ playerState: data }),
  };
}

async function handleUpdatePlayerState(supabase, userId, roomX, roomY, tileX, tileY) {
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: "No userId" }) };
  }
  const { error } = await supabase
    .from("player_states")
    .update({
      x: roomX,
      y: roomY,
      pos_x: tileX,
      pos_y: tileY,
    })
    .eq("user_id", userId);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

/* ========================================================= */
/*  Tilemap and puzzle creation helpers                      */
/* ========================================================= */

function generateTilemap(width, height) {
  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const randomWall = Math.random() < 0.1;
      row.push(isEdge || randomWall ? "wall" : "floor");
    }
    map.push(row);
  }
  return map;
}

async function generatePuzzle() {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const prompt = "Generate a short riddle puzzle with a single-word answer.";
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You create fun, short riddle puzzles." },
          { role: "user", content: prompt },
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    });

    if (!openAIResponse.ok) return null;
    const responseData = await openAIResponse.json();
    const text = responseData.choices[0].message.content.trim();

    // naive parse
    let riddle = text;
    let answer = "unknown";
    const match = /answer:\s*(\w+)/i.exec(text);
    if (match) {
      answer = match[1].toLowerCase();
    }

    return { question: riddle, answer, solved: false };
  } catch {
    return null;
  }
}
