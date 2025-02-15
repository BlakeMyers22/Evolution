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

    if (!roomX || !roomY || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing room coords or userId" }) };
    }

    if (action === "solvePuzzle") {
      // Attempt to solve the puzzle
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("x", roomX)
        .eq("y", roomY)
        .single();

      if (roomError) {
        return { statusCode: 500, body: JSON.stringify({ error: roomError.message }) };
      }
      const room = roomData;
      if (!room || !room.puzzle || room.puzzle.solved) {
        return { statusCode: 200, body: JSON.stringify({ success: false, message: "No unsolved puzzle here" }) };
      }

      // Compare answers (case-insensitive)
      if (answer.toLowerCase() === room.puzzle.answer) {
        // Mark puzzle as solved
        const updatedPuzzle = { ...room.puzzle, solved: true };
        const update = await supabase
          .from("rooms")
          .update({ puzzle: updatedPuzzle })
          .eq("id", room.id);

        // Reward the user with a new item
        const newItem = {
          name: "Puzzle Token",
          description: "A token awarded for solving a puzzle."
        };
        await addItemToPlayer(supabase, userId, newItem);

        return { statusCode: 200, body: JSON.stringify({
          success: true,
          message: "Puzzle solved! You gained a Puzzle Token."
        }) };
      } else {
        return { statusCode: 200, body: JSON.stringify({
          success: false,
          message: "Incorrect answer."
        }) };
      }
    } else if (action === "pickUpItems") {
      // Move items from room to player's inventory
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("x", roomX)
        .eq("y", roomY)
        .single();

      if (roomError) {
        return { statusCode: 500, body: JSON.stringify({ error: roomError.message }) };
      }
      const room = roomData;
      if (!room || !room.items || room.items.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ success: false, message: "No items here." }) };
      }

      const itemsToPickup = room.items;
      // Clear items in the room
      const updateRoom = await supabase
        .from("rooms")
        .update({ items: [] })
        .eq("id", room.id);

      if (updateRoom.error) {
        return { statusCode: 500, body: JSON.stringify({ error: updateRoom.error.message }) };
      }

      // Add items to player
      for (let item of itemsToPickup) {
        await addItemToPlayer(supabase, userId, item);
      }

      return { statusCode: 200, body: JSON.stringify({
        success: true,
        message: `You picked up ${itemsToPickup.length} item(s).`
      }) };
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

async function addItemToPlayer(supabase, userId, newItem) {
  // Get player
  const { data: playerData, error: playerError } = await supabase
    .from("player_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (playerError) return;

  let inventory = playerData.inventory || [];
  inventory.push(newItem);

  await supabase
    .from("player_states")
    .update({ inventory })
    .eq("id", playerData.id);
}
