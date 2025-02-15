// main.js

// A small utility to manage conversation state in localStorage
const CONVERSATION_KEY = "ai_game_conversation";

function getSavedConversation() {
  const saved = localStorage.getItem(CONVERSATION_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveConversation(conversation) {
  localStorage.setItem(CONVERSATION_KEY, JSON.stringify(conversation));
}

// Initial conversation "seed"
let conversation = getSavedConversation();
if (conversation.length === 0) {
  // Start with a prompt or scenario
  conversation = [
    {
      role: "system",
      content: `You are the narrator of a surreal, ever-evolving text game. 
                You adapt the game scenario based on the user's input, 
                creating new rules, worlds, and philosophical twists as needed. 
                Keep the story coherent but allow reality to shift dynamically.`
    },
    {
      role: "assistant",
      content: `Welcome, traveler. You have entered a realm where reality is shaped by your words. 
                What would you like to do first?`
    }
  ];
  saveConversation(conversation);
}

// Display the current conversation in the story-output
const storyOutput = document.getElementById("story-output");
function renderStory() {
  storyOutput.innerHTML = "";
  for (const msg of conversation) {
    if (msg.role === "assistant") {
      const p = document.createElement("div");
      p.className = "assistant-message";
      p.textContent = msg.content.trim();
      storyOutput.appendChild(p);
    }
    if (msg.role === "user") {
      const p = document.createElement("div");
      p.className = "user-message";
      p.textContent = `> ${msg.content.trim()}`;
      storyOutput.appendChild(p);
    }
  }
  // Scroll to bottom
  storyOutput.scrollTop = storyOutput.scrollHeight;
}

// Initial render
renderStory();

// Handle user input
const userInput = document.getElementById("user-input");
const submitBtn = document.getElementById("submit-btn");

submitBtn.addEventListener("click", async () => {
  const inputText = userInput.value.trim();
  if (!inputText) return;

  // Add user's message to conversation
  conversation.push({ role: "user", content: inputText });
  saveConversation(conversation);
  renderStory();

  userInput.value = "";
  userInput.disabled = true;
  submitBtn.disabled = true;

  // Call serverless function
  try {
    const response = await fetch("/.netlify/functions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation })
    });

    const data = await response.json();

    // Add AI's response to conversation
    conversation.push({ role: "assistant", content: data.reply });
    saveConversation(conversation);
    renderStory();
  } catch (err) {
    console.error("Error calling the AI function:", err);
  } finally {
    userInput.disabled = false;
    submitBtn.disabled = false;
    userInput.focus();
  }
});

