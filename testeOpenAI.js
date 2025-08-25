import fetch from "node-fetch";


async function testOpenAI() {
  const ticker = "TGAR11";

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: "What are the major AI developments and announcements from today across the tech industry?"
          }
        ]
      })
    });

    const data = await response.json();
    // console.log("Resposta da OpenAI:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Erro ao chamar OpenAI:", err);
  }
}

testOpenAI();
