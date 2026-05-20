import { useState, useEffect } from "react";
import {
  Card,
  Statistic,
  Button,
  Spin,
  Alert,
  Row,
  Col,
  Tag,
  Table,
  Select,
  Empty,
  Tooltip as AntTooltip,
} from "antd";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  ReloadOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  BugOutlined,
  CodeOutlined,
  BranchesOutlined,
  PullRequestOutlined,
} from "@ant-design/icons";

const API_URL = "http://localhost:3001";

const RANGE_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 3650, label: "All time" },
];

const MONO = "'Space Mono', 'Courier New', monospace";
const INK = "#1A1A1A";
const RULE = "#E0E0E0";
const AXIS_TICK = "#888888";
const CHART_COLORS = ["#1A1A1A", "#555555", "#888888", "#AAAAAA", "#CCCCCC"];

const axisTick = { fontFamily: MONO, fontSize: 11, fill: AXIS_TICK };
const tooltipContentStyle = {
  fontFamily: MONO,
  fontSize: 11,
  border: `1px solid ${INK}`,
  borderRadius: 0,
  background: "#FFFFFF",
  boxShadow: `3px 3px 0px ${INK}`,
};

function fmtUsd(n) {
  if (n == null) return "$0.00";
  return `$${Number(n).toFixed(n < 1 ? 4 : 2)}`;
}

function fmtNum(n) {
  if (n == null) return "0";
  return new Intl.NumberFormat().format(Math.round(n));
}

function fmtSec(s) {
  if (!s) return "0s";
  const seconds = Math.floor(s);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ ...tooltipContentStyle, padding: "6px 10px" }}>
      <div style={{ color: INK, fontWeight: 700 }}>
        {label || payload[0].name}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || INK }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function TelemetryView() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cost, setCost] = useState(null);
  const [time, setTime] = useState(null);
  const [reliability, setReliability] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [productivity, setProductivity] = useState(null);
  const [health, setHealth] = useState(null);
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [promptDetail, setPromptDetail] = useState(null);
  const [countdown, setCountdown] = useState(10);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    setCountdown(10); // Reset countdown on manual refresh
    try {
      const q = `?days=${days}`;
      const [s, c, t, r, p, prod, h] = await Promise.all([
        fetch(`${API_URL}/api/telemetry/summary${q}`).then((r) => r.json()),
        fetch(`${API_URL}/api/telemetry/cost${q}`).then((r) => r.json()),
        fetch(`${API_URL}/api/telemetry/time${q}`).then((r) => r.json()),
        fetch(`${API_URL}/api/telemetry/reliability${q}`).then((r) => r.json()),
        fetch(`${API_URL}/api/telemetry/prompts${q}&limit=100`).then((r) =>
          r.json(),
        ),
        fetch(`${API_URL}/api/telemetry/productivity${q}`).then((r) =>
          r.json(),
        ),
        fetch(`${API_URL}/api/telemetry/health`).then((r) => r.json()),
      ]);
      setSummary(s);
      setCost(c);
      setTime(t);
      setReliability(r);
      setPrompts(p);
      setProductivity(prod);
      setHealth(h);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [days]);

  // Auto-refresh with countdown
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchAll();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [days]);

  useEffect(() => {
    if (!selectedPromptId) {
      setPromptDetail(null);
      return;
    }
    fetch(`${API_URL}/api/telemetry/prompts/${selectedPromptId}`)
      .then((r) => r.json())
      .then(setPromptDetail)
      .catch(() => setPromptDetail(null));
  }, [selectedPromptId]);

  if (loading && !summary) {
    return (
      <div className="text-center py-12">
        <Spin size="large" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert
        type="error"
        message="Telemetry error"
        description={error}
        action={
          <Button onClick={fetchAll} icon={<ReloadOutlined />}>
            Retry
          </Button>
        }
      />
    );
  }

  const noData =
    (summary?.totalUsd ?? 0) === 0 &&
    (summary?.activeSeconds ?? 0) === 0 &&
    (summary?.toolReliability?.successes ?? 0) === 0 &&
    (summary?.toolReliability?.failures ?? 0) === 0;

  // Health banner
  const lastSignal = (health?.signals || []).reduce(
    (acc, s) => (s.last_received_at > (acc?.last_received_at || 0) ? s : acc),
    null,
  );
  const ingestStale = !lastSignal || lastSignal.seconds_since_last > 600;

  // Charts data
  const costByModel = (cost?.byModel || []).map((r) => ({
    name: (r.model || "unknown").replace("claude-", ""),
    usd: Number(r.usd),
  }));
  const costDaily = (cost?.daily || []).map((r) => ({
    date: r.day,
    usd: Number(r.usd),
  }));
  const activeDaily = (time?.byDay || []).map((r) => ({
    date: r.day,
    sec: Number(r.seconds),
  }));
  const toolDuration = (time?.toolDuration || []).slice(0, 10).map((r) => ({
    name: r.tool_name || "unknown",
    avg: Number(r.avg_ms || 0),
    sum: Number(r.sum_ms || 0),
  }));
  const toolReliability = (reliability?.toolStats || []).map((r) => ({
    tool: r.tool_name || "unknown",
    total: r.total,
    successes: r.successes,
    failures: r.failures,
    successRate: r.total > 0 ? (r.successes / r.total) * 100 : 0,
  }));

  const tokensByType = (cost?.tokensByType || []).reduce((acc, r) => {
    acc[r.type] = Number(r.tokens);
    return acc;
  }, {});

  const linesByType = (
    summary?.linesByType ||
    productivity?.linesByType ||
    []
  ).reduce((acc, r) => {
    acc[r.type] = Number(r.lines);
    return acc;
  }, {});
  const linesAdded = linesByType.added || 0;
  const linesRemoved = linesByType.removed || 0;
  const linesNet = linesAdded - linesRemoved;

  // Pivot daily LOC into one row per day with added/removed columns for the chart.
  const linesDaily = Object.values(
    (productivity?.linesDaily || []).reduce((acc, r) => {
      acc[r.day] ??= { date: r.day, added: 0, removed: 0 };
      acc[r.day][r.type === "removed" ? "removed" : "added"] = Number(r.lines);
      return acc;
    }, {}),
  ).sort((a, b) => a.date.localeCompare(b.date));

  const editDecisionRows = (productivity?.editDecisions || []).map((r, i) => ({
    key: i,
    tool: r.tool,
    decision: r.decision,
    count: Number(r.count),
  }));
  const editLanguageRows = (productivity?.editsByLanguage || []).map(
    (r, i) => ({
      key: i,
      language: r.language,
      decision: r.decision,
      count: Number(r.count),
    }),
  );
  const editsAccepted = editDecisionRows
    .filter((r) => r.decision === "accept")
    .reduce((a, r) => a + r.count, 0);
  const editsRejected = editDecisionRows
    .filter((r) => r.decision === "reject")
    .reduce((a, r) => a + r.count, 0);
  const editsTotal = editsAccepted + editsRejected;

  const promptColumns = [
    {
      title: "Started",
      dataIndex: "started_at",
      key: "started_at",
      render: (v) => new Date(v).toLocaleString(),
      sorter: (a, b) => a.started_at - b.started_at,
      defaultSortOrder: "descend",
      width: 180,
    },
    {
      title: "Session",
      dataIndex: "session_id",
      key: "session_id",
      render: (v) => (
        <code style={{ fontSize: 11 }}>{(v || "").slice(0, 8)}</code>
      ),
      width: 100,
    },
    { title: "API", dataIndex: "api_calls", key: "api_calls", width: 70 },
    { title: "Tools", dataIndex: "tool_calls", key: "tool_calls", width: 70 },
    {
      title: "Errors",
      dataIndex: "api_errors",
      key: "api_errors",
      width: 70,
      render: (v) => (v > 0 ? <Tag color="red">{v}</Tag> : v),
    },
    {
      title: "Input tok",
      dataIndex: "input_tokens",
      key: "input_tokens",
      render: fmtNum,
      width: 100,
    },
    {
      title: "Output tok",
      dataIndex: "output_tokens",
      key: "output_tokens",
      render: fmtNum,
      width: 100,
    },
    {
      title: "API time",
      dataIndex: "api_ms",
      key: "api_ms",
      render: fmtMs,
      width: 90,
    },
    {
      title: "Tool time",
      dataIndex: "tool_ms",
      key: "tool_ms",
      render: fmtMs,
      width: 90,
    },
    {
      title: "Cost",
      dataIndex: "cost_usd",
      key: "cost_usd",
      render: fmtUsd,
      sorter: (a, b) => a.cost_usd - b.cost_usd,
      width: 100,
    },
    {
      title: "",
      key: "action",
      width: 80,
      render: (_, row) => (
        <Button size="small" onClick={() => setSelectedPromptId(row.prompt_id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* Range + refresh */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Select
            value={days}
            onChange={setDays}
            options={RANGE_OPTIONS}
            style={{ width: 180 }}
          />
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchAll}
            loading={loading}
          >
            {loading ? "Refreshing..." : `Refresh (${countdown}s)`}
          </Button>
        </Col>
      </Row>

      {/* Ingest health */}
      <Alert
        style={{ marginBottom: 16 }}
        type={ingestStale ? "warning" : "success"}
        showIcon
        message={
          ingestStale
            ? "No telemetry received recently. See SETUP_TELEMETRY.md to enable Claude Code OTel exporter."
            : `Receiving telemetry — last signal ${lastSignal.seconds_since_last}s ago (${lastSignal.signal})`
        }
        description={
          <span style={{ fontSize: 12 }}>
            {health?.totals?.metrics ?? 0} metric points ·{" "}
            {health?.totals?.events ?? 0} events · {health?.totals?.spans ?? 0}{" "}
            spans stored
          </span>
        }
      />

      {noData && (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          message="No telemetry in the selected range"
          description="Run Claude Code with telemetry enabled, then refresh. See SETUP_TELEMETRY.md for the env vars."
          showIcon
        />
      )}

      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="stretch">
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Total cost"
              value={fmtUsd(summary?.totalUsd)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: INK }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Active time"
              value={fmtSec(summary?.activeSeconds)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Sessions"
              value={fmtNum(summary?.sessions)}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Tool success rate"
              value={(() => {
                const s = summary?.toolReliability?.successes || 0;
                const f = summary?.toolReliability?.failures || 0;
                const t = s + f;
                return t > 0 ? `${((s / t) * 100).toFixed(1)}%` : "—";
              })()}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "#999999" }}>
              {summary?.toolReliability?.successes || 0} ok /{" "}
              {summary?.toolReliability?.failures || 0} failed
            </div>
          </Card>
        </Col>
      </Row>

      {/* Token totals */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Input tokens"
              value={fmtNum(tokensByType.input)}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Output tokens"
              value={fmtNum(tokensByType.output)}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Cache read"
              value={fmtNum(tokensByType.cacheRead)}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Cache create"
              value={fmtNum(tokensByType.cacheCreation)}
            />
          </Card>
        </Col>
      </Row>

      {/* Productivity */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="stretch">
        <Col xs={12} sm={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Lines added"
              value={fmtNum(linesAdded)}
              prefix={<CodeOutlined />}
              valueStyle={{ color: INK }}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "#999999" }}>
              net {linesNet >= 0 ? "+" : ""}
              {fmtNum(linesNet)}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Lines removed"
              value={fmtNum(linesRemoved)}
              prefix={<CodeOutlined />}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "#999999" }}>
              &nbsp;
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Commits"
              value={fmtNum(summary?.commits ?? productivity?.commits)}
              prefix={<BranchesOutlined />}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "#999999" }}>
              &nbsp;
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6} style={{ display: "flex" }}>
          <Card style={{ width: "100%" }}>
            <Statistic
              title="Pull requests"
              value={fmtNum(
                summary?.pullRequests ?? productivity?.pullRequests,
              )}
              prefix={<PullRequestOutlined />}
            />
            <div style={{ fontSize: 11, marginTop: 4, color: "#999999" }}>
              edit accepts:{" "}
              {editsTotal > 0
                ? `${((editsAccepted / editsTotal) * 100).toFixed(0)}%`
                : "—"}{" "}
              ({editsAccepted}/{editsTotal})
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <CodeOutlined /> Lines of code per day
              </>
            }
            style={{ width: "100%" }}
          >
            {linesDaily.length === 0 ? (
              <Empty description="No edit activity yet — needs Claude to run Edit/Write/NotebookEdit" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={linesDaily}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} />
                  <XAxis dataKey="date" tick={axisTick} stroke={INK} />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="added" name="added" fill={INK} radius={0} />
                  <Bar
                    dataKey="removed"
                    name="removed"
                    fill="#888888"
                    radius={0}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <CodeOutlined /> Edit decisions
              </>
            }
            style={{ width: "100%" }}
          >
            {editDecisionRows.length === 0 ? (
              <Empty />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={editDecisionRows}
                columns={[
                  { title: "Tool", dataIndex: "tool" },
                  {
                    title: "Decision",
                    dataIndex: "decision",
                    render: (v) =>
                      v === "accept" ? (
                        <Tag color="green">accept</Tag>
                      ) : v === "reject" ? (
                        <Tag color="red">reject</Tag>
                      ) : (
                        <Tag>{v}</Tag>
                      ),
                  },
                  { title: "Count", dataIndex: "count", align: "right" },
                ]}
              />
            )}
            {editLanguageRows.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 12,
                    marginBottom: 4,
                  }}
                >
                  By language
                </div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={editLanguageRows.slice(0, 10)}
                  columns={[
                    { title: "Language", dataIndex: "language" },
                    { title: "Decision", dataIndex: "decision" },
                    { title: "Count", dataIndex: "count", align: "right" },
                  ]}
                />
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* Cost charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <DollarOutlined /> Cost by day
              </>
            }
            style={{ width: "100%" }}
          >
            {costDaily.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={costDaily}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} />
                  <XAxis dataKey="date" tick={axisTick} stroke={INK} />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="usd"
                    stroke={INK}
                    strokeWidth={2}
                    dot={{ fill: INK, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: INK }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <DollarOutlined /> Cost by model
              </>
            }
            style={{ width: "100%" }}
          >
            {costByModel.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={costByModel}
                    dataKey="usd"
                    nameKey="name"
                    outerRadius={100}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {costByModel.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* Cost attribution tables */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8} style={{ display: "flex" }}>
          <Card title="Cost by skill" size="small" style={{ width: "100%" }}>
            <Table
              size="small"
              pagination={false}
              dataSource={cost?.bySkill || []}
              rowKey="skill"
              columns={[
                { title: "Skill", dataIndex: "skill" },
                {
                  title: "USD",
                  dataIndex: "usd",
                  render: fmtUsd,
                  align: "right",
                },
              ]}
              locale={{ emptyText: "No data" }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8} style={{ display: "flex" }}>
          <Card title="Cost by agent" size="small" style={{ width: "100%" }}>
            <Table
              size="small"
              pagination={false}
              dataSource={cost?.byAgent || []}
              rowKey="agent"
              columns={[
                { title: "Agent", dataIndex: "agent" },
                {
                  title: "USD",
                  dataIndex: "usd",
                  render: fmtUsd,
                  align: "right",
                },
              ]}
              locale={{ emptyText: "No data" }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8} style={{ display: "flex" }}>
          <Card title="Cost by plugin" size="small" style={{ width: "100%" }}>
            <Table
              size="small"
              pagination={false}
              dataSource={cost?.byPlugin || []}
              rowKey="plugin"
              columns={[
                { title: "Plugin", dataIndex: "plugin" },
                {
                  title: "USD",
                  dataIndex: "usd",
                  render: fmtUsd,
                  align: "right",
                },
              ]}
              locale={{ emptyText: "No data" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Time + reliability */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <ClockCircleOutlined /> Active time per day
              </>
            }
            style={{ width: "100%", display: "flex", flexDirection: "column" }}
            styles={{
              body: {
                flex: 1,
                ...(activeDaily.length === 0 && {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }),
              },
            }}
          >
            {activeDaily.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={activeDaily}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} />
                  <XAxis dataKey="date" tick={axisTick} stroke={INK} />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sec" name="seconds" fill={INK} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <ClockCircleOutlined /> Tool execution time (avg ms, top 10)
              </>
            }
            style={{ width: "100%", display: "flex", flexDirection: "column" }}
            styles={{
              body: {
                flex: 1,
                ...(toolDuration.length === 0 && {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }),
              },
            }}
          >
            {toolDuration.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={toolDuration}
                  layout="vertical"
                  margin={{ left: 60 }}
                >
                  <CartesianGrid strokeDasharray="0" stroke={RULE} />
                  <XAxis type="number" tick={axisTick} stroke={INK} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={axisTick}
                    stroke={INK}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg" fill={INK} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* API timing summary */}
      {time?.apiDuration?.count > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="API requests"
                value={fmtNum(time.apiDuration.count)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Avg API time"
                value={fmtMs(time.apiDuration.avg_ms)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Min API time"
                value={fmtMs(time.apiDuration.min_ms)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Max API time"
                value={fmtMs(time.apiDuration.max_ms)}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Reliability */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <CheckCircleOutlined /> Tool reliability
              </>
            }
            style={{ width: "100%" }}
          >
            {toolReliability.length === 0 ? (
              <Empty />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={toolReliability}
                rowKey="tool"
                columns={[
                  { title: "Tool", dataIndex: "tool" },
                  { title: "Total", dataIndex: "total", align: "right" },
                  { title: "OK", dataIndex: "successes", align: "right" },
                  {
                    title: "Failed",
                    dataIndex: "failures",
                    align: "right",
                    render: (v) => (v > 0 ? <Tag color="red">{v}</Tag> : v),
                  },
                  {
                    title: "Success",
                    dataIndex: "successRate",
                    align: "right",
                    render: (v) => `${v.toFixed(1)}%`,
                    sorter: (a, b) => a.successRate - b.successRate,
                  },
                ]}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10} style={{ display: "flex" }}>
          <Card
            title={
              <>
                <BugOutlined /> Errors & retries
              </>
            }
            style={{ width: "100%" }}
          >
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Statistic
                  title="API errors"
                  value={fmtNum(reliability?.apiErrors?.total_errors)}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Retries exhausted"
                  value={fmtNum(reliability?.retriesExhausted)}
                  valueStyle={{
                    color: reliability?.retriesExhausted > 0 ? "#C53030" : INK,
                  }}
                />
              </Col>
            </Row>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Top error categories
            </div>
            {(reliability?.errorBreakdown || []).length === 0 ? (
              <Empty />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={reliability.errorBreakdown}
                rowKey={(r) => `${r.error_type}-${r.tool_name}`}
                columns={[
                  { title: "Type", dataIndex: "error_type" },
                  { title: "Tool", dataIndex: "tool_name" },
                  { title: "Count", dataIndex: "count", align: "right" },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Prompt drilldown */}
      <Card
        title="Recent prompts (drilldown)"
        style={{ marginBottom: 16 }}
        extra={
          <span style={{ fontSize: 11, color: "#999999" }}>
            {prompts?.prompts?.length || 0} prompts
          </span>
        }
      >
        <Table
          size="small"
          columns={promptColumns}
          dataSource={prompts?.prompts || []}
          rowKey="prompt_id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {selectedPromptId && (
        <Card
          title={
            <>
              Prompt timeline{" "}
              <code style={{ fontSize: 11 }}>{selectedPromptId}</code>
            </>
          }
          extra={
            <Button size="small" onClick={() => setSelectedPromptId(null)}>
              Close
            </Button>
          }
        >
          {!promptDetail ? (
            <Spin />
          ) : (
            <Table
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              dataSource={promptDetail.events}
              rowKey={(_, i) => i}
              columns={[
                {
                  title: "Time",
                  dataIndex: "timestamp",
                  render: (v) => new Date(v).toLocaleTimeString(),
                  width: 120,
                },
                {
                  title: "Event",
                  dataIndex: "name",
                  render: (v) => v.replace("claude_code.", ""),
                  width: 160,
                },
                { title: "Tool", dataIndex: "tool_name", width: 100 },
                {
                  title: "Model",
                  dataIndex: "model",
                  render: (v) => (v ? v.replace("claude-", "") : "—"),
                  width: 140,
                },
                {
                  title: "Duration",
                  dataIndex: "duration_ms",
                  render: fmtMs,
                  width: 90,
                },
                {
                  title: "Tokens",
                  key: "toks",
                  render: (_, r) =>
                    r.input_tokens || r.output_tokens
                      ? `${fmtNum(r.input_tokens)}/${fmtNum(r.output_tokens)}`
                      : "—",
                  width: 120,
                },
                {
                  title: "Cost",
                  dataIndex: "cost_usd",
                  render: fmtUsd,
                  width: 90,
                },
                {
                  title: "Status",
                  key: "status",
                  render: (_, r) =>
                    r.success === 1 ? (
                      <Tag color="green">ok</Tag>
                    ) : r.success === 0 ? (
                      <AntTooltip title={r.error_message || ""}>
                        <Tag color="red">{r.error_type || "fail"}</Tag>
                      </AntTooltip>
                    ) : (
                      <Tag>—</Tag>
                    ),
                  width: 110,
                },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
