import config from '../../../config/index.js';

export function createClaudeProvider() {
  const apiKey = config.ai.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required when AI_PROVIDER=claude');
  }

  const model = config.ai.model || 'claude-sonnet-4-6-20250929';
  const baseUrl = 'https://api.anthropic.com/v1/messages';

  async function callAPI(systemPrompt, messages) {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  return {
    name: 'claude',

    async generateSQL(systemPrompt, userMessage, history) {
      const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];
      return callAPI(systemPrompt, messages);
    },

    async summarizeResults(summaryPrompt) {
      const messages = [{ role: 'user', content: summaryPrompt }];
      return callAPI('You are a helpful data analyst. Summarize query results concisely.', messages);
    },
  };
}
