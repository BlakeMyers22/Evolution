// functions/generate.js

const fetch = require("node-fetch");

exports.handler = async function (event) {
  try {
    // Ensure it's a POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    // Parse the incoming request
    const { conversation } = JSON.parse(event.body);

    // Replace with your chosen OpenAI model
    const model = "gpt-3.5-turbo";

    // Construct request for OpenAI
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: conversation,
        temperature: 0.7,
        max_tokens: 200,
        n: 1,
        stream: false
      })
    });

    if (!openAIResponse.ok) {
      const err = await openAIResponse.json();
      return {
        statusCode: openAIResponse.status,
        body: JSON.stringify({ error: err }),
      };
    }

    const responseData = await openAIResponse.json();
    const reply = responseData.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.error("Error in generate function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

