#!/usr/bin/env node

/**
 * Backfill Script: Migrate existing JSONL files to dashboard.db
 *
 * Usage:
 *   node scripts/backfill-jsonl.js [--force] [--project=<name>]
 *
 * Options:
 *   --force         Re-process all files, ignoring checksums
 *   --project=NAME  Only process files for specific project
 *   --dry-run       Show what would be processed without inserting
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseJSONLEvents, getProjectDirectories, getProjectName, getProjectPath } from '../src/lib/jsonl.js';
import { transformJSONLFile } from '../src/ingestor/transformer.js';
import { BatchInserter, trackIngestion } from '../src/ingestor/inserter.js';
import { getIngestionMetadata } from '../src/database/dashboard.db.js';
import logger from '../src/lib/logger.js';

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const projectFilter = args.find(arg => arg.startsWith('--project='))?.split('=')[1];

console.log('\n=== JSONL Backfill Script ===\n');
console.log('Options:');
console.log(`  Force: ${force}`);
console.log(`  Dry Run: ${dryRun}`);
console.log(`  Project Filter: ${projectFilter || 'all'}`);
console.log('');

// Statistics
const stats = {
  totalFiles: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  conversations: 0,
  messages: 0,
  toolCalls: 0,
  fileOperations: 0,
  turnDurations: 0
};

/**
 * Calculate file checksum
 */
function calculateChecksum(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (err) {
    return null;
  }
}

/**
 * Process a single JSONL file
 */
function processFile(filePath, _projectPath, projectDir, inserter) {
  try {
    // Calculate checksum
    const checksum = calculateChecksum(filePath);

    // Check if already processed (unless --force)
    if (!force) {
      const metadata = getIngestionMetadata.get('jsonl', filePath);
      if (metadata && metadata.checksum === checksum && metadata.status === 'success') {
        console.log(`  ⊘ Skipping (already processed): ${path.basename(filePath)}`);
        stats.skipped++;
        return;
      }
    }

    // Parse JSONL
    const events = parseJSONLEvents(filePath);
    if (!events || events.length === 0) {
      console.log(`  ⊘ Skipping (no events): ${path.basename(filePath)}`);
      stats.skipped++;
      return;
    }

    // Transform — transformer derives display name from cwd when present,
    // falling back to the directory encoding.
    const transformedData = transformJSONLFile(filePath, events, projectDir);
    if (!transformedData) {
      console.log(`  ⊘ Skipping (no data): ${path.basename(filePath)}`);
      stats.skipped++;
      return;
    }

    // Insert (unless dry run)
    if (!dryRun) {
      const success = inserter.insertSession(transformedData);

      if (success) {
        // Track ingestion
        const lastEventTimestamp = transformedData.conversation?.ended_at || Date.now();
        trackIngestion(filePath, checksum, lastEventTimestamp, 'success', null);

        const sessionStats = inserter.getStats();
        stats.conversations += sessionStats.conversations;
        stats.messages += sessionStats.messages;
        stats.toolCalls += sessionStats.toolCalls;
        stats.fileOperations += sessionStats.fileOperations;
        stats.turnDurations += sessionStats.turnDurations;

        console.log(`  ✓ Processed: ${path.basename(filePath)} (${sessionStats.messages} msgs, ${sessionStats.toolCalls} tools)`);
        stats.processed++;
      } else {
        console.log(`  ✗ Failed: ${path.basename(filePath)}`);
        stats.errors++;
      }
    } else {
      console.log(`  ○ Would process: ${path.basename(filePath)} (${transformedData.messages.length} msgs, ${transformedData.toolCalls.length} tools)`);
      stats.processed++;
    }

  } catch (err) {
    console.log(`  ✗ Error: ${path.basename(filePath)} - ${err.message}`);
    stats.errors++;
  }
}

/**
 * Process all JSONL files in a project directory
 */
function processProject(projectDir, inserter) {
  const projectPath = getProjectPath(projectDir);
  const projectName = getProjectName(projectDir);

  // Skip if project filter doesn't match
  if (projectFilter && projectName !== projectFilter) {
    return;
  }

  console.log(`\n📁 Processing project: ${projectName}`);

  // Find all JSONL files
  const files = fs.readdirSync(projectPath)
    .filter(file => file.endsWith('.jsonl'))
    .map(file => path.join(projectPath, file));

  if (files.length === 0) {
    console.log('  (no JSONL files)');
    return;
  }

  stats.totalFiles += files.length;

  // Process each file
  for (const filePath of files) {
    processFile(filePath, projectName, projectDir, inserter);
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  try {
    // Get all project directories
    const projectDirs = getProjectDirectories();
    console.log(`Found ${projectDirs.length} project directories\n`);

    if (projectDirs.length === 0) {
      console.log('No projects found. Exiting.');
      return;
    }

    // Create batch inserter
    const inserter = new BatchInserter();

    // Process each project
    for (const projectDir of projectDirs) {
      processProject(projectDir, inserter);
    }

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Files:       ${stats.totalFiles}`);
    console.log(`Processed:         ${stats.processed}`);
    console.log(`Skipped:           ${stats.skipped}`);
    console.log(`Errors:            ${stats.errors}`);
    console.log('');
    console.log(`Conversations:     ${stats.conversations}`);
    console.log(`Messages:          ${stats.messages}`);
    console.log(`Tool Calls:        ${stats.toolCalls}`);
    console.log(`File Operations:   ${stats.fileOperations}`);
    console.log(`Turn Durations:    ${stats.turnDurations}`);
    console.log('');
    console.log(`Duration:          ${duration}s`);
    console.log(`Rate:              ${(stats.processed / parseFloat(duration)).toFixed(1)} files/sec`);
    console.log('='.repeat(60));

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No data was actually inserted');
    } else {
      console.log('\n✅ Backfill complete!');
    }

  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  }
}

// Run
main();
