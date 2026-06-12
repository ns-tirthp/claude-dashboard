  1. The OTLP wire envelope (what hits /v1/metrics, /v1/logs, /v1/traces)
  
  Every payload is nested: Resource → Scope → {Metrics | Logs | Spans}. Resource attributes appear once per resourceMetrics/resourceLogs entry and apply to everything beneath. This is exactly what otlp.receiver.js
  flattens with {...resourceAttrs, ...pointAttrs}.

  Resource attributes (attached to ALL signals)

  {
    "resource": {
      "attributes": [
        { "key": "service.name",    "value": { "stringValue": "claude-code" } },
        { "key": "service.version", "value": { "stringValue": "2.1.x" } },
        { "key": "os.type",         "value": { "stringValue": "darwin" } },
        { "key": "os.version",      "value": { "stringValue": "25.5.0" } },
        { "key": "host.arch",       "value": { "stringValue": "arm64" } },
        { "key": "wsl.version",     "value": { "stringValue": "2" } }
      ]
    }
  }

  Identity / standard attributes (on every metric data point AND every log record)

  ┌───────────────────┬────────────────────────────────────────────────┬───────────────────┬───────────────────────────────────┐
  │        Key        │                      Type                      │ Default included? │               Gate                │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ session.id        │ string (UUID)                                  │ ✅ yes            │ OTEL_METRICS_INCLUDE_SESSION_ID   │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ app.version       │ string                                         │ ❌ no             │ OTEL_METRICS_INCLUDE_VERSION      │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ app.entrypoint    │ string cli|sdk-cli|sdk-ts|sdk-py|claude-vscode │ ❌ no             │ OTEL_METRICS_INCLUDE_ENTRYPOINT   │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ organization.id   │ string (UUID)                                  │ ✅ when authed    │ —                                 │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ user.account_uuid │ string (UUID)                                  │ ✅ yes            │ OTEL_METRICS_INCLUDE_ACCOUNT_UUID │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ user.account_id   │ string (user_01...)                            │ ✅ yes            │ OTEL_METRICS_INCLUDE_ACCOUNT_UUID │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ user.id           │ string (anon device id)                        │ ✅ always         │ —                                 │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ user.email        │ string                                         │ ✅ OAuth only     │ —                                 │
  ├───────────────────┼────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────┤
  │ terminal.type     │ string (iTerm.app|vscode|tmux...)              │ ✅ when detected  │ —                                 │
  └───────────────────┴────────────────────────────────────────────────┴───────────────────┴───────────────────────────────────┘

  Events additionally carry: prompt.id (UUID, correlates all events from one prompt), workspace.host_paths (array of host dirs), event.name, event.timestamp, event.sequence.

  ---
  2. METRICS — concrete OTLP payload
  
  8 metrics, all counters. Full example payload:

  {
    "resourceMetrics": [{
      "resource": { "attributes": [
        { "key": "service.name", "value": { "stringValue": "claude-code" } },
        { "key": "os.type", "value": { "stringValue": "darwin" } },
        { "key": "host.arch", "value": { "stringValue": "arm64" } }
      ]},
      "scopeMetrics": [{
        "scope": { "name": "com.anthropic.claude_code", "version": "2.1.x" },
        "metrics": [
          {
            "name": "claude_code.session.count",
            "unit": "count",
            "sum": {
              "isMonotonic": true,
              "aggregationTemporality": 1,
              "dataPoints": [{
                "asInt": "1",
                "timeUnixNano": "1717200000000000000",
                "attributes": [
                  { "key": "session.id",       "value": { "stringValue": "8f3a-..." } },
                  { "key": "user.account_uuid","value": { "stringValue": "acc-uuid" } },
                  { "key": "user.account_id",  "value": { "stringValue": "user_01BWBeN28" } },
                  { "key": "user.id",          "value": { "stringValue": "device-anon-id" } },
                  { "key": "user.email",       "value": { "stringValue": "tirth@example.com" } },
                  { "key": "organization.id",  "value": { "stringValue": "org-uuid" } },
                  { "key": "terminal.type",    "value": { "stringValue": "iTerm.app" } },
                  { "key": "start_type",       "value": { "stringValue": "fresh" } }
                ]
              }]
            }
          },
          {
            "name": "claude_code.lines_of_code.count",
            "unit": "count",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{
              "asInt": "42", "timeUnixNano": "...",
              "attributes": [ { "key": "type", "value": { "stringValue": "added" } } ]
            }]}
          },
          {
            "name": "claude_code.pull_request.count",
            "unit": "count",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{ "asInt": "1", "timeUnixNano": "...", "attributes": [] }]}
          },
          {
            "name": "claude_code.commit.count",
            "unit": "count",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{ "asInt": "3", "timeUnixNano": "...", "attributes": [] }]}
          },
          {
            "name": "claude_code.cost.usage",
            "unit": "USD",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{
              "asDouble": 0.0123, "timeUnixNano": "...",
              "attributes": [
                { "key": "model",        "value": { "stringValue": "claude-opus-4-8" } },
                { "key": "query_source", "value": { "stringValue": "main" } },
                { "key": "speed",        "value": { "stringValue": "fast" } },
                { "key": "effort",       "value": { "stringValue": "high" } },
                { "key": "agent.name",   "value": { "stringValue": "custom" } },
                { "key": "skill.name",   "value": { "stringValue": "deep-research" } },
                { "key": "plugin.name",  "value": { "stringValue": "third-party" } },
                { "key": "marketplace.name", "value": { "stringValue": "..." } },
                { "key": "mcp_server.name",  "value": { "stringValue": "custom" } },
                { "key": "mcp_tool.name",    "value": { "stringValue": "..." } }
              ]
            }]}
          },
          {
            "name": "claude_code.token.usage",
            "unit": "tokens",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{
              "asInt": "1500", "timeUnixNano": "...",
              "attributes": [
                { "key": "type",  "value": { "stringValue": "input" } },
                { "key": "model", "value": { "stringValue": "claude-opus-4-8" } },
                { "key": "query_source", "value": { "stringValue": "main" } }
              ]
            }]}
          },
          {
            "name": "claude_code.code_edit_tool.decision",
            "unit": "count",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{
              "asInt": "1", "timeUnixNano": "...",
              "attributes": [
                { "key": "tool_name", "value": { "stringValue": "Edit" } },
                { "key": "decision",  "value": { "stringValue": "accept" } },
                { "key": "source",    "value": { "stringValue": "user_temporary" } },
                { "key": "language",  "value": { "stringValue": "TypeScript" } }
              ]
            }]}
          },
          {
            "name": "claude_code.active_time.total",
            "unit": "s",
            "sum": { "isMonotonic": true, "aggregationTemporality": 1, "dataPoints": [{
              "asDouble": 12.5, "timeUnixNano": "...",
              "attributes": [ { "key": "type", "value": { "stringValue": "user" } } ]
            }]}
          }
        ]
      }]
    }]
  }

  Metric attribute enums (for your schema design)

  ┌─────────────────────────┬─────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │         Metric          │    Unit     │                                                                  Distinguishing attrs + enum values                                                                  │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ session.count           │ count       │ start_type: fresh|resume|continue                                                                                                                                    │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lines_of_code.count     │ count       │ type: added|removed                                                                                                                                                  │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ pull_request.count      │ count       │ —                                                                                                                                                                    │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ commit.count            │ count       │ —                                                                                                                                                                    │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ cost.usage              │ USD         │ model, query_source: main|subagent|auxiliary; speed: fast; effort: low|medium|high|xhigh|max; agent.name, skill.name, plugin.name, marketplace.name,                 │
  │                         │ (double)    │ mcp_server.name, mcp_tool.name                                                                                                                                       │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ token.usage             │ tokens      │ type: input|output|cacheRead|cacheCreation + all cost attrs                                                                                                          │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ code_edit_tool.decision │ count       │ tool_name: Edit|Write|NotebookEdit; decision: accept|reject; source: config|hook|user_permanent|user_temporary|user_abort|user_reject; language                      │
  ├─────────────────────────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ active_time.total       │ s (double)  │ type: user|cli                                                                                                                                                       │
  └─────────────────────────┴─────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  3. LOG EVENTS — concrete OTLP payload
  
  There are 21 event types. Here's the envelope plus a representative record for each high-value event. In OTLP logs, the event name lives in attributes["event.name"] and everything else is a flat attribute list.

  {
    "resourceLogs": [{
      "resource": { "attributes": [ { "key": "service.name", "value": { "stringValue": "claude-code" } } ] },
      "scopeLogs": [{
        "scope": { "name": "com.anthropic.claude_code" },
        "logRecords": [
          {
            "timeUnixNano": "1717200000000000000",
            "attributes": [
              { "key": "event.name", "value": { "stringValue": "claude_code.user_prompt" } },
              { "key": "session.id", "value": { "stringValue": "8f3a-..." } },
              { "key": "user.email", "value": { "stringValue": "tirth@example.com" } },
              { "key": "prompt.id", "value": { "stringValue": "p-uuid" } },
              { "key": "workspace.host_paths", "value": { "arrayValue": { "values": [ { "stringValue": "/Users/tirthp/Personal/claude-dashboard" } ] } } },
              { "key": "prompt_length", "value": { "intValue": 245 } },
              { "key": "prompt", "value": { "stringValue": "<REDACTED unless OTEL_LOG_USER_PROMPTS>" } },
              { "key": "command_name", "value": { "stringValue": "deep-research" } },
              { "key": "command_source", "value": { "stringValue": "custom" } }
            ]
          }
        ]
      }]
    }]
  }

  Per-event attribute catalog (beyond the standard identity set)

  {
    "claude_code.user_prompt":        ["prompt_length", "prompt*", "command_name", "command_source(builtin|custom|mcp)"],
    "claude_code.tool_result":        ["tool_name", "tool_use_id", "success", "duration_ms", "error_type", "error*", "decision_type", "decision_source", "tool_input_size_bytes", "tool_result_size_bytes",
  "mcp_server_scope", "tool_parameters*", "tool_input*"],
    "claude_code.api_request":        ["model", "cost_usd", "duration_ms", "input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens", "request_id", "speed(fast|normal)", "query_source",
  "effort", "agent.name", "skill.name", "plugin.name", "marketplace.name", "mcp_server.name", "mcp_tool.name"],
    "claude_code.api_error":          ["model", "error", "status_code", "duration_ms", "attempt", "request_id", "speed", "query_source", "effort", "(+attribution attrs)"],
    "claude_code.api_retries_exhausted": ["model", "error", "status_code", "total_attempts", "total_retry_duration_ms", "speed"],
    "claude_code.api_request_body":   ["body*", "body_ref", "body_length", "body_truncated", "model", "query_source"],
    "claude_code.api_response_body":  ["body*", "body_ref", "body_length", "body_truncated", "model", "query_source", "request_id"],
    "claude_code.tool_decision":      ["tool_name", "tool_use_id", "decision(accept|reject)", "source(config|hook|user_permanent|user_temporary|user_abort|user_reject)", "tool_parameters*"],
    "claude_code.permission_mode_changed": ["from_mode", "to_mode", "trigger(shift_tab|exit_plan_mode|auto_gate_denied|auto_opt_in)"],
    "claude_code.auth":               ["action(login|logout)", "success", "auth_method", "error_category", "status_code"],
    "claude_code.mcp_server_connection": ["status(connected|failed|disconnected)", "transport_type(stdio|sse|http)", "server_scope(user|project|local)", "duration_ms", "error_code", "server_name*", "error*"],
    "claude_code.internal_error":     ["error_name", "error_code"],
    "claude_code.plugin_installed":   ["marketplace.is_official", "install.trigger(cli|ui)", "plugin.name*", "plugin.version", "marketplace.name*"],
    "claude_code.plugin_loaded":      ["plugin.name*", "marketplace.name*", "plugin.version", "plugin.scope(official|org|user-local|default-bundle)", "enabled_via", "plugin_id_hash", "has_hooks", "has_mcp",
  "skill_path_count", "command_path_count", "agent_path_count"],
    "claude_code.skill_activated":    ["skill.name*", "invocation_trigger(user-slash|claude-proactive|nested-skill)", "skill.source(bundled|userSettings|projectSettings|plugin)", "plugin.name*",
  "marketplace.name*"],
    "claude_code.at_mention":         ["mention_type(file|directory|agent|mcp_resource)", "success"],
    "claude_code.hook_registered":    ["hook_event", "hook_type(command|prompt|mcp_tool|http|agent)", "hook_source", "hook_matcher*", "plugin.name*", "plugin_id_hash"],
    "claude_code.hook_execution_start": ["hook_event", "hook_name", "num_hooks", "managed_only", "hook_source", "hook_definitions*"],
    "claude_code.hook_execution_complete": ["hook_event", "hook_name", "num_hooks", "num_success", "num_blocking", "num_non_blocking_error", "num_cancelled", "total_duration_ms", "managed_only", "hook_source",
  "hook_definitions*"],
    "claude_code.hook_plugin_metrics": ["plugin_id", "hook_event", "<up to 20 custom metric kv>"],
    "claude_code.compaction":         ["trigger(auto|manual)", "success", "duration_ms", "pre_tokens", "post_tokens", "error*", "precompute_reuse"],
    "claude_code.feedback_survey":    ["event_type", "appearance_id", "survey_type", "response", "enabled_via_override"]
  }
  * = gated/redacted by default (see §5).

  ---
  4. SPANS / TRACES — concrete OTLP payload (Beta)
  
  Requires CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1 + OTEL_TRACES_EXPORTER. Your receiver already handles these (ingestTraces). Hierarchy: interaction → llm_request | tool → {blocked_on_user, execution}.

  {
    "resourceSpans": [{
      "resource": { "attributes": [ { "key": "service.name", "value": { "stringValue": "claude-code" } } ] },
      "scopeSpans": [{
        "scope": { "name": "com.anthropic.claude_code" },
        "spans": [
          {
            "traceId": "5b8aa5a2d2c872e8321cf37308d69df2",
            "spanId": "051581bf3cb55c13",
            "name": "claude_code.interaction",
            "startTimeUnixNano": "1717200000000000000",
            "endTimeUnixNano":   "1717200012000000000",
            "status": { "code": 1 },
            "attributes": [
              { "key": "user_prompt", "value": { "stringValue": "<REDACTED>" } },
              { "key": "user_prompt_length", "value": { "intValue": 245 } },
              { "key": "interaction.sequence", "value": { "intValue": 1 } },
              { "key": "interaction.duration_ms", "value": { "intValue": 12000 } },
              { "key": "session.id", "value": { "stringValue": "8f3a-..." } }
            ]
          },
          {
            "traceId": "5b8aa5a2d2c872e8321cf37308d69df2",
            "spanId": "a1b2c3d4e5f60718",
            "parentSpanId": "051581bf3cb55c13",
            "name": "claude_code.llm_request",
            "startTimeUnixNano": "...", "endTimeUnixNano": "...",
            "attributes": [
              { "key": "model", "value": { "stringValue": "claude-opus-4-8" } },
              { "key": "gen_ai.system", "value": { "stringValue": "anthropic" } },
              { "key": "gen_ai.request.model", "value": { "stringValue": "claude-opus-4-8" } },
              { "key": "query_source", "value": { "stringValue": "main" } },
              { "key": "agent_id", "value": { "stringValue": "..." } },
              { "key": "parent_agent_id", "value": { "stringValue": "..." } },
              { "key": "speed", "value": { "stringValue": "fast" } },
              { "key": "duration_ms", "value": { "intValue": 8000 } },
              { "key": "ttft_ms", "value": { "intValue": 450 } },
              { "key": "input_tokens", "value": { "intValue": 1500 } },
              { "key": "output_tokens", "value": { "intValue": 800 } },
              { "key": "cache_read_tokens", "value": { "intValue": 12000 } },
              { "key": "cache_creation_tokens", "value": { "intValue": 2000 } },
              { "key": "request_id", "value": { "stringValue": "req_..." } },
              { "key": "gen_ai.response.id", "value": { "stringValue": "msg_..." } },
              { "key": "attempt", "value": { "intValue": 1 } },
              { "key": "success", "value": { "boolValue": true } },
              { "key": "status_code", "value": { "intValue": 200 } },
              { "key": "response.has_tool_call", "value": { "boolValue": true } },
              { "key": "stop_reason", "value": { "stringValue": "tool_use" } },
              { "key": "gen_ai.response.finish_reasons", "value": { "arrayValue": { "values": [ { "stringValue": "tool_use" } ] } } }
            ]
          },
          {
            "traceId": "5b8aa5a2d2c872e8321cf37308d69df2",
            "spanId": "b2c3d4e5f6071829",
            "parentSpanId": "051581bf3cb55c13",
            "name": "claude_code.tool",
            "startTimeUnixNano": "...", "endTimeUnixNano": "...",
            "attributes": [
              { "key": "tool_name", "value": { "stringValue": "Bash" } },
              { "key": "duration_ms", "value": { "intValue": 320 } },
              { "key": "result_tokens", "value": { "intValue": 64 } },
              { "key": "agent_id", "value": { "stringValue": "..." } },
              { "key": "file_path", "value": { "stringValue": "<gated OTEL_LOG_TOOL_DETAILS>" } },
              { "key": "full_command", "value": { "stringValue": "<gated>" } },
              { "key": "skill_name", "value": { "stringValue": "<gated>" } },
              { "key": "subagent_type", "value": { "stringValue": "<gated>" } }
            ]
          }
        ]
      }]
    }]
  }

  Child spans claude_code.tool.blocked_on_user (duration_ms, decision, source) and claude_code.tool.execution (duration_ms, success, error*), plus claude_code.hook (detailed-beta only). llm_request.stop_reason
  enum: end_turn|tool_use|max_tokens|stop_sequence|pause_turn|refusal.

  ---
  5. What's gated/redacted by default (critical for architecture & privacy)
  
  ┌───────────────────────────────────┬───────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │              Env var              │        Default        │                                                             Unlocks                                                             │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_LOG_USER_PROMPTS             │ off                   │ user_prompt.prompt, interaction.user_prompt (raw prompt text)                                                                   │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_LOG_TOOL_DETAILS             │ off                   │ tool_input, tool_parameters, error, file_path, full_command, MCP/plugin/skill names un-redacted, hook_matcher, hook_definitions │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_LOG_TOOL_CONTENT             │ off                   │ full tool input/output bodies (≤60 KB) as span events                                                                           │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_LOG_RAW_API_BODIES           │ off (1 or file:<dir>) │ api_request_body.body / api_response_body.body — full Messages API payloads                                                     │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_METRICS_INCLUDE_VERSION      │ false                 │ app.version on metrics                                                                                                          │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_METRICS_INCLUDE_ENTRYPOINT   │ false                 │ app.entrypoint on metrics                                                                                                       │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_METRICS_INCLUDE_SESSION_ID   │ true                  │ session.id on metrics                                                                                                           │
  ├───────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ OTEL_METRICS_INCLUDE_ACCOUNT_UUID │ true                  │ user.account_uuid, user.account_id                                                                                              │
  └───────────────────────────────────┴───────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  Architecture-relevant takeaways
  
  - Identity join key: user.account_id / user.account_uuid + organization.id identify who; user.id is the anon device fallback; session.id groups a run; prompt.id groups all events within one prompt turn — this is
  your natural correlation key across logs/spans for a single interaction.
  - Three signal types, same Resource shape — design one normalization layer (your kvlistToObject + pickStandardAttrs) feeding three fact tables (metrics, events, spans), all FK-joinable on session_id and (for
  events/spans) prompt_id.
  - Cost/token attribution dimensions (model, query_source, speed, effort, agent.name, skill.name, plugin.name, mcp_server.name) repeat across cost.usage, token.usage, api_request, and llm_request spans — model
  these as a shared dimension table.
  - Cardinality watch-outs: session.id, prompt.id, request_id, trace_id are high-cardinality; user.email/account_id are PII; everything under §5 can contain source code or prompt text.

  Want me to turn this into a concrete proposed schema — e.g. a star schema / table DDL, or a TypeScript type model — that maps cleanly onto your existing telemetry.db.js columns and fills the gaps (you're
  currently dropping spans-as-first-class, prompt.id joins, and most of the hook/plugin/skill events)?
