import * as repo from './telemetry.repository.js';

export function getCostData(query) {
  const totalRow = repo.getTotalCost(query);
  const byModel = repo.getCostByModel(query);
  const bySkill = repo.getCostBySkill(query);
  const byAgent = repo.getCostByAgent(query);
  const byPlugin = repo.getCostByPlugin(query);
  const daily = repo.getDailyCost(query);
  const tokensByType = repo.getTokensByType(query);

  return {
    totalUsd: totalRow.total_usd,
    byModel,
    bySkill,
    byAgent,
    byPlugin,
    daily,
    tokensByType,
  };
}

export function getTimeData(query) {
  const activeBreakdown = repo.getActiveTimeBreakdown(query);
  const totalActiveSec = activeBreakdown.reduce((a, r) => a + r.seconds, 0);
  const apiDuration = repo.getApiDuration(query);
  const toolDuration = repo.getToolDuration(query);
  const byDay = repo.getActiveTimeByDay(query);

  return { totalActiveSec, activeBreakdown, apiDuration, toolDuration, byDay };
}

export function getReliabilityData(query) {
  const toolStats = repo.getToolStats(query);
  const errorBreakdown = repo.getErrorBreakdown(query);
  const apiErrors = repo.getApiErrors(query);
  const retriesExhausted = repo.getRetriesExhausted(query);
  const decisions = repo.getToolDecisions(query);

  return { toolStats, errorBreakdown, apiErrors, retriesExhausted: retriesExhausted.count, decisions };
}

export function getPromptsData(query) {
  return { prompts: repo.getPrompts(query) };
}

export function getPromptById(id) {
  return { id, events: repo.getPromptEvents(id) };
}

export function getSessionsData(query) {
  return { sessions: repo.getSessions(query) };
}

export function getProductivityData(query) {
  const linesByType = repo.getLinesByType(query);
  const linesDaily = repo.getLinesDaily(query);
  const commitsRow = repo.getCommitsCount(query);
  const prsRow = repo.getPullRequestsCount(query);
  const editDecisions = repo.getEditDecisions(query);
  const editsByLanguage = repo.getEditsByLanguage(query);

  return {
    linesByType,
    linesDaily,
    commits: commitsRow.commits,
    pullRequests: prsRow.prs,
    editDecisions,
    editsByLanguage,
  };
}

export function getHealthData() {
  const signals = repo.getHealthSignals();
  const totals = repo.getTableCounts();
  const now = Date.now();
  const enriched = signals.map((s) => ({
    ...s,
    seconds_since_last: Math.round((now - s.last_received_at) / 1000),
  }));
  return { signals: enriched, totals, ingestEnabled: true };
}

export function getSummaryData(query) {
  const cost = repo.getTotalCost(query);
  const active = repo.getActiveTimeBreakdown(query);
  const tokens = repo.getTokensByType(query);
  const sessionsRow = repo.getTotalSessions(query);
  const toolReliability = repo.getToolReliability(query);
  const linesByType = repo.getLinesByType(query);
  const commitsRow = repo.getCommitsCount(query);
  const prsRow = repo.getPullRequestsCount(query);

  const activeSeconds = active.reduce((sum, item) => sum + (item.seconds || 0), 0);

  return {
    totalUsd: cost.total_usd,
    activeSeconds,
    tokensByType: tokens,
    sessions: sessionsRow.sessions,
    toolReliability,
    linesByType,
    commits: commitsRow.commits,
    pullRequests: prsRow.prs,
  };
}
