/**
 * Recommendation Engine
 *
 * Generates actionable recommendations based on detected patterns.
 */

import logger from '../../lib/logger.js';

class RecommendationEngine {
  constructor(analyticsDb) {
    this.analyticsDb = analyticsDb;
  }

  /**
   * Generate recommendations for all active patterns
   */
  async generateRecommendations(options = {}) {
    const { projectPath } = options;

    // Get active patterns that don't have recommendations yet
    const query = `
      SELECT p.*
      FROM patterns p
      LEFT JOIN recommendations r ON r.pattern_id = p.id AND r.status != 'archived'
      WHERE p.status = 'active'
        ${projectPath ? 'AND p.project_path = ?' : ''}
        AND r.id IS NULL
      ORDER BY
        CASE p.severity
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        p.frequency DESC
    `;

    const params = projectPath ? [projectPath] : [];
    const patterns = this.analyticsDb.prepare(query).all(...params);

    const recommendations = [];

    for (const pattern of patterns) {
      const recommendation = this.generateRecommendationForPattern(pattern);
      if (recommendation) {
        const id = this.storeRecommendation(recommendation);
        recommendations.push({ id, ...recommendation });
      }
    }

    return recommendations;
  }

  /**
   * Generate a specific recommendation based on pattern type
   */
  generateRecommendationForPattern(pattern) {
    const generators = {
      tool_failure: this.generateToolFailureRecommendation.bind(this),
      context_waste: this.generateContextWasteRecommendation.bind(this),
      repeated_read: this.generateRepeatedReadRecommendation.bind(this),
      missing_documentation: this.generateDocumentationRecommendation.bind(this),
      permission_denial: this.generatePermissionRecommendation.bind(this),
    };

    const generator = generators[pattern.pattern_type];
    if (!generator) {
      logger.warn('No recommendation generator for pattern type', { type: pattern.pattern_type });
      return null;
    }

    return generator(pattern);
  }

  /**
   * Recommendation: Tool Failure
   * Example: Claude keeps using wrong build command
   */
  generateToolFailureRecommendation(pattern) {
    const metadata = JSON.parse(pattern.metadata || '{}');
    const { tool_name, error_type, sample_errors } = metadata;

    // Specific recommendation for build command failures
    if (tool_name === 'Bash' && sample_errors && sample_errors.includes('command not found')) {
      const projectName = pattern.project_path.split('/').pop();

      return {
        pattern_id: pattern.id,
        project_path: pattern.project_path,
        category: 'documentation',
        priority: pattern.frequency > 10 ? 'high' : 'medium',
        title: `Document correct build commands in CLAUDE.md`,
        description: `Claude failed ${pattern.frequency} times trying to run commands in ${projectName}. Adding proper build/test commands to CLAUDE.md will prevent these failures.`,
        action_items: JSON.stringify([
          {
            step: 1,
            action: `Create or update ${pattern.project_path}/.claude/CLAUDE.md`,
            details: 'Add a "Build & Test Commands" section',
          },
          {
            step: 2,
            action: 'Document the correct commands',
            details: `Example:\n## Build Commands\n- Build: \`yarn run tsc -b\`\n- Test: \`yarn test\`\n- Lint: \`yarn lint\``,
          },
          {
            step: 3,
            action: 'Add context about when to use each command',
            details: 'Explain when to run type-checking vs. tests vs. builds',
          },
        ]),
        impact_estimate: `Could reduce ${tool_name} failures by 80% based on similar projects`,
        confidence_score: 0.85,
      };
    }

    // Generic tool failure recommendation
    const errorSnippet = (sample_errors || '').toString().slice(0, 200) || 'no error message captured';
    return {
      pattern_id: pattern.id,
      project_path: pattern.project_path,
      category: 'tooling',
      priority: pattern.severity === 'high' ? 'high' : 'medium',
      title: `Fix ${tool_name} tool configuration`,
      description: `${tool_name} tool failed ${pattern.frequency} times with "${error_type}". This suggests a configuration or environment issue.`,
      action_items: JSON.stringify([
        {
          step: 1,
          action: 'Review error logs',
          details: `Check why ${tool_name} is failing: ${errorSnippet}`,
        },
        {
          step: 2,
          action: 'Update project documentation',
          details: 'Add prerequisites or setup steps to CLAUDE.md',
        },
      ]),
      impact_estimate: `Could eliminate ${pattern.frequency} failures per month`,
      confidence_score: 0.7,
    };
  }

  /**
   * Recommendation: Context Waste
   */
  generateContextWasteRecommendation(pattern) {
    const metadata = JSON.parse(pattern.metadata || '{}');
    const avgTokens = Number(metadata.avg_tokens) || 0;

    return {
      pattern_id: pattern.id,
      project_path: pattern.project_path,
      category: 'optimization',
      priority: pattern.frequency > 5 ? 'high' : 'medium',
      title: 'Optimize session efficiency - high token usage, low output',
      description: `Found ${pattern.frequency} sessions averaging ${avgTokens.toLocaleString()} tokens but only 1-2 file changes. This suggests unclear requirements or excessive exploration.`,
      action_items: JSON.stringify([
        {
          step: 1,
          action: 'Review session patterns',
          details: 'Check if Claude is reading too many irrelevant files',
        },
        {
          step: 2,
          action: 'Improve task descriptions',
          details: 'Be more specific about which files need changes',
        },
        {
          step: 3,
          action: 'Add project structure documentation',
          details: 'Document key files and their purposes in CLAUDE.md to reduce exploration time',
        },
        {
          step: 4,
          action: 'Consider using agents for exploration',
          details: 'Use the Explore agent for broad searches instead of main context',
        },
      ]),
      impact_estimate: 'Could reduce token usage by 40-60% per session',
      confidence_score: 0.75,
    };
  }

  /**
   * Recommendation: Repeated Operations
   */
  generateRepeatedReadRecommendation(pattern) {
    const metadata = JSON.parse(pattern.metadata || '{}');
    const { most_repeated } = metadata;

    return {
      pattern_id: pattern.id,
      project_path: pattern.project_path,
      category: 'optimization',
      priority: 'medium',
      title: 'Reduce repeated file reads',
      description: `Detected ${pattern.frequency} sessions with excessive file re-reads. Most repeated: ${most_repeated?.file_path || 'N/A'} (${most_repeated?.call_count || 0} times).`,
      action_items: JSON.stringify([
        {
          step: 1,
          action: 'Add file context to CLAUDE.md',
          details: 'Document the purpose and structure of frequently-read files',
        },
        {
          step: 2,
          action: 'Provide complete context upfront',
          details: 'When requesting changes, include relevant context in your first message',
        },
        {
          step: 3,
          action: 'Review context window usage',
          details: 'If Claude loses context mid-session, consider breaking into smaller tasks',
        },
      ]),
      impact_estimate: 'Could reduce redundant reads by 70%',
      confidence_score: 0.8,
    };
  }

  /**
   * Recommendation: Missing Documentation
   */
  generateDocumentationRecommendation(pattern) {
    const metadata = JSON.parse(pattern.metadata || '{}');
    const projectName = pattern.project_path.split('/').pop();

    return {
      pattern_id: pattern.id,
      project_path: pattern.project_path,
      category: 'documentation',
      priority: metadata.error_count > 20 ? 'urgent' : 'high',
      title: `Create CLAUDE.md for ${projectName}`,
      description: `Project has ${metadata.session_count} sessions and ${metadata.error_count} errors, but no CLAUDE.md file. Adding documentation could dramatically improve Claude's effectiveness.`,
      action_items: JSON.stringify([
        {
          step: 1,
          action: `Create ${pattern.project_path}/.claude/CLAUDE.md`,
          details: 'Initialize with basic project info',
        },
        {
          step: 2,
          action: 'Document project structure',
          details: 'Add: tech stack, key directories, important files',
        },
        {
          step: 3,
          action: 'Add common commands',
          details: 'Build, test, lint, deploy commands',
        },
        {
          step: 4,
          action: 'Document development workflow',
          details: 'How to run locally, test changes, commit conventions',
        },
        {
          step: 5,
          action: 'Add project-specific guidelines',
          details: 'Coding standards, architecture decisions, gotchas',
        },
      ]),
      impact_estimate: 'Projects with CLAUDE.md see 2.3x faster task completion and 40% fewer errors',
      confidence_score: 0.9,
    };
  }

  /**
   * Recommendation: Permission Denials
   */
  generatePermissionRecommendation(pattern) {
    return {
      pattern_id: pattern.id,
      project_path: pattern.project_path,
      category: 'permissions',
      priority: 'medium',
      title: 'Configure permission allowlist',
      description: `Frequent permission prompts detected. Configure allowlist in .claude/settings.json to streamline workflow.`,
      action_items: JSON.stringify([
        {
          step: 1,
          action: 'Run the /fewer-permission-prompts skill',
          details: 'This will analyze your patterns and suggest an allowlist',
        },
        {
          step: 2,
          action: 'Review and apply suggested permissions',
          details: 'Add trusted commands to project settings',
        },
      ]),
      impact_estimate: 'Could reduce permission prompts by 60-80%',
      confidence_score: 0.85,
    };
  }

  /**
   * Store recommendation in database
   */
  storeRecommendation(rec) {
    const result = this.analyticsDb
      .prepare(
        `
      INSERT INTO recommendations (
        pattern_id, project_path, category, priority,
        title, description, action_items,
        impact_estimate, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        rec.pattern_id,
        rec.project_path,
        rec.category,
        rec.priority,
        rec.title,
        rec.description,
        rec.action_items,
        rec.impact_estimate,
        rec.confidence_score
      );

    return result.lastInsertRowid;
  }

  /**
   * Get all recommendations for a project
   */
  getRecommendations(projectPath, status = 'pending') {
    const query = `
      SELECT
        r.*,
        p.pattern_type,
        p.severity as pattern_severity,
        p.frequency as pattern_frequency
      FROM recommendations r
      JOIN patterns p ON p.id = r.pattern_id
      WHERE r.project_path = ?
        AND r.status = ?
      ORDER BY
        CASE r.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        r.confidence_score DESC
    `;

    const recommendations = this.analyticsDb.prepare(query).all(projectPath, status);

    return recommendations.map((rec) => ({
      ...rec,
      action_items: JSON.parse(rec.action_items || '[]'),
    }));
  }

  /**
   * Mark recommendation as applied or dismissed.
   * Uses fully-bound queries per status to avoid dynamic SQL with mismatched
   * placeholders (the previous implementation had bind/placeholder skew).
   */
  updateRecommendationStatus(id, status, reason = null) {
    const now = Math.floor(Date.now() / 1000);

    if (status === 'applied') {
      this.analyticsDb
        .prepare(
          `UPDATE recommendations
           SET status = ?, applied_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(status, now, now, id);
      return;
    }

    if (status === 'dismissed') {
      this.analyticsDb
        .prepare(
          `UPDATE recommendations
           SET status = ?, dismissed_reason = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(status, reason, now, id);
      return;
    }

    this.analyticsDb
      .prepare(
        `UPDATE recommendations
         SET status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(status, now, id);
  }
}

export default RecommendationEngine;
