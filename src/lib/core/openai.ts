import OpenAI from 'openai';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const modelName = process.env.CLAUDE_MODEL ?? 'claude-opus-4-6';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;

// Compatible endpoint for Anthropic's OpenAI, which can use for both OpenAI and Anthropic models. 
// https://platform.claude.com/docs/en/api/openai-sdk

const llm = new OpenAI({
  apiKey: anthropicApiKey,
  baseURL: process.env.ANTROPIC_BASE_URL ?? 'https://api.anthropic.com/v1/',
});

export async function askOpenAI(messages: ChatMessage[]) {
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  try {
    console.log('Sending request to Claude with messages:', messages);

    const response = await llm.chat.completions.create({
      model: modelName,
      messages,
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    console.log('Claude response:', content); // logging response
    return content;
  } catch (err) {
    console.error('Claude request failed:', err);
    throw err;
  }
}
