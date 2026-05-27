import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Spin,
  Alert,
  Row,
  Col,
  Statistic,
  Tag,
  Empty,
  Modal,
  Input,
  Tooltip as AntTooltip,
  Divider,
} from 'antd';
import {
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RiseOutlined,
  FileTextOutlined,
  SettingOutlined,
  ProjectOutlined,
  AlertOutlined,
  DownOutlined,
  RightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const API_URL = 'http://localhost:3001';

const MONO = "'Space Mono', 'Courier New', monospace";
const INK = '#1A1A1A';
const INK_SOFT = '#555555';
const MUTED = '#777777';
const RULE = '#E0E0E0';
const SUCCESS = '#276749';
const ERROR = '#C53030';
const WARNING = '#F5A623';
const SURFACE = '#FFFFFF';
const HOVER = '#F5F5F0';

const PRIORITY_META = {
  urgent: { label: 'URGENT', color: ERROR, bg: '#FFF5F5' },
  high: { label: 'HIGH', color: WARNING, bg: '#FFFBEB' },
  medium: { label: 'MEDIUM', color: INK_SOFT, bg: '#F5F5F0' },
  low: { label: 'LOW', color: MUTED, bg: '#FAFAF7' },
};

const SEVERITY_META = {
  critical: { label: 'CRITICAL', color: ERROR },
  high: { label: 'HIGH', color: WARNING },
  medium: { label: 'MEDIUM', color: INK_SOFT },
  low: { label: 'LOW', color: MUTED },
};

const CATEGORY_ICONS = {
  documentation: <FileTextOutlined />,
  permissions: <SettingOutlined />,
  optimization: <ThunderboltOutlined />,
  tooling: <SettingOutlined />,
};

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.low;
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        background: meta.bg,
        border: `1px solid ${meta.color}`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

function CategoryTag({ category }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        background: '#F0F0EA',
        border: `1px solid ${INK}`,
        color: INK,
      }}
    >
      {CATEGORY_ICONS[category]}
      {category}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.low;
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '1px 6px',
        border: `1px solid ${meta.color}`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

function PatternDetailBody({ detail, onSelectProject }) {
  const projects = detail.affected_projects || [];
  const rec = detail.sample_recommendation;

  return (
    <div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: INK,
          marginBottom: 8,
        }}
      >
        Affected Projects
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {projects.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>None active.</div>
        ) : (
          projects.map((proj) => (
            <div
              key={proj.project_path}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '6px 10px',
                background: SURFACE,
                border: `1px solid ${RULE}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 700,
                    color: INK,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {proj.project_name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 2 }}>
                  {proj.frequency} occurrence{proj.frequency === 1 ? '' : 's'}
                  {proj.pending_recs > 0
                    ? ` · ${proj.pending_recs} pending rec${proj.pending_recs === 1 ? '' : 's'}`
                    : ''}
                </div>
              </div>
              {onSelectProject && (
                <Button
                  size="small"
                  onClick={() => onSelectProject(proj.project_path)}
                >
                  View →
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: INK,
          marginBottom: 8,
        }}
      >
        Top Recommendation
      </div>
      {!rec ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>
          No pending recommendations for this pattern type.
        </div>
      ) : (
        <div
          style={{
            padding: 12,
            background: SURFACE,
            border: `1px solid ${INK}`,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <PriorityBadge priority={rec.priority} />
            <CategoryTag category={rec.category} />
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              color: INK,
              marginBottom: 4,
            }}
          >
            {rec.title}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>
            {rec.description}
          </div>
          {rec.impact_estimate && (
            <div
              style={{
                marginTop: 8,
                fontFamily: MONO,
                fontSize: 11,
                color: SUCCESS,
                fontWeight: 700,
              }}
            >
              <RiseOutlined style={{ marginRight: 6 }} />
              {rec.impact_estimate}
            </div>
          )}
          {Array.isArray(rec.action_items) && rec.action_items.length > 0 && (
            <ol
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: INK_SOFT,
                margin: '10px 0 0 18px',
                padding: 0,
                lineHeight: 1.6,
              }}
            >
              {rec.action_items.slice(0, 3).map((item, idx) => (
                <li key={idx}>{item.action}</li>
              ))}
            </ol>
          )}
          {onSelectProject && rec.project_path && (
            <Button
              size="small"
              type="primary"
              style={{ marginTop: 12 }}
              onClick={() => onSelectProject(rec.project_path)}
            >
              View in {rec.project_path.split('/').pop()} →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Recommendations({ projectPath, onSelectProject }) {
  const [recommendations, setRecommendations] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);
  const [dismissModal, setDismissModal] = useState({ open: false, id: null, reason: '' });
  const [expandedPatternType, setExpandedPatternType] = useState(null);
  const [patternDetails, setPatternDetails] = useState({}); // { [patternType]: { loading, data, error } }

  const isAllProjects = !projectPath || projectPath === 'all';

  useEffect(() => {
    if (isAllProjects) {
      loadDashboard();
    } else {
      loadProjectData();
    }
  }, [projectPath]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/analytics/dashboard`);
      if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`);
      const data = await res.json();
      setDashboardData(data);
      setRecommendations([]);
      setPatterns([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Send via query param to avoid path-segment encoding issues with
      // forward slashes in absolute project paths.
      const qs = new URLSearchParams({ projectPath, status: 'pending' }).toString();
      const [recRes, patRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/recommendations?${qs}`),
        fetch(`${API_URL}/api/analytics/patterns?${qs}`),
      ]);
      if (!recRes.ok) throw new Error(`Failed to load recommendations (${recRes.status})`);
      const recData = await recRes.json();
      const patData = patRes.ok ? await patRes.json() : { patterns: [] };
      setRecommendations(recData.recommendations || []);
      setPatterns(patData.patterns || []);
      setDashboardData(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      const body = isAllProjects ? { daysBack: 30 } : { projectPath, daysBack: 30 };
      const res = await fetch(`${API_URL}/api/analytics/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
      if (isAllProjects) {
        await loadDashboard();
      } else {
        await loadProjectData();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyRecommendation = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/analytics/recommendations/${id}/apply`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Apply failed');
      await loadProjectData();
    } catch (err) {
      setError(err.message);
    }
  };

  const openDismissModal = (id) => setDismissModal({ open: true, id, reason: '' });
  const closeDismissModal = () => setDismissModal({ open: false, id: null, reason: '' });

  const submitDismiss = async () => {
    const { id, reason } = dismissModal;
    if (!reason.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/analytics/recommendations/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Dismiss failed');
      closeDismissModal();
      await loadProjectData();
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePatternType = async (patternType) => {
    if (expandedPatternType === patternType) {
      setExpandedPatternType(null);
      return;
    }
    setExpandedPatternType(patternType);
    if (patternDetails[patternType]?.data) return; // cached
    setPatternDetails((prev) => ({
      ...prev,
      [patternType]: { loading: true, data: null, error: null },
    }));
    try {
      const res = await fetch(
        `${API_URL}/api/analytics/pattern-types/${encodeURIComponent(patternType)}`
      );
      if (!res.ok) throw new Error(`Failed to load pattern details (${res.status})`);
      const data = await res.json();
      setPatternDetails((prev) => ({
        ...prev,
        [patternType]: { loading: false, data, error: null },
      }));
    } catch (err) {
      setPatternDetails((prev) => ({
        ...prev,
        [patternType]: { loading: false, data: null, error: err.message },
      }));
    }
  };

  const filteredRecommendations =
    filter === 'all'
      ? recommendations
      : recommendations.filter((r) => r.priority === filter || r.category === filter);

  const counts = {
    all: recommendations.length,
    urgent: recommendations.filter((r) => r.priority === 'urgent').length,
    high: recommendations.filter((r) => r.priority === 'high').length,
    documentation: recommendations.filter((r) => r.category === 'documentation').length,
    optimization: recommendations.filter((r) => r.category === 'optimization').length,
  };

  // ============================================================
  // Render: Loading
  // ============================================================
  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Spin size="large" />
        <p
          style={{
            marginTop: 16,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: INK,
          }}
        >
          Loading recommendations...
        </p>
      </div>
    );
  }

  // ============================================================
  // Render: All-projects dashboard
  // ============================================================
  if (isAllProjects) {
    const stats = dashboardData?.stats || {};
    const topPatterns = dashboardData?.top_patterns || [];
    const urgentProjects = dashboardData?.urgent_projects || [];

    return (
      <div>
        {error && (
          <Alert
            type="error"
            message={error}
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: INK,
                margin: 0,
              }}
            >
              AI Recommendations
            </h2>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: INK_SOFT,
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Patterns and recommendations across all projects
            </p>
          </div>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={runAnalysis}
            loading={analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Analyze All'}
          </Button>
        </div>

        {/* Stats Grid */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Active Patterns"
                value={stats.active_patterns || 0}
                prefix={<AlertOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Pending"
                value={stats.pending_recommendations || 0}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Affected Projects"
                value={stats.affected_projects || 0}
                prefix={<ProjectOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Applied"
                value={stats.applied_recommendations || 0}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Empty state */}
        {(stats.active_patterns || 0) === 0 && (
          <Card>
            <Empty
              description={
                <span style={{ fontFamily: MONO, fontSize: 12 }}>
                  No patterns detected yet. Click <strong>Analyze All</strong> to scan your
                  telemetry data and generate recommendations.
                </span>
              }
            />
          </Card>
        )}

        {/* Urgent projects */}
        {urgentProjects.length > 0 && (
          <Card title="Projects Needing Attention" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {urgentProjects.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    border: `1px solid ${RULE}`,
                    background: SURFACE,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontWeight: 700,
                        fontSize: 13,
                        color: INK,
                      }}
                    >
                      {p.project_name}
                    </div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        color: MUTED,
                        marginTop: 2,
                      }}
                    >
                      {p.recommendation_count} recommendation
                      {p.recommendation_count === 1 ? '' : 's'}
                      {p.has_urgent ? ' · has urgent items' : ''}
                    </div>
                  </div>
                  {p.has_urgent ? <PriorityBadge priority="urgent" /> : <PriorityBadge priority="medium" />}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Top patterns */}
        {topPatterns.length > 0 && (
          <Card title="Most Common Patterns">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topPatterns.map((p, idx) => {
                const isOpen = expandedPatternType === p.pattern_type;
                const detail = patternDetails[p.pattern_type];
                return (
                  <div
                    key={idx}
                    style={{
                      border: `1px solid ${isOpen ? INK : RULE}`,
                      background: SURFACE,
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => togglePatternType(p.pattern_type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          togglePatternType(p.pattern_type);
                        }
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        background: isOpen ? HOVER : SURFACE,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ color: INK, fontSize: 11 }}>
                          {isOpen ? <DownOutlined /> : <RightOutlined />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: MONO,
                              fontWeight: 700,
                              fontSize: 13,
                              color: INK,
                              textTransform: 'capitalize',
                            }}
                          >
                            {(p.pattern_type || '').replace(/_/g, ' ')}
                          </div>
                          <div
                            style={{
                              fontFamily: MONO,
                              fontSize: 11,
                              color: MUTED,
                              marginTop: 2,
                            }}
                          >
                            {p.project_count} project{p.project_count === 1 ? '' : 's'} ·{' '}
                            {p.total_occurrences} occurrence{p.total_occurrences === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 12,
                          fontWeight: 700,
                          color: INK,
                          flex: '0 0 auto',
                          marginLeft: 12,
                        }}
                      >
                        {p.total_occurrences}×
                      </span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: 14, borderTop: `1px solid ${INK}`, background: '#FAFAF7' }}>
                        {detail?.loading && (
                          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>
                            Loading details...
                          </div>
                        )}
                        {detail?.error && (
                          <Alert type="error" message={detail.error} showIcon />
                        )}
                        {detail?.data && (
                          <PatternDetailBody
                            detail={detail.data}
                            onSelectProject={onSelectProject}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ============================================================
  // Render: Per-project recommendations
  // ============================================================
  return (
    <div>
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: INK,
              margin: 0,
            }}
          >
            AI Recommendations
          </h2>
          <p
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: INK_SOFT,
              marginTop: 4,
              marginBottom: 0,
              wordBreak: 'break-all',
            }}
          >
            <ProjectOutlined style={{ marginRight: 6 }} />
            {projectPath}
          </p>
        </div>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={runAnalysis}
          loading={analyzing}
        >
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={8}>
          <Card>
            <Statistic
              title="Pending"
              value={recommendations.filter((r) => r.status === 'pending').length}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic
              title="Active Patterns"
              value={patterns.length}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic
              title="Applied"
              value={recommendations.filter((r) => r.status === 'applied').length}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: INK,
            marginRight: 4,
          }}
        >
          Filter:
        </span>
        {[
          { key: 'all', label: `ALL (${counts.all})` },
          { key: 'urgent', label: `URGENT (${counts.urgent})` },
          { key: 'high', label: `HIGH (${counts.high})` },
          { key: 'documentation', label: `DOCS (${counts.documentation})` },
          { key: 'optimization', label: `OPTIMIZE (${counts.optimization})` },
        ].map((f) => (
          <Button
            key={f.key}
            size="small"
            type={filter === f.key ? 'primary' : 'default'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Recommendations list */}
      {filteredRecommendations.length === 0 ? (
        <Card>
          <Empty
            image={<CheckCircleOutlined style={{ fontSize: 48, color: SUCCESS }} />}
            imageStyle={{ height: 60 }}
            description={
              <div style={{ fontFamily: MONO, fontSize: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 4 }}>
                  {recommendations.length === 0 ? 'No Recommendations' : 'Nothing in this filter'}
                </div>
                <div style={{ color: MUTED }}>
                  {recommendations.length === 0
                    ? 'Click "Run Analysis" to scan for patterns and generate recommendations.'
                    : 'All recommendations in this category have been addressed.'}
                </div>
              </div>
            }
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredRecommendations.map((rec) => {
            const isExpanded = expandedId === rec.id;
            const actionItems = Array.isArray(rec.action_items) ? rec.action_items : [];

            return (
              <Card
                key={rec.id}
                bodyStyle={{ padding: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {/* Header — clickable to expand */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : rec.id);
                    }
                  }}
                  style={{
                    padding: 16,
                    cursor: 'pointer',
                    background: isExpanded ? HOVER : SURFACE,
                    transition: 'background 80ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <PriorityBadge priority={rec.priority} />
                        <CategoryTag category={rec.category} />
                        {rec.confidence_score != null && (
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 10,
                              color: MUTED,
                            }}
                          >
                            {Math.round(rec.confidence_score * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 14,
                          fontWeight: 700,
                          color: INK,
                          marginBottom: 4,
                        }}
                      >
                        {rec.title}
                      </div>
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 12,
                          color: INK_SOFT,
                          lineHeight: 1.5,
                        }}
                      >
                        {rec.description}
                      </div>
                      {rec.impact_estimate && (
                        <div
                          style={{
                            marginTop: 8,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: MONO,
                            fontSize: 11,
                            color: SUCCESS,
                            fontWeight: 700,
                          }}
                        >
                          <RiseOutlined />
                          {rec.impact_estimate}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: INK,
                        fontSize: 12,
                      }}
                    >
                      {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    </div>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div
                    style={{
                      padding: 16,
                      borderTop: `1px solid ${INK}`,
                      background: '#FAFAF7',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: INK,
                        marginBottom: 12,
                      }}
                    >
                      Action Items
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                      {actionItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 12 }}>
                          <div
                            style={{
                              flex: '0 0 auto',
                              width: 24,
                              height: 24,
                              border: `1px solid ${INK}`,
                              background: SURFACE,
                              fontFamily: MONO,
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: INK,
                            }}
                          >
                            {item.step}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: MONO,
                                fontSize: 12,
                                fontWeight: 700,
                                color: INK,
                                marginBottom: 2,
                              }}
                            >
                              {item.action}
                            </div>
                            <pre
                              style={{
                                fontFamily: MONO,
                                fontSize: 11,
                                color: INK_SOFT,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                margin: 0,
                                padding: 0,
                                background: 'transparent',
                                border: 'none',
                                lineHeight: 1.5,
                              }}
                            >
                              {item.details}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Divider style={{ margin: '12px 0', borderColor: RULE }} />

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyRecommendation(rec.id);
                        }}
                      >
                        Mark as Applied
                      </Button>
                      <Button
                        icon={<CloseCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDismissModal(rec.id);
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dismiss modal */}
      <Modal
        title="Dismiss Recommendation"
        open={dismissModal.open}
        onOk={submitDismiss}
        onCancel={closeDismissModal}
        okText="Dismiss"
        okButtonProps={{ disabled: !dismissModal.reason.trim() }}
      >
        <p style={{ fontFamily: MONO, fontSize: 12, color: INK_SOFT }}>
          Why are you dismissing this recommendation? This will help improve future suggestions.
        </p>
        <Input.TextArea
          value={dismissModal.reason}
          onChange={(e) => setDismissModal({ ...dismissModal, reason: e.target.value })}
          placeholder="e.g., Not applicable for this project type"
          rows={3}
          style={{ fontFamily: MONO, fontSize: 12 }}
        />
      </Modal>
    </div>
  );
}
