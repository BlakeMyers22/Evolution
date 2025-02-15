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
    if (!body.x || !body.y) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing x or y" })
      };
    }

    const { x, y } = body;

    // 1) Check if room exists
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("x", x)
      .eq("y", y)
      .single();

    if (error && error.code !== "PGRST116") {
      // Unexpected error
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    let room = data;
    if (!room) {
      // Create a random tilemap
      const tilemap = generateTilemap(10, 10);

      // 20% chance to generate a puzzle
      let puzzle = null;
      if (Math.random() < 0.2) {
        puzzle = await generatePuzzle();
      }

      // 20% chance to place an item in this room
      const items = [];
      if (Math.random() < 0.2) {
        items.push({
          name: "Mysterious Artifact",
          description: "A strange glowing orb."
        });
      }

      const insert = await supabase
        .from("rooms")
        .insert({
          x,
          y,
          tilemap,
          items,
          puzzle
        })
        .single();

      if (insert.error) {
        return { statusCode: 500, body: JSON.stringify({ error: insert.error.message }) };
      }
      room = insert.data;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ room })
    };
  } catch (err) {
    console.error("createOrFetchRoom error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

// Generate a random 2D tilemap (floor/wall)
function generateTilemap(width, height) {
  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Outer edges as walls, plus random walls
      const isEdge = (x === 0 || y === 0 || x === width - 1 || y === height - 1);
      const randomWall = Math.random() < 0.1;
      row.push(isEdge || randomWall ? "wall" : "floor");
    }
    map.push(row);
  }
  return map;
}

// Use OpenAI to generate a random puzzle
async function generatePuzzle() {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    const prompt = "Generate a short riddle puzzle with a single-word answer.";
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You create fun, short riddle puzzles." },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.9
      })
    });

    if (!openAIResponse.ok) return null;

    const responseData = await openAIResponse.json();
    const text = responseData.choices[0].message.content.trim();

    // We'll assume the puzzle is in the format "Riddle: ??? Answer: ???"
    // But let's parse it in a naive way
    let riddle = text;
    let answer = "unknown";

    const match = /answer:\s*(\w+)/i.exec(text);
    if (match) {
      answer = match[1].toLowerCase();
    }

    return {
      question: riddle,
      answer,
      solved: false
    };
  } catch {
    return null;
  }
}
