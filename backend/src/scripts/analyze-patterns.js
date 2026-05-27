#!/usr/bin/env node
/**
 * Pattern Analysis Scheduler
 *
 * Runs pattern detection and recommendation generation in the background.
 * Can be run manually or via cron.
 */

import AnalyticsService from '../domains/analytics/analytics.service.js';
import telemetryDb from '../database/telemetry.db.js';
import dashboardDb from '../database/dashboard.db.js';
import analyticsDb from '../database/analytics.db.js';

const analyticsService = new AnalyticsService(telemetryDb, dashboardDb, analyticsDb);

async function main() {
  const args = process.argv.slice(2);
  const projectPath = args.find((arg) => arg.startsWith('--project='))?.split('=')[1];
  const daysBack = parseInt(args.find((arg) => arg.startsWith('--days='))?.split('=')[1] || '30');

  console.log('🔍 Starting pattern analysis...');
  console.log(`  Project: ${projectPath || 'ALL'}`);
  console.log(`  Time range: Last ${daysBack} days`);
  console.log('');

  try {
    const results = await analyticsService.runAnalysis({
      projectPath,
      daysBack,
    });

    console.log('✅ Analysis complete!');
    console.log(`  Patterns detected: ${results.patterns_detected}`);
    console.log(`  Recommendations generated: ${results.recommendations_generated}`);
    console.log('');

    if (projectPath) {
      const recommendations = await analyticsService.getProjectRecommendations(projectPath);
      if (recommendations.length > 0) {
        console.log(`📋 Top recommendations for ${projectPath}:`);
        recommendations.slice(0, 5).forEach((rec, idx) => {
          console.log(`  ${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        });
      }
    } else {
      const summary = await analyticsService.getDashboardSummary({ limit: 5 });
      console.log(`📊 Summary:`);
      console.log(`  Active patterns: ${summary.stats.active_patterns}`);
      console.log(`  Pending recommendations: ${summary.stats.pending_recommendations}`);
      console.log(`  Affected projects: ${summary.stats.affected_projects}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
