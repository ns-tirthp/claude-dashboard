import config from '../../../config/index.js';
import { createClaudeProvider } from './claude.provider.js';
import { createOpenAIProvider } from './openai.provider.js';
import { createLocalProvider } from './local.provider.js';

const PROVIDERS = {
  claude: createClaudeProvider,
  openai: createOpenAIProvider,
  local: createLocalProvider,
};

let cachedProvider = null;

export function getProvider() {
  if (cachedProvider) return cachedProvider;

  const providerName = config.ai.provider;
  const factory = PROVIDERS[providerName];

  if (!factory) {
    throw new Error(
      `Unknown AI_PROVIDER "${providerName}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  cachedProvider = factory();
  return cachedProvider;
}

export function resetProvider() {
  cachedProvider = null;
}
