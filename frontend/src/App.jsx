import { useState, useEffect } from 'react';
import { Card, Table, Statistic, Button, Spin, Alert, Row, Col, Progress, Tag, Divider, Tabs, Select, Tooltip as AntTooltip } from 'antd';
import TelemetryView from './TelemetryView.jsx';
import AssistantChat from './AssistantChat.jsx';
import ChatHistory from './ChatHistory.jsx';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import {
  ReloadOutlined,
  ProjectOutlined,
  MessageOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  FileTextOutlined,
  EditOutlined,
  ReadOutlined,
  FilterOutlined
} from '@ant-design/icons';

const API_URL = 'http://localhost:3001';

const MONO = "'Space Mono', 'Courier New', monospace";
const INK = '#1A1A1A';
const RULE = '#E0E0E0';
const AXIS_TICK = '#888888';
const PIE_SCALE = ['#1A1A1A', '#555555', '#888888', '#AAAAAA', '#CCCCCC'];

const axisTick = { fontFamily: MONO, fontSize: 11, fill: AXIS_TICK };
const tooltipContentStyle = {
  fontFamily: MONO,
  fontSize: 11,
  border: `1px solid ${INK}`,
  borderRadius: 0,
  background: '#FFFFFF',
  boxShadow: `3px 3px 0px ${INK}`,
};
const tooltipItemStyle = { color: INK, fontFamily: MONO };
const tooltipLabelStyle = { color: INK, fontFamily: MONO, fontWeight: 700 };

function App() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ projects: [] });
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');

  const fetchStats = async (project = selectedProject, branch = selectedBranch) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (project && project !== 'all') params.set('project', project);
      if (branch && branch !== 'all') params.set('branch', branch);
      const qs = params.toString();
      const response = await fetch(`${API_URL}/api/stats${qs ? `?${qs}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/filters`);
      if (!response.ok) throw new Error('Failed to fetch filters');
      const data = await response.json();
      setFilterOptions(data);
    } catch (err) {
      // Non-blocking — filters are optional UX
      console.error('Failed to load filter options', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchFilterOptions();
  }, []);

  const handleProjectChange = (value) => {
    setSelectedProject(value);
    setSelectedBranch('all'); // reset branch when project changes
    fetchStats(value, 'all');
  };

  const handleBranchChange = (value) => {
    setSelectedBranch(value);
    fetchStats(selectedProject, value);
  };

  const branchesForSelectedProject =
    selectedProject === 'all'
      ? []
      : (filterOptions.projects.find(p => p.name === selectedProject)?.branches || []);

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const TIME_SOURCE_LABEL = {
    measured: 'Measured from Claude Code CLI turn-duration events.',
    estimated: 'Estimated from message timestamps (SDK / IDE session). Each turn is capped at 5 minutes to limit idle-time inflation.',
    mixed: 'Some sessions measured (CLI), others estimated from timestamps (SDK / IDE). Total combines both.',
    none: 'No time data available for this scope.',
  };

  // Renders a duration with a tilde prefix and tooltip when the value is
  // estimated rather than measured. Keeps measured values flush so the
  // common case stays clean.
  const renderDuration = (ms, source) => {
    const isEstimate = source === 'estimated' || source === 'mixed';
    const text = formatDuration(ms);
    if (!isEstimate) {
      return <span style={{ fontWeight: 700 }}>{text}</span>;
    }
    return (
      <AntTooltip title={TIME_SOURCE_LABEL[source]}>
        <span style={{ fontWeight: 700, borderBottom: `1px dotted ${INK}`, cursor: 'help' }}>
          ~{text}
        </span>
      </AntTooltip>
    );
  };

  // Initial load — show full-screen spinner only when no data has arrived yet.
  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#EEEEE8] flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 font-mono uppercase tracking-wider text-sm" style={{ color: INK, letterSpacing: '0.08em' }}>Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#EEEEE8] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            className="mb-4"
          />
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchStats()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const toolChartData = Object.entries(stats.toolUsage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const modelChartData = Object.entries(stats.modelUsage)
    .map(([name, count]) => ({
      name: name.replace('claude-', '').replace('-20250929', ''),
      value: count
    }));

  const CHART_COLORS = PIE_SCALE;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipContentStyle}>
          <div style={{ padding: '6px 10px', color: INK, fontFamily: MONO, fontSize: 11 }}>
            {`${label || payload[0].name}: ${payload[0].value}`}
          </div>
        </div>
      );
    }
    return null;
  };

  // Prepare branch activity data
  const branchChartData = Object.entries(stats.branchActivity || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Prepare hourly activity data
  const hourlyChartData = (stats.hourlyActivity || []).map((count, hour) => ({
    hour: `${hour}:00`,
    activity: count
  }));

  // Prepare entrypoint data
  const entrypointChartData = Object.entries(stats.entrypointUsage || {})
    .map(([name, count]) => ({ name, value: count }));

  // Prepare daily activity data (last 30 days)
  const dailyChartData = Object.entries(stats.dailyActivity || {})
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-30)
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      activity: count
    }));

  // Calculate additional insights
  const avgToolCallsPerConversation = stats.totalConversations > 0
    ? Math.round(stats.totalToolCalls / stats.totalConversations)
    : 0;

  const avgTimePerConversation = stats.totalConversations > 0
    ? Math.round(stats.totalTime / stats.totalConversations)
    : 0;

  const totalTokens = stats.projects.reduce(
    (acc, p) => acc + p.tokens.input + p.tokens.output,
    0
  );

  const cacheHitRate = stats.projects.length > 0
    ? stats.projects.reduce(
        (acc, p) => {
          const total = p.tokens.cacheCreation + p.tokens.cacheRead;
          return total > 0 ? acc + (p.tokens.cacheRead / total) * 100 : acc;
        },
        0
      ) / stats.projects.length
    : 0;

  const tableColumns = [
    {
      title: 'Project',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (text) => (
        <span style={{ fontWeight: 700, fontSize: '13px' }}>
          {text}
        </span>
      )
    },
    {
      title: 'Conversations',
      dataIndex: 'conversations',
      key: 'conversations',
      align: 'center',
      width: 130,
      sorter: (a, b) => a.conversations - b.conversations,
      render: (val) => <span style={{ fontWeight: 700 }}>{val}</span>
    },
    {
      title: 'Tool Calls',
      dataIndex: 'toolCalls',
      key: 'toolCalls',
      align: 'center',
      width: 130,
      sorter: (a, b) => a.toolCalls - b.toolCalls,
      render: (val) => <span style={{ fontWeight: 700 }}>{formatNumber(val)}</span>
    },
    {
      title: 'Time Spent',
      dataIndex: 'totalTime',
      key: 'totalTime',
      align: 'center',
      width: 130,
      sorter: (a, b) => a.totalTime - b.totalTime,
      render: (val, record) => renderDuration(val, record.timeSource)
    },
    {
      title: 'Tokens (In/Out)',
      key: 'tokens',
      align: 'center',
      width: 180,
      render: (_, record) => (
        <div style={{ fontSize: '13px', color: INK, fontWeight: 700 }}>
          {formatNumber(record.tokens.input)} / {formatNumber(record.tokens.output)}
        </div>
      )
    },
    {
      title: 'Cache (Created/Read)',
      key: 'cache',
      align: 'center',
      width: 190,
      render: (_, record) => (
        <div style={{ fontSize: '13px', color: INK, fontWeight: 700 }}>
          {formatNumber(record.tokens.cacheCreation)} / {formatNumber(record.tokens.cacheRead)}
        </div>
      )
    },
    {
      title: 'Git Branches',
      key: 'branches',
      align: 'center',
      width: 150,
      render: (_, record) => {
        const branchCount = Object.keys(record.branches || {}).length;
        const topBranch = Object.entries(record.branches || {}).sort((a, b) => b[1] - a[1])[0];
        return (
          <div style={{ fontSize: '13px', color: INK, fontWeight: 700 }}>
            {branchCount > 0 ? (
              <div>
                <div>{topBranch[0]}</div>
                {branchCount > 1 && <div style={{ fontSize: '11px', color: '#999999' }}>+{branchCount - 1} more</div>}
              </div>
            ) : 'N/A'}
          </div>
        );
      }
    },
    {
      title: 'File Ops (E/R/W)',
      key: 'fileOps',
      align: 'center',
      width: 160,
      render: (_, record) => (
        <div style={{ fontSize: '13px', color: INK, fontWeight: 700 }}>
          {record.fileOperations?.edits || 0} / {record.fileOperations?.reads || 0} / {record.fileOperations?.writes || 0}
        </div>
      )
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
      align: 'center',
      width: 180,
      sorter: (a, b) => new Date(a.lastActivity) - new Date(b.lastActivity),
      render: (val) => val ? (
        <span style={{ fontSize: '13px', color: INK, fontWeight: 700 }}>
          {new Date(val).toLocaleDateString()}
        </span>
      ) : 'N/A'
    }
  ];

  return (
    <div className="min-h-screen bg-[#EEEEE8]">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="dashboard-header">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl mb-1">
                Claude Usage Dashboard
              </h1>
              <p className="text-sm" style={{ textTransform: 'none', letterSpacing: 0 }}>
                Analyze your Claude Code session statistics
              </p>
            </div>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchStats();
                fetchFilterOptions();
              }}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        <Tabs
          defaultActiveKey="overview"
          size="large"
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'overview',
              label: 'OVERVIEW',
              children: (
                <div>
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="filter-bar-label">
            <FilterOutlined style={{ color: INK }} />
            <span>FILTERS</span>
          </div>
          <div className="filter-bar-control">
            <span className="filter-bar-control-label">Project</span>
            <Select
              value={selectedProject}
              onChange={handleProjectChange}
              style={{ width: 280 }}
              options={[
                { value: 'all', label: 'All Projects' },
                ...filterOptions.projects.map(p => ({
                  value: p.name,
                  label: p.name,
                })),
              ]}
            />
          </div>
          <div className="filter-bar-control">
            <span className="filter-bar-control-label">Branch</span>
            <Select
              value={selectedBranch}
              onChange={handleBranchChange}
              disabled={selectedProject === 'all' || branchesForSelectedProject.length === 0}
              style={{ width: 220 }}
              options={[
                { value: 'all', label: 'All Branches' },
                ...branchesForSelectedProject.map(b => ({ value: b, label: b })),
              ]}
            />
          </div>
          {(selectedProject !== 'all' || selectedBranch !== 'all') && (
            <Button
              size="small"
              onClick={() => {
                setSelectedProject('all');
                setSelectedBranch('all');
                fetchStats('all', 'all');
              }}
            >
              Clear
            </Button>
          )}
          {loading && (
            <div className="filter-bar-loading">
              <Spin size="small" />
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card-gradient-blue">
              <Statistic
                title="Total Projects"
                value={stats.projects.length}
                prefix={<ProjectOutlined style={{ fontSize: '18px', color: INK }} />}
                valueStyle={{ color: INK }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card-gradient-purple">
              <Statistic
                title="Total Conversations"
                value={stats.totalConversations}
                prefix={<MessageOutlined style={{ fontSize: '18px', color: INK }} />}
                valueStyle={{ color: INK }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card-gradient-pink">
              <Statistic
                title="Total Tool Calls"
                value={stats.totalToolCalls}
                prefix={<ToolOutlined style={{ fontSize: '18px', color: INK }} />}
                valueStyle={{ color: INK }}
                formatter={(value) => formatNumber(value)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card-gradient-amber">
              <Statistic
                title={
                  <span>
                    Total Time Spent
                    {(stats.timeSource === 'estimated' || stats.timeSource === 'mixed') && (
                      <AntTooltip title={TIME_SOURCE_LABEL[stats.timeSource]}>
                        <Tag
                          style={{
                            marginLeft: 8,
                            fontFamily: MONO,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            background: 'transparent',
                            border: `1px solid ${INK}`,
                            color: INK,
                            borderRadius: 0,
                            cursor: 'help',
                          }}
                        >
                          {stats.timeSource === 'estimated' ? '~ EST' : '~ MIXED'}
                        </Tag>
                      </AntTooltip>
                    )}
                  </span>
                }
                value={
                  stats.timeSource === 'estimated' || stats.timeSource === 'mixed'
                    ? `~${formatDuration(stats.totalTime)}`
                    : formatDuration(stats.totalTime)
                }
                prefix={<ClockCircleOutlined style={{ fontSize: '18px', color: INK }} />}
                valueStyle={{ color: INK }}
              />
            </Card>
          </Col>
        </Row>

        {/* Insights Cards */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Avg Tool Calls per Conversation"
                value={avgToolCallsPerConversation}
                prefix={<RiseOutlined style={{ color: INK }} />}
                valueStyle={{ color: INK }}
                suffix="calls"
              />
              <Progress
                percent={Math.min((avgToolCallsPerConversation / 50) * 100, 100)}
                strokeColor={INK}
                trailColor={RULE}
                strokeLinecap="square"
                size={['default', 3]}
                showInfo={false}
                style={{ marginTop: 12 }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Total Tokens Processed"
                value={totalTokens}
                prefix={<ApiOutlined style={{ color: INK }} />}
                valueStyle={{ color: INK }}
                formatter={(value) => formatNumber(value)}
              />
              <Progress
                percent={100}
                strokeColor={INK}
                trailColor={RULE}
                strokeLinecap="square"
                size={['default', 3]}
                showInfo={false}
                style={{ marginTop: 12 }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Cache Hit Rate"
                value={cacheHitRate.toFixed(1)}
                prefix={<ThunderboltOutlined style={{ color: INK }} />}
                valueStyle={{ color: INK }}
                suffix="%"
              />
              <Progress
                percent={cacheHitRate}
                strokeColor={INK}
                trailColor={RULE}
                strokeLinecap="square"
                size={['default', 3]}
                showInfo={false}
                style={{ marginTop: 12 }}
              />
            </Card>
          </Col>
        </Row>

        {/* File Operations Stats */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Total File Edits"
                value={stats.fileEditStats?.totalEdits || 0}
                prefix={<EditOutlined style={{ color: INK }} />}
                valueStyle={{ color: INK }}
                formatter={(value) => formatNumber(value)}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Total File Reads"
                value={stats.fileEditStats?.totalReads || 0}
                prefix={<ReadOutlined style={{ color: INK }} />}
                valueStyle={{ color: INK }}
                formatter={(value) => formatNumber(value)}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Total File Writes"
                value={stats.fileEditStats?.totalWrites || 0}
                prefix={<FileTextOutlined style={{ color: INK }} />}
                valueStyle={{ color: INK }}
                formatter={(value) => formatNumber(value)}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts Row */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} lg={12}>
            <Card
              title={
                <span>
                  <ToolOutlined style={{ marginRight: 8, color: INK }} />
                  Top 10 Tools Used
                </span>
              }
              className="chart-card"
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={toolChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={axisTick}
                    stroke={INK}
                  />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F5F0' }} />
                  <Bar dataKey="count" fill={INK} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <span>
                  <ApiOutlined style={{ marginRight: 8, color: INK }} />
                  Model Usage Distribution
                </span>
              }
              className="chart-card"
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={modelChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    dataKey="value"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  >
                    {modelChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Activity Charts Row */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} lg={12}>
            <Card
              title={
                <span>
                  <BranchesOutlined style={{ marginRight: 8, color: INK }} />
                  Top Git Branches
                </span>
              }
              className="chart-card"
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={branchChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={axisTick}
                    stroke={INK}
                  />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F5F0' }} />
                  <Bar dataKey="count" fill={INK} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <span>
                  <ClockCircleOutlined style={{ marginRight: 8, color: INK }} />
                  Hourly Activity Pattern
                </span>
              }
              className="chart-card"
            >
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={hourlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} />
                  <XAxis dataKey="hour" interval={2} tick={axisTick} stroke={INK} />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="activity"
                    stroke={INK}
                    strokeWidth={2}
                    dot={{ fill: INK, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: INK }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Daily Activity & Entrypoint Charts */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} lg={12}>
            <Card
              title={
                <span>
                  <RiseOutlined style={{ marginRight: 8, color: INK }} />
                  Daily Activity (Last 30 Days)
                </span>
              }
              className="chart-card"
            >
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dailyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="0" stroke={RULE} />
                  <XAxis
                    dataKey="date"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={axisTick}
                    stroke={INK}
                  />
                  <YAxis tick={axisTick} stroke={INK} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="activity"
                    stroke={INK}
                    strokeWidth={2}
                    dot={{ fill: INK, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: INK }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <span>
                  <ApiOutlined style={{ marginRight: 8, color: INK }} />
                  Entrypoint Usage
                </span>
              }
              className="chart-card"
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={entrypointChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    dataKey="value"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  >
                    {entrypointChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Projects Table */}
        <Card
          title={
            <span style={{ fontSize: '13px' }}>
              <ProjectOutlined style={{ marginRight: 8, color: INK }} />
              Project Statistics
              <span className="brutal-pill" style={{ marginLeft: 12 }}>
                {stats.projects.length} Projects
              </span>
            </span>
          }
        >
          <Table
            columns={tableColumns}
            dataSource={stats.projects}
            rowKey={(record) => record.name}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} projects`
            }}
            scroll={{ x: 1200 }}
            size="middle"
          />
        </Card>
                </div>
              ),
            },
            {
              key: 'telemetry',
              label: 'TELEMETRY (OTEL)',
              children: <TelemetryView />,
            },
            {
              key: 'assistant',
              label: 'AI ASSISTANT',
              children: <AssistantChat />,
            },
            {
              key: 'history',
              label: 'CHAT HISTORY',
              children: <ChatHistory />,
            },
          ]}
        />

        {/* Footer */}
        <div className="dashboard-footer">
          <Divider style={{ borderColor: INK, borderWidth: '1px' }} />
          <p style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 8, color: '#999999' }} />
            Data sourced from ~/.claude/projects/ · Last updated: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
