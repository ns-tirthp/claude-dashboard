/**
 * Analytics Service
 *
 * Orchestrates pattern detection and recommendation generation.
 */

import PatternDetector from './pattern-detector.js';
import RecommendationEngine from './recommendation-engine.js';

class AnalyticsService {
  constructor(telemetryDb, dashboardDb, analyticsDb) {
    this.telemetryDb = telemetryDb;
    this.dashboardDb = dashboardDb;
    this.analyticsDb = analyticsDb;
    this.patternDetector = new PatternDetector(telemetryDb, dashboardDb, analyticsDb);
    this.recommendationEngine = new RecommendationEngine(analyticsDb);
  }

  /**
   * Run full analytics pipeline: detect patterns + generate recommendations
   */
  async runAnalysis(options = {}) {
    const { projectPath, daysBack = 30, force = false } = options;

    console.log('Starting analytics pipeline', { projectPath, daysBack });

    // Step 1: Detect patterns
    const patternResults = await this.patternDetector.detectAll({ projectPath, daysBack });
    console.log('Pattern detection complete', {
      patterns_found: patternResults.patterns.length,
    });

    // Step 2: Generate recommendations
    const recommendations = await this.recommendationEngine.generateRecommendations({ projectPath });
    console.log('Recommendation generation complete', {
      recommendations_created: recommendations.length,
    });

    return {
      patterns_detected: patternResults.patterns.length,
      recommendations_generated: recommendations.length,
      timestamp: patternResults.timestamp,
    };
  }

  /**
   * Get recommendations for a project
   */
  async getProjectRecommendations(projectPath, options = {}) {
    const { status = 'pending', includePattern = true } = options;

    const recommendations = this.recommendationEngine.getRecommendations(projectPath, status);

    if (!includePattern) {
      return recommendations;
    }

    // Enrich with pattern details
    return recommendations.map((rec) => {
      const pattern = this.analyticsDb
        .prepare('SELECT * FROM patterns WHERE id = ?')
        .get(rec.pattern_id);

      return {
        ...rec,
        pattern: pattern ? JSON.parse(pattern.metadata || '{}') : null,
      };
    });
  }

  /**
   * Get all patterns for a project
   */
  getProjectPatterns(projectPath, status = 'active') {
    const patterns = this.analyticsDb
      .prepare(
        `
      SELECT * FROM patterns
      WHERE project_path = ? AND status = ?
      ORDER BY severity DESC, frequency DESC
    `
      )
      .all(projectPath, status);

    return patterns.map((p) => ({
      ...p,
      metadata: JSON.parse(p.metadata || '{}'),
    }));
  }

  /**
   * Get dashboard summary: top issues across all projects
   */
  async getDashboardSummary(options = {}) {
    const { limit = 10 } = options;

    // Top patterns across all projects
    const topPatterns = this.analyticsDb
      .prepare(
        `
      SELECT
        pattern_type,
        COUNT(*) as project_count,
        SUM(frequency) as total_occurrences,
        AVG(CASE severity
          WHEN 'critical' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END) as avg_severity
      FROM patterns
      WHERE status = 'active'
      GROUP BY pattern_type
      ORDER BY total_occurrences DESC
      LIMIT ?
    `
      )
      .all(limit);

    // Projects with most urgent recommendations
    const urgentProjects = this.analyticsDb
      .prepare(
        `
      SELECT
        r.project_path,
        COUNT(*) as recommendation_count,
        SUM(CASE r.priority
          WHEN 'urgent' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END) as priority_score,
        MAX(CASE r.priority WHEN 'urgent' THEN 1 ELSE 0 END) as has_urgent
      FROM recommendations r
      WHERE r.status = 'pending'
      GROUP BY r.project_path
      ORDER BY has_urgent DESC, priority_score DESC
      LIMIT ?
    `
      )
      .all(limit);

    // Overall stats
    const stats = this.analyticsDb
      .prepare(
        `
      SELECT
        (SELECT COUNT(*) FROM patterns WHERE status = 'active') as active_patterns,
        (SELECT COUNT(*) FROM recommendations WHERE status = 'pending') as pending_recommendations,
        (SELECT COUNT(DISTINCT project_path) FROM patterns WHERE status = 'active') as affected_projects,
        (SELECT COUNT(*) FROM recommendations WHERE status = 'applied') as applied_recommendations
    `
      )
      .get();

    return {
      stats,
      top_patterns: topPatterns,
      urgent_projects: urgentProjects.map((p) => ({
        ...p,
        project_name: p.project_path.split('/').pop(),
      })),
    };
  }

  /**
   * Apply a recommendation (mark as applied)
   */
  async applyRecommendation(recommendationId) {
    this.recommendationEngine.updateRecommendationStatus(recommendationId, 'applied');

    // Also resolve the associated pattern
    const rec = this.analyticsDb
      .prepare('SELECT pattern_id FROM recommendations WHERE id = ?')
      .get(recommendationId);

    if (rec) {
      this.analyticsDb
        .prepare('UPDATE patterns SET status = ? WHERE id = ?')
        .run('resolved', rec.pattern_id);
    }

    return { success: true };
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(recommendationId, reason) {
    this.recommendationEngine.updateRecommendationStatus(recommendationId, 'dismissed', reason);
    return { success: true };
  }

  /**
   * Get details for a specific pattern type across all projects:
   * affected projects (with frequency) + the highest-priority pending
   * recommendation matching that pattern type.
   */
  getPatternTypeDetails(patternType) {
    const projects = this.analyticsDb
      .prepare(
        `
      SELECT
        p.project_path,
        p.frequency,
        p.severity,
        p.last_seen,
        (SELECT COUNT(*) FROM recommendations r
           WHERE r.pattern_id = p.id AND r.status = 'pending') AS pending_recs
      FROM patterns p
      WHERE p.pattern_type = ? AND p.status = 'active'
      ORDER BY p.frequency DESC
    `
      )
      .all(patternType)
      .map((row) => ({
        ...row,
        project_name: row.project_path.split('/').pop(),
      }));

    const sampleRec = this.analyticsDb
      .prepare(
        `
      SELECT r.*
      FROM recommendations r
      JOIN patterns p ON p.id = r.pattern_id
      WHERE p.pattern_type = ?
        AND r.status = 'pending'
      ORDER BY
        CASE r.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        r.confidence_score DESC
      LIMIT 1
    `
      )
      .get(patternType);

    return {
      pattern_type: patternType,
      affected_projects: projects,
      sample_recommendation: sampleRec
        ? { ...sampleRec, action_items: JSON.parse(sampleRec.action_items || '[]') }
        : null,
    };
  }

  /**
   * Get cross-project insights
   */
  async getCrossProjectInsights(options = {}) {
    const { limit = 5 } = options;

    const insights = this.analyticsDb
      .prepare(
        `
      SELECT * FROM cross_project_insights
      ORDER BY confidence_score DESC, created_at DESC
      LIMIT ?
    `
      )
      .all(limit);

    return insights.map((i) => ({
      ...i,
      sample_projects: JSON.parse(i.sample_projects || '[]'),
    }));
  }
}

export default AnalyticsService;
