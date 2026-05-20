import {
  insertMetricsBatch,
  insertEventsBatch,
  insertSpansBatch,
  recordHealth,
} from '../../database/telemetry.db.js';

function anyValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('intValue' in v) return typeof v.intValue === 'string' ? Number(v.intValue) : v.intValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('boolValue' in v) return v.boolValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(anyValue);
  if ('kvlistValue' in v) return kvlistToObject(v.kvlistValue.values || []);
  return null;
}

function kvlistToObject(list) {
  const out = {};
  for (const kv of list || []) {
    if (kv && kv.key) out[kv.key] = anyValue(kv.value);
  }
  return out;
}

function nanosToMs(ns) {
  if (ns == null) return null;
  const n = typeof ns === 'string' ? BigInt(ns) : BigInt(ns);
  return Number(n / 1000000n);
}

function nanosToBigint(ns) {
  if (ns == null) return null;
  return typeof ns === 'string' ? BigInt(ns) : BigInt(ns);
}

function pickStandardAttrs(attrs) {
  return {
    session_id: attrs['session.id'] || null,
    account_id: attrs['user.account_id'] || attrs['user.account_uuid'] || null,
    organization_id: attrs['organization.id'] || null,
    user_email: attrs['user.email'] || null,
  };
}

function safeJSON(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

export function ingestMetrics(payload) {
  const rows = [];
  const resourceMetrics = payload.resourceMetrics || [];
  for (const rm of resourceMetrics) {
    const resourceAttrs = kvlistToObject(rm.resource?.attributes);
    for (const sm of rm.scopeMetrics || []) {
      for (const metric of sm.metrics || []) {
        const name = metric.name;
        const unit = metric.unit || null;
        const points = (metric.sum?.dataPoints) ||
                       (metric.gauge?.dataPoints) ||
                       (metric.histogram?.dataPoints) ||
                       [];
        for (const p of points) {
          const attrs = { ...resourceAttrs, ...kvlistToObject(p.attributes) };
          let value = null;
          if ('asDouble' in p) value = p.asDouble;
          else if ('asInt' in p) value = typeof p.asInt === 'string' ? Number(p.asInt) : p.asInt;
          else if ('sum' in p) value = p.sum;
          if (value == null) continue;
          const std = pickStandardAttrs(attrs);
          rows.push({
            name,
            value,
            unit,
            timestamp: nanosToMs(p.timeUnixNano) ?? Date.now(),
            session_id: std.session_id,
            account_id: std.account_id,
            organization_id: std.organization_id,
            user_email: std.user_email,
            model: attrs.model || null,
            type: attrs.type || null,
            query_source: attrs.query_source || null,
            speed: attrs.speed || null,
            effort: attrs.effort || null,
            skill_name: attrs['skill.name'] || null,
            plugin_name: attrs['plugin.name'] || null,
            agent_name: attrs['agent.name'] || null,
            tool_name: attrs.tool_name || null,
            decision: attrs.decision || null,
            source: attrs.source || null,
            language: attrs.language || null,
            start_type: attrs.start_type || null,
            attributes: safeJSON(attrs),
          });
        }
      }
    }
  }
  if (rows.length) insertMetricsBatch(rows);
  recordHealth('metrics', Date.now());
  return rows.length;
}

export function ingestLogs(payload) {
  const rows = [];
  const resourceLogs = payload.resourceLogs || [];
  for (const rl of resourceLogs) {
    const resourceAttrs = kvlistToObject(rl.resource?.attributes);
    for (const sl of rl.scopeLogs || []) {
      for (const rec of sl.logRecords || []) {
        const attrs = { ...resourceAttrs, ...kvlistToObject(rec.attributes) };
        const eventName = attrs['event.name'] || rec.eventName || rec.severityText || 'log';
        const ts = nanosToMs(rec.timeUnixNano || rec.observedTimeUnixNano) ?? Date.now();
        const std = pickStandardAttrs(attrs);
        const workspacePaths = Array.isArray(attrs['workspace.host_paths'])
          ? attrs['workspace.host_paths'].join(',')
          : null;
        const successAttr = attrs.success;
        const successInt = successAttr === 'true' || successAttr === true ? 1
                         : successAttr === 'false' || successAttr === false ? 0
                         : null;
        rows.push({
          name: `claude_code.${eventName}`.replace(/^claude_code\.claude_code\./, 'claude_code.'),
          timestamp: ts,
          session_id: std.session_id,
          account_id: std.account_id,
          organization_id: std.organization_id,
          user_email: std.user_email,
          prompt_id: attrs['prompt.id'] || null,
          model: attrs.model || null,
          cost_usd: typeof attrs.cost_usd === 'number' ? attrs.cost_usd : null,
          duration_ms: typeof attrs.duration_ms === 'number' ? attrs.duration_ms : null,
          input_tokens: typeof attrs.input_tokens === 'number' ? attrs.input_tokens : null,
          output_tokens: typeof attrs.output_tokens === 'number' ? attrs.output_tokens : null,
          cache_read_tokens: typeof attrs.cache_read_tokens === 'number' ? attrs.cache_read_tokens : null,
          cache_creation_tokens: typeof attrs.cache_creation_tokens === 'number' ? attrs.cache_creation_tokens : null,
          request_id: attrs.request_id || null,
          tool_name: attrs.tool_name || null,
          tool_use_id: attrs.tool_use_id || null,
          success: successInt,
          error_type: attrs.error_type || null,
          error_message: attrs.error || null,
          decision: attrs.decision || attrs.decision_type || null,
          decision_source: attrs.decision_source || attrs.source || null,
          speed: attrs.speed || null,
          query_source: attrs.query_source || null,
          effort: attrs.effort || null,
          status_code: typeof attrs.status_code === 'number' ? attrs.status_code : null,
          attempt: typeof attrs.attempt === 'number' ? attrs.attempt : null,
          workspace_paths: workspacePaths,
          attributes: safeJSON(attrs),
        });
      }
    }
  }
  if (rows.length) insertEventsBatch(rows);
  recordHealth('logs', Date.now());
  return rows.length;
}

export function ingestTraces(payload) {
  const rows = [];
  const resourceSpans = payload.resourceSpans || [];
  for (const rs of resourceSpans) {
    const resourceAttrs = kvlistToObject(rs.resource?.attributes);
    for (const ss of rs.scopeSpans || []) {
      for (const span of ss.spans || []) {
        const attrs = { ...resourceAttrs, ...kvlistToObject(span.attributes) };
        const start = nanosToBigint(span.startTimeUnixNano);
        const end = nanosToBigint(span.endTimeUnixNano);
        const durationMs = start != null && end != null ? Number((end - start) / 1000000n) : null;
        rows.push({
          trace_id: span.traceId || null,
          span_id: span.spanId || null,
          parent_span_id: span.parentSpanId || null,
          name: span.name,
          start_ns: start != null ? Number(start) : 0,
          end_ns: end != null ? Number(end) : 0,
          duration_ms: durationMs,
          status_code: span.status?.code ?? null,
          session_id: attrs['session.id'] || null,
          attributes: safeJSON(attrs),
        });
      }
    }
  }
  if (rows.length) insertSpansBatch(rows);
  recordHealth('traces', Date.now());
  return rows.length;
}
