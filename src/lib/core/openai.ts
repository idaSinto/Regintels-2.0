import OpenAI from 'openai';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ModelConfig = {
  label: string;
  model: string;
  apiKey: string;
  baseURL: string;
};

function createModelConfig(prefix: string, defaults: Partial<ModelConfig> = {}): ModelConfig | null {
  const model = process.env[`${prefix}_MODEL`] ?? defaults.model;
  const baseURL = process.env[`${prefix}_BASE_URL`] ?? defaults.baseURL;
  const apiKey = process.env[`${prefix}_API_KEY`] ?? defaults.apiKey;

  if (!model || !baseURL || !apiKey) return null;

  return {
    label: prefix.toLowerCase(),
    model,
    baseURL,
    apiKey,
  };
}

const primaryConfig = createModelConfig('LLM', {
  model: 'qwen3:32b',
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

const fallbackConfig = createModelConfig('LLM_FALLBACK');

function createClient(config: ModelConfig) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

async function completeWithConfig(config: ModelConfig, messages: ChatMessage[]) {
  const llm = createClient(config);

  console.log(`Sending request to ${config.label}:${config.model} via ${config.baseURL}`, messages);

  const response = await llm.chat.completions.create({
    model: config.model,
    messages,
  });

  const content = response.choices?.[0]?.message?.content ?? '';
  console.log(`${config.label}:${config.model} response:`, content);
  return content;
}

export async function askLLM(messages: ChatMessage[]) {
  if (!primaryConfig) {
    throw new Error('LLM configuration is incomplete');
  }

  try {
    return await completeWithConfig(primaryConfig, messages);
  } catch (err) {
    console.error(`${primaryConfig.label}:${primaryConfig.model} request failed:`, err);

    if (!fallbackConfig) {
      throw err;
    }

    console.warn(
      `Falling back to ${fallbackConfig.label}:${fallbackConfig.model} via ${fallbackConfig.baseURL}`
    );

    return await completeWithConfig(fallbackConfig, messages);
  }
}

export function getLLMConfigSummary() {
  return {
    primary: primaryConfig
      ? {
          model: primaryConfig.model,
          baseURL: primaryConfig.baseURL,
          label: primaryConfig.label,
        }
      : null,
    fallback: fallbackConfig
      ? {
          model: fallbackConfig.model,
          baseURL: fallbackConfig.baseURL,
          label: fallbackConfig.label,
        }
      : null,
  };
}

export function hasFallbackLLM() {
  return Boolean(fallbackConfig);
}

export function getPrimaryLLMConfig() {
  return primaryConfig;
}

export function getFallbackLLMConfig() {
  return fallbackConfig;
}
