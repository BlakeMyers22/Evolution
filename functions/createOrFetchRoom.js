// functions/createOrFetchRoom.js
const { getSupabase } = require("./supabaseClient");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");

    // If this is a request to fetch or update player state
    if (body.getPlayer) {
      return await handleGetPlayerState(supabase, body.userId);
    }
    if (body.updatePlayer) {
      return await handleUpdatePlayerState(supabase, body.userId, body.x, body.y);
    }

    // Otherwise, we create or fetch a room at (x, y)
    const { x, y } = body;
    if (typeof x !== "number" || typeof y !== "number") {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid coordinates" }) };
    }

    // Check if a room already exists at (x, y)
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("x", x)
      .eq("y", y)
      .single();

    if (error && error.code !== "PGRST116") {
      // Some unexpected error
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    let room = data;
    // If room doesn't exist, create one
    if (!room) {
      // For demonstration, name = "Room (x,y)", desc = "A newly formed room."
      const insert = await supabase
        .from("rooms")
        .insert({
          name: `Room (${x}, ${y})`,
          description: `A newly formed mysterious space at (${x}, ${y}).`,
          x,
          y
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

async function handleGetPlayerState(supabase, userId) {
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: "No userId" }) };
  }
  // Attempt to fetch player state
  const { data, error } = await supabase
    .from("player_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  if (!data) {
    // Create a default state
    const insert = await supabase
      .from("player_states")
      .insert({
        user_id: userId,
        x: 0,
        y: 0,
        inventory: {}
      })
      .single();
    if (insert.error) {
      return { statusCode: 500, body: JSON.stringify({ error: insert.error.message }) };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ playerState: insert.data })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ playerState: data })
  };
}

async function handleUpdatePlayerState(supabase, userId, x, y) {
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: "No userId" }) };
  }
  const { error } = await supabase
    .from("player_states")
    .update({ x, y })
    .eq("user_id", userId);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

