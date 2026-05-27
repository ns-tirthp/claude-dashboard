/**
 * Analytics Routes
 *
 * REST API for pattern detection and recommendations.
 */

import { Router } from "express";
import AnalyticsService from "./analytics.service.js";
import telemetryDb from "../../database/telemetry.db.js";
import dashboardDb from "../../database/dashboard.db.js";
import analyticsDb from "../../database/analytics.db.js";
import { asyncWrap } from "../../middleware/async-wrap.js";

const router = Router();

const analyticsService = new AnalyticsService(
  telemetryDb,
  dashboardDb,
  analyticsDb,
);

/**
 * POST /api/analytics/analyze
 * Run pattern detection and recommendation generation
 */
router.post(
  "/analyze",
  asyncWrap(async (req, res) => {
    const { projectPath, daysBack = 30, force = false } = req.body;

    const results = await analyticsService.runAnalysis({
      projectPath,
      daysBack,
      force,
    });

    res.json({
      success: true,
      ...results,
    });
  }),
);

/**
 * GET /api/analytics/dashboard
 * Get overall analytics dashboard summary
 */
router.get(
  "/dashboard",
  asyncWrap(async (req, res) => {
    const { limit = 10 } = req.query;

    const summary = await analyticsService.getDashboardSummary({
      limit: parseInt(limit),
    });

    res.json(summary);
  }),
);

/**
 * GET /api/analytics/recommendations?projectPath=...&status=pending
 * Get recommendations for a project. projectPath is sent as a query param
 * to avoid encoding issues with absolute paths containing forward slashes.
 */
router.get(
  "/recommendations",
  asyncWrap(async (req, res) => {
    const {
      projectPath,
      status = "pending",
      includePattern = "true",
    } = req.query;

    if (!projectPath) {
      return res.status(400).json({ error: "projectPath query param is required" });
    }

    const recommendations = await analyticsService.getProjectRecommendations(
      projectPath,
      {
        status,
        includePattern: includePattern === "true",
      },
    );

    res.json({
      project_path: projectPath,
      count: recommendations.length,
      recommendations,
    });
  }),
);

/**
 * GET /api/analytics/patterns?projectPath=...&status=active
 * Get detected patterns for a project.
 */
router.get(
  "/patterns",
  asyncWrap(async (req, res) => {
    const { projectPath, status = "active" } = req.query;

    if (!projectPath) {
      return res.status(400).json({ error: "projectPath query param is required" });
    }

    const patterns = analyticsService.getProjectPatterns(projectPath, status);

    res.json({
      project_path: projectPath,
      count: patterns.length,
      patterns,
    });
  }),
);

/**
 * POST /api/analytics/recommendations/:id/apply
 * Mark a recommendation as applied
 */
router.post(
  "/recommendations/:id/apply",
  asyncWrap(async (req, res) => {
    const { id } = req.params;

    const result = await analyticsService.applyRecommendation(parseInt(id));

    res.json(result);
  }),
);

/**
 * POST /api/analytics/recommendations/:id/dismiss
 * Dismiss a recommendation
 */
router.post(
  "/recommendations/:id/dismiss",
  asyncWrap(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await analyticsService.dismissRecommendation(
      parseInt(id),
      reason,
    );

    res.json(result);
  }),
);

/**
 * GET /api/analytics/pattern-types/:patternType
 * Get affected projects and a sample recommendation for a pattern type.
 */
router.get(
  "/pattern-types/:patternType",
  asyncWrap(async (req, res) => {
    const { patternType } = req.params;
    const details = analyticsService.getPatternTypeDetails(patternType);
    res.json(details);
  }),
);

/**
 * GET /api/analytics/insights
 * Get cross-project insights
 */
router.get(
  "/insights",
  asyncWrap(async (req, res) => {
    const { limit = 5 } = req.query;

    const insights = await analyticsService.getCrossProjectInsights({
      limit: parseInt(limit),
    });

    res.json({
      count: insights.length,
      insights,
    });
  }),
);

export default router;
