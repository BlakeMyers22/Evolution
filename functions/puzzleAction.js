// functions/puzzleAction.js
const { getSupabase } = require("./supabaseClient");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const { action, roomX, roomY, userId, answer } = body;

    if (!roomX && roomX !== 0 || !roomY && roomY !== 0 || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing room coords or userId" }) };
    }

    if (action === "solvePuzzle") {
      return await solvePuzzle(supabase, roomX, roomY, userId, answer);
    } else if (action === "pickUpItems") {
      return await pickUpItems(supabase, roomX, roomY, userId);
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Invalid action" }) };
  } catch (err) {
    console.error("puzzleAction error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

async function solvePuzzle(supabase, x, y, userId, answer) {
  if (!answer) {
    return { statusCode: 200, body: JSON.stringify({ success: false, message: "No answer provided." }) };
  }

  // Fetch the room
  const { data: roomData, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("x", x)
    .eq("y", y)
    .single();

  if (roomError) {
    return { statusCode: 500, body: JSON.stringify({ error: roomError.message }) };
  }
  if (!roomData || !roomData.puzzle || roomData.puzzle.solved) {
    return { statusCode: 200, body: JSON.stringify({
      success: false, 
      message: "No unsolved puzzle here."
    }) };
  }

  // Compare answers
  if (answer.toLowerCase() === roomData.puzzle.answer) {
    // Mark puzzle solved
    const updatedPuzzle = { ...roomData.puzzle, solved: true };
    const updateRoom = await supabase
      .from("rooms")
      .update({ puzzle: updatedPuzzle })
      .eq("id", roomData.id);

    if (updateRoom.error) {
      return { statusCode: 500, body: JSON.stringify({ error: updateRoom.error.message }) };
    }

    // Reward the user
    const newItem = {
      name: "Puzzle Token",
      description: "A token awarded for solving a puzzle."
    };
    await addItemToPlayer(supabase, userId, newItem);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Puzzle solved! You gained a Puzzle Token."
      })
    };
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: "Incorrect answer."
      })
    };
  }
}

async function pickUpItems(supabase, x, y, userId) {
  // Fetch room
  const { data: roomData, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("x", x)
    .eq("y", y)
    .single();

  if (roomError) {
    return { statusCode: 500, body: JSON.stringify({ error: roomError.message }) };
  }
  if (!roomData || !roomData.items || roomData.items.length === 0) {
    return { statusCode: 200, body: JSON.stringify({
      success: false,
      message: "No items here."
    }) };
  }

  const itemsToPickup = roomData.items;

  // Clear room items
  const updateRoom = await supabase
    .from("rooms")
    .update({ items: [] })
    .eq("id", roomData.id);

  if (updateRoom.error) {
    return { statusCode: 500, body: JSON.stringify({ error: updateRoom.error.message }) };
  }

  // Add to player
  for (let item of itemsToPickup) {
    await addItemToPlayer(supabase, userId, item);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: `You picked up ${itemsToPickup.length} item(s).`
    })
  };
}

async function addItemToPlayer(supabase, userId, newItem) {
  // Get player
  const { data: playerData, error: playerError } = await supabase
    .from("player_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (playerError || !playerData) return;

  const inventory = playerData.inventory || [];
  inventory.push(newItem);

  await supabase
    .from("player_states")
    .update({ inventory })
    .eq("id", playerData.id);
}
