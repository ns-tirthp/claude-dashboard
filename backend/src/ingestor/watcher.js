import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { parseJSONL } from '../lib/jsonl.js';
import { transformJSONLFile } from './transformer.js';
import { insertJSONLFile } from './inserter.js';
import { getIngestionMetadata } from '../database/dashboard.db.js';
import config from '../config/index.js';
import logger from '../lib/logger.js';

/**
 * JSONL File Watcher Service
 * Monitors ~/.claude/projects for JSONL file changes and ingests them
 */
export class JSONLWatcher {
  constructor(options = {}) {
    this.projectsPath = options.projectsPath || config.claudeProjectsPath;
    this.watcher = null;
    this.isRunning = false;
    this.stats = {
      filesProcessed: 0,
      filesSkipped: 0,
      errors: 0
    };

    // Debounce configuration
    this.debounceTime = options.debounceTime || 2000; // Wait 2s after last change
    this.pendingFiles = new Map(); // filePath -> 'running' | 'rerun'
  }

  /**
   * Start watching for JSONL file changes
   */
  start() {
    if (this.isRunning) {
      logger.warn('watcher', 'JSONL watcher already running');
      return;
    }

    logger.info('watcher', `Starting JSONL watcher on ${this.projectsPath}`);

    // Watch the projects directory itself so new JSONL files are automatically
    // detected without requiring a restart.
    const watchPath = this.projectsPath;
    logger.info('watcher', `Watching directory: ${watchPath}`);

    // Enable polling for Docker environments where inotify doesn't work across volume mounts
    const isDocker = fs.existsSync('/.dockerenv');

    this.watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: false,
      // Short stability window so live sessions ingest while still in progress.
      // The periodic flush below is the safety net for chatty sessions whose
      // writes never quiet down for the full window.
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: isDocker ? 250 : 100
      },
      depth: 3,
      alwaysStat: true,
      // Enable polling in Docker (macOS bind mounts don't emit inotify events)
      usePolling: isDocker,
      interval: isDocker ? 1000 : 5000,
      binaryInterval: isDocker ? 2000 : 10000
    });

    this.watcher
      .on('add', (filePath) => {
        if (!filePath.endsWith('.jsonl')) return;
        logger.info('watcher', `New file detected: ${filePath}`);
        this.scheduleIngestion(filePath);
      })
      .on('change', (filePath) => {
        if (!filePath.endsWith('.jsonl')) return;
        logger.info('watcher', `File changed: ${filePath}`);
        this.scheduleIngestion(filePath);
      })
      .on('error', (error) => {
        logger.error('watcher', 'Watcher error', { error: error.message });
        this.stats.errors++;
      })
      .on('ready', () => {
        logger.info('watcher', 'JSONL watcher ready - initial scan complete');
        this.isRunning = true;
        this.startPeriodicFlush();
      });
  }

  /**
   * Periodically rescan all JSONLs and re-ingest any whose fingerprint changed.
   * Catches active sessions whose writes never quiet down long enough for
   * chokidar's awaitWriteFinish to emit a change event.
   */
  startPeriodicFlush() {
    if (this.flushTimer) return;
    const intervalMs = 10000;
    this.flushTimer = setInterval(() => {
      const files = this.findAllJSONLFiles();
      for (const filePath of files) {
        this.scheduleIngestion(filePath);
      }
    }, intervalMs);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }


  /**
   * Stop the watcher
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('watcher', 'Stopping JSONL watcher...');

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Drop any pending re-run requests; in-flight ingestion will finish naturally.
    this.pendingFiles.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.isRunning = false;
    logger.info('watcher', 'JSONL watcher stopped');
  }

  /**
   * Schedule file ingestion. We intentionally avoid an additional debounce here
   * because chokidar's `awaitWriteFinish.stabilityThreshold` already guarantees
   * the file has been quiet long enough — a second timer just adds latency.
   * However we still serialize per-file ingestion: if a previous run is still
   * processing this file, we mark it dirty and re-run when it completes.
   */
  scheduleIngestion(filePath) {
    if (this.pendingFiles.get(filePath) === 'running') {
      this.pendingFiles.set(filePath, 'rerun');
      return;
    }
    this.pendingFiles.set(filePath, 'running');
    this.runIngestionLoop(filePath);
  }

  async runIngestionLoop(filePath) {
    try {
      await this.ingestFile(filePath);
    } finally {
      const next = this.pendingFiles.get(filePath);
      if (next === 'rerun') {
        this.pendingFiles.set(filePath, 'running');
        this.runIngestionLoop(filePath);
      } else {
        this.pendingFiles.delete(filePath);
      }
    }
  }

  /**
   * Ingest a single JSONL file
   */
  async ingestFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn('watcher', `File no longer exists: ${filePath}`);
        return;
      }

      const checksum = this.calculateChecksum(filePath);
      if (!checksum) {
        this.stats.errors++;
        return;
      }

      const metadata = getIngestionMetadata.get('jsonl', filePath);
      if (metadata && metadata.checksum === checksum && metadata.status === 'success') {
        logger.debug('watcher', `Skipping ${filePath} (checksum unchanged)`);
        this.stats.filesSkipped++;
        return;
      }

      logger.info('watcher', `Ingesting: ${filePath}`);
      const parsed = parseJSONL(filePath);
      const events = parsed.events;

      if (parsed.invalidLines > 0) {
        logger.warn('watcher', `${filePath}: ${parsed.invalidLines} malformed line(s) skipped`);
      }

      if (!events || events.length === 0) {
        logger.warn('watcher', `No events found in ${filePath}`);
        this.stats.filesSkipped++;
        return;
      }

      const projectDir = path.basename(path.dirname(filePath));
      const transformedData = transformJSONLFile(filePath, events, projectDir);

      if (!transformedData) {
        logger.warn('watcher', `No data extracted from ${filePath}`);
        this.stats.filesSkipped++;
        return;
      }

      const success = insertJSONLFile(filePath, transformedData, checksum);

      if (success) {
        this.stats.filesProcessed++;
        logger.info('watcher', `Ingested ${filePath}`);
      } else {
        this.stats.errors++;
        logger.error('watcher', `Failed to ingest ${filePath}`);
      }
    } catch (err) {
      this.stats.errors++;
      logger.error('watcher', `Error ingesting ${filePath}`, { error: err.message, stack: err.stack });
    }
  }

  /**
   * Calculate MD5 checksum of file
   */
  calculateChecksum(filePath) {
    try {
      const stat = fs.statSync(filePath);
      // Cheap content-equivalent fingerprint: size + mtime. Avoids reading
      // gigabyte JSONL files on every event. Real corruption is caught by
      // the parser; size+mtime is enough to detect changed/new content.
      return `${stat.size}:${stat.mtimeMs}`;
    } catch (err) {
      logger.error('watcher', `Error fingerprinting ${filePath}`, { error: err.message });
      return null;
    }
  }

  /**
   * Get watcher statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      pendingFiles: this.pendingFiles.size
    };
  }

  /**
   * Manually rescan all JSONL files (for use by the refresh API endpoint)
   */
  async rescanAll() {
    logger.info('watcher', 'Manual rescan triggered');
    const files = this.findAllJSONLFiles();
    logger.info('watcher', `Found ${files.length} JSONL files to rescan`);
    for (const filePath of files) {
      await this.ingestFile(filePath);
    }
  }

  findAllJSONLFiles() {
    const files = [];
    try {
      const entries = fs.readdirSync(this.projectsPath);
      for (const entry of entries) {
        const dirPath = path.join(this.projectsPath, entry);
        try {
          const stat = fs.statSync(dirPath);
          if (!stat.isDirectory()) continue;
        } catch { continue; }

        const children = fs.readdirSync(dirPath);
        for (const child of children) {
          if (child.endsWith('.jsonl')) {
            files.push(path.join(dirPath, child));
          }
        }
      }
    } catch (err) {
      logger.error('watcher', 'Error scanning for JSONL files', { error: err.message });
    }
    return files;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      filesProcessed: 0,
      filesSkipped: 0,
      errors: 0
    };
  }
}

// Singleton instance
let watcherInstance = null;

/**
 * Start the JSONL watcher
 */
export function startWatcher(options = {}) {
  if (watcherInstance) {
    logger.warn('watcher', 'Watcher already started');
    return watcherInstance;
  }

  watcherInstance = new JSONLWatcher(options);
  watcherInstance.start();
  return watcherInstance;
}

/**
 * Stop the JSONL watcher
 */
export async function stopWatcher() {
  if (watcherInstance) {
    await watcherInstance.stop();
    watcherInstance = null;
  }
}

/**
 * Get the watcher instance
 */
export function getWatcher() {
  return watcherInstance;
}

export default JSONLWatcher;
