async function sendInput() {
    let userInput = document.getElementById("user-input").value;
    document.getElementById("response").innerHTML = "Processing...";
    
    const apiKey = "YOUR_OPENAI_API_KEY"; // Replace with your OpenAI API key
    const endpoint = "https://api.openai.com/v1/completions";

    let response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: userInput }],
            max_tokens: 50
        })
    });

    let data = await response.json();
    let aiResponse = data.choices[0].message.content;

    document.getElementById("response").innerHTML = aiResponse;
    document.getElementById("user-input").value = "";
}

