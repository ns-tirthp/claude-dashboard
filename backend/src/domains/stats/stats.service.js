import * as queries from '../../database/queries.js';
import logger from '../../lib/logger.js';

/**
 * NEW Database-backed Stats Service
 * Replaces file scanning with efficient DB queries
 */

const MAX_ESTIMATED_TURN_MS = 5 * 60 * 1000;

/**
 * Get comprehensive statistics
 */
export function getStatistics(filters = {}) {
  const { project: filterProject, branch: filterBranch } = filters;

  const stats = {
    projects: {},
    totalConversations: 0,
    totalToolCalls: 0,
    totalTime: 0,
    toolUsage: {},
    modelUsage: {},
    timeline: [],
    branchActivity: {},
    entrypointUsage: {},
    hourlyActivity: Array(24).fill(0),
    dailyActivity: {},
    fileEditStats: { totalEdits: 0, totalReads: 0, totalWrites: 0 },
    timeSource: 'mixed' // We now have both measured (turn_durations) and estimated time
  };

  try {
    // Get all projects with their stats
    const projectRows = queries.getAllProjects(filters);

    // Group by project_path (aggregate branches)
    const projectMap = {};

    for (const row of projectRows) {
      const projectPath = row.project_path;

      if (!projectMap[projectPath]) {
        projectMap[projectPath] = {
          name: projectPath,
          conversations: 0,
          toolCalls: 0,
          totalTime: 0,
          tools: {},
          models: {},
          tokens: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
          lastActivity: null,
          branches: {},
          entrypoints: {},
          fileOperations: { edits: 0, reads: 0, writes: 0 },
          _timeSourceMeasured: 0,
          _timeSourceEstimated: 0,
        };
      }

      const proj = projectMap[projectPath];

      // Aggregate conversations
      proj.conversations += row.conversation_count || 0;
      stats.totalConversations += row.conversation_count || 0;

      // Aggregate tokens
      proj.tokens.input += row.total_input_tokens || 0;
      proj.tokens.output += row.total_output_tokens || 0;
      proj.tokens.cacheCreation += row.total_cache_creation_tokens || 0;
      proj.tokens.cacheRead += row.total_cache_read_tokens || 0;

      // Track last activity
      if (row.last_activity) {
        const lastActivityTs = new Date(row.last_activity).toISOString();
        if (!proj.lastActivity || new Date(lastActivityTs) > new Date(proj.lastActivity)) {
          proj.lastActivity = lastActivityTs;
        }
      }

      // Track branches
      if (row.branch) {
        proj.branches[row.branch] = (proj.branches[row.branch] || 0) + (row.conversation_count || 0);
      }

      // Track entrypoints
      if (row.entrypoint) {
        proj.entrypoints[row.entrypoint] = (proj.entrypoints[row.entrypoint] || 0) + (row.conversation_count || 0);
      }
    }

    // Get tool usage (global)
    const toolRows = queries.getToolUsage(filters);
    for (const row of toolRows) {
      stats.toolUsage[row.tool_name] = row.usage_count;
      stats.totalToolCalls += row.usage_count;
    }

    // Get tool usage by project
    const toolByProjectRows = queries.getToolUsageByProject(filters);
    for (const row of toolByProjectRows) {
      const proj = projectMap[row.project_path];
      if (proj) {
        proj.tools[row.tool_name] = row.usage_count;
        proj.toolCalls += row.usage_count;
      }
    }

    // Get model usage (global)
    const modelRows = queries.getModelUsage(filters);
    for (const row of modelRows) {
      stats.modelUsage[row.model] = row.message_count;
    }

    // Get model usage by project
    const modelByProjectRows = queries.getModelUsageByProject(filters);
    for (const row of modelByProjectRows) {
      const proj = projectMap[row.project_path];
      if (proj) {
        proj.models[row.model] = row.message_count;
      }
    }

    // Get hourly activity
    stats.hourlyActivity = queries.getHourlyActivity(filters);

    // Get daily activity
    stats.dailyActivity = queries.getDailyActivity(filters);

    // Get branch activity
    stats.branchActivity = queries.getBranchActivity(filters);

    // Get entrypoint usage
    stats.entrypointUsage = queries.getEntrypointUsage(filters);

    // Get file operation stats (global)
    stats.fileEditStats = queries.getFileOperationStats(filters);

    // Get file operations by project
    const fileOpsByProjectRows = queries.getFileOperationsByProject(filters);
    for (const row of fileOpsByProjectRows) {
      const proj = projectMap[row.project_path];
      if (proj) {
        if (row.operation_type === 'edit') proj.fileOperations.edits = row.count;
        if (row.operation_type === 'read') proj.fileOperations.reads = row.count;
        if (row.operation_type === 'write') proj.fileOperations.writes = row.count;
      }
    }

    // Get timeline
    stats.timeline = queries.getTimeline(filters, 100);

    // ---- Time aggregation ----
    // Measured: CLI sessions emit `system/turn_duration` events that the JSONL
    // ingestor stores in `turn_durations`. Sum per project.
    // Estimated: SDK / IDE sessions have no turn_duration events, so we fall
    // back to per-turn message-timestamp deltas (capped at MAX_ESTIMATED_TURN_MS
    // to limit idle-time inflation), only for conversations missing measured data.
    const measuredRows = queries.getMeasuredTimeByProject(filters);
    for (const row of measuredRows) {
      const proj = projectMap[row.project_path];
      if (!proj) continue;
      const ms = row.total_measured_ms || 0;
      proj.totalTime += ms;
      proj._timeSourceMeasured += ms;
      stats.totalTime += ms;
    }

    const estimatedRows = queries.getEstimatedTimeByProject(filters, MAX_ESTIMATED_TURN_MS);
    for (const row of estimatedRows) {
      const proj = projectMap[row.project_path];
      if (!proj) continue;
      const ms = row.total_estimated_ms || 0;
      proj.totalTime += ms;
      proj._timeSourceEstimated += ms;
      stats.totalTime += ms;
    }

    // Convert projects map to array and sort
    stats.projects = Object.values(projectMap)
      .filter(p => p.conversations > 0)
      .map(p => {
        const measured = p._timeSourceMeasured;
        const estimated = p._timeSourceEstimated;
        let timeSource = 'none';
        if (measured > 0 && estimated > 0) timeSource = 'mixed';
        else if (measured > 0) timeSource = 'measured';
        else if (estimated > 0) timeSource = 'estimated';
        const { _timeSourceMeasured, _timeSourceEstimated, ...rest } = p;
        return { ...rest, timeSource };
      })
      .sort((a, b) => {
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity) - new Date(a.lastActivity);
      });

    // Determine overall time source
    const projectSources = new Set(stats.projects.map(p => p.timeSource).filter(s => s !== 'none'));
    if (projectSources.size === 0) stats.timeSource = 'none';
    else if (projectSources.size === 1) stats.timeSource = [...projectSources][0];
    else stats.timeSource = 'mixed';

  } catch (error) {
    logger.error('stats', 'Error getting statistics from database', { error: error.message });
  }

  return stats;
}

/**
 * Get filter options (projects and branches)
 */
export function getFilterOptions() {
  const result = { projects: [] };

  try {
    result.projects = queries.getProjectsWithBranches();
  } catch (error) {
    logger.error('stats', 'Error getting filter options', { error: error.message });
  }

  return result;
}
