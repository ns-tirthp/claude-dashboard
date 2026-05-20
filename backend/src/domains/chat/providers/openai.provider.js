import config from '../../../config/index.js';

export function createOpenAIProvider() {
  const apiKey = config.ai.openaiApiKey;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required when AI_PROVIDER=openai');
  }

  const model = config.ai.model || 'gpt-4o';
  const baseUrl = config.ai.openaiBaseUrl || 'https://api.openai.com/v1/chat/completions';

  async function callAPI(systemPrompt, messages) {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  return {
    name: 'openai',

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
