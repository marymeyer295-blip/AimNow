import 'dotenv/config';

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "https://chatgpt-vm.openai.azure.com/openai/deployments/gpt-5-model/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;

/**
 * Core LLM Service for calling Azure OpenAI
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @param {boolean} jsonMode - If true, enforces JSON output
 * @returns {string} Raw content response
 */
export async function callLLM(systemPrompt, userPrompt, jsonMode = false) {
  if (!AZURE_OPENAI_KEY) {
    throw new Error("AZURE_OPENAI_KEY not configured. Cannot run Discovery LLM logic.");
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  if (userPrompt) {
    messages.push({ role: "user", content: userPrompt });
  }

  const payload = {
    messages,
    temperature: jsonMode ? 0.0 : 0.7,
    max_tokens: 1000,
  };

  if (jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM Error Body: ${errorText}`);
      throw new Error(`Azure OpenAI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    return content;
  } catch (error) {
    console.error("LLM Service Error:", error);
    throw error;
  }
}
