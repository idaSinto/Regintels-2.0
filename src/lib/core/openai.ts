import OpenAI from 'openai';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type LlmProvider = 'gemini' | 'anthropic' | 'openai';

const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase() as LlmProvider;

function getLlmConfig() {
  if (provider === 'anthropic') {
    return {
      providerName: 'Anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1/',
      model: process.env.LLM_MODEL ?? process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5',
    };
  }

  if (provider === 'openai') {
    return {
      providerName: 'OpenAI',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      model: process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.4-nano',
    };
  }

  return {
    providerName: 'Gemini',
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: process.env.LLM_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
  };
}

const llmConfig = getLlmConfig();

const llm = new OpenAI({
  apiKey: llmConfig.apiKey,
  baseURL: llmConfig.baseURL,
});

export async function askOpenAI(messages: ChatMessage[]) {
  if (!llmConfig.apiKey) {
    throw new Error(`${llmConfig.providerName} API key is not set`);
  }

  try {
    console.log(`Sending request to ${llmConfig.providerName}:`, {
      model: llmConfig.model,
      messageCount: messages.length,
    });

    const response = await llm.chat.completions.create({
      model: llmConfig.model,
      messages,
    });

    console.log(`${llmConfig.providerName} token usage:`, response.usage);

    const content = response.choices?.[0]?.message?.content ?? '';
    console.log(`${llmConfig.providerName} response:`, content);
    return content;
  } catch (err) {
    console.error(`${llmConfig.providerName} request failed:`, err);
    throw err;
  }
}
