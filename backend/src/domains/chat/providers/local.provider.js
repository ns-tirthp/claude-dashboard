import config from '../../../config/index.js';

export function createLocalProvider() {
  const baseUrl = config.ai.localAiUrl || 'http://localhost:11434';
  const model = config.ai.model || 'qwen2.5-coder:7b';

  async function callAPI(systemPrompt, messages, { json = false } = {}) {
    const body = {
      model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    };

    if (json) {
      body.format = 'json';
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  return {
    name: 'local',

    async generateSQL(systemPrompt, userMessage, history) {
      const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];
      return callAPI(systemPrompt, messages, { json: true });
    },

    async summarizeResults(summaryPrompt) {
      const messages = [{ role: 'user', content: summaryPrompt }];
      return callAPI('You are a helpful data analyst. Summarize query results concisely.', messages);
    },
  };
}
