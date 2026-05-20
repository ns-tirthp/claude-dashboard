import { useState, useEffect, useRef } from 'react';
import { Input, Button, Card, Table, Spin, Tag, List, Popconfirm, Empty } from 'antd';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  DeleteOutlined,
  PlusOutlined,
  HistoryOutlined,
  CodeOutlined,
  TableOutlined,
} from '@ant-design/icons';

const API_URL = 'http://localhost:3001';
const INK = '#1A1A1A';

function AssistantChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [expandedSql, setExpandedSql] = useState({});
  const [expandedData, setExpandedData] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchSessions() {
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }

  async function loadSession(id) {
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions/${id}`);
      const data = await res.json();
      setSessionId(id);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  async function deleteSessionHandler(id) {
    try {
      await fetch(`${API_URL}/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (sessionId === id) {
        setSessionId(null);
        setMessages([]);
      }
      fetchSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }

  function startNewSession() {
    setSessionId(null);
    setMessages([]);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, created_at: Date.now() }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });

      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.error && !data.summary) {
        setMessages(prev => [...prev, {
          role: 'error',
          content: data.error,
          created_at: Date.now(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.summary,
          sql_query: data.sql,
          result_data: data.data,
          source: data.source,
          created_at: Date.now(),
        }]);
      }

      fetchSessions();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Network error: ${err.message}`,
        created_at: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function toggleSql(idx) {
    setExpandedSql(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function toggleData(idx) {
    setExpandedData(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  const suggestedQueries = [
    'How much have I spent on API calls today?',
    'What are the most used tools?',
    'Show me errors from the last 24 hours',
    'Average response time by model',
    'How many tokens have I used this week?',
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: '600px' }}>
      {/* Sidebar */}
      {showSidebar && (
        <div style={{
          width: 280,
          borderRight: `1px solid ${INK}`,
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAF5',
        }}>
          <div style={{ padding: '16px', borderBottom: `1px solid #E0E0E0` }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={startNewSession}
              block
            >
              New Conversation
            </Button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            <List
              size="small"
              dataSource={sessions}
              locale={{ emptyText: <Empty description="No conversations yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              renderItem={session => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    background: sessionId === session.id ? '#E8E8E0' : 'transparent',
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                  onClick={() => loadSession(session.id)}
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="Delete this conversation?"
                      onConfirm={(e) => { e.stopPropagation(); deleteSessionHandler(session.id); }}
                      okText="Yes"
                      cancelText="No"
                    >
                      <DeleteOutlined
                        style={{ color: '#999' }}
                        onClick={e => e.stopPropagation()}
                      />
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 12, fontWeight: 600 }}>{session.title}</span>}
                    description={
                      <span style={{ fontSize: 11, color: '#888' }}>
                        {new Date(session.updated_at).toLocaleDateString()}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toggle sidebar */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? 'Hide' : 'Show'} History
          </Button>
          <span style={{ fontSize: 12, color: '#888', fontFamily: "'Space Mono', monospace" }}>
            {sessionId ? `Session active` : 'New conversation'}
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <RobotOutlined style={{ fontSize: 48, color: '#CCC', marginBottom: 16 }} />
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Ask me anything about your Claude usage</h3>
              <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
                I can query your telemetry data and give you insights in natural language.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                {suggestedQueries.map((q, i) => (
                  <Tag
                    key={i}
                    style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 12 }}
                    onClick={() => { setInput(q); }}
                  >
                    {q}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 20,
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: msg.role === 'user' ? INK : (msg.role === 'error' ? '#FF4D4F' : '#E8E8E0'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {msg.role === 'user'
                  ? <UserOutlined style={{ color: '#FFF', fontSize: 14 }} />
                  : <RobotOutlined style={{ color: msg.role === 'error' ? '#FFF' : INK, fontSize: 14 }} />
                }
              </div>

              <div style={{
                maxWidth: '75%',
                minWidth: 0,
                padding: '12px 16px',
                background: msg.role === 'user' ? INK : (msg.role === 'error' ? '#FFF0F0' : '#F5F5F0'),
                color: msg.role === 'user' ? '#FFF' : INK,
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                border: msg.role === 'error' ? '1px solid #FF4D4F' : 'none',
                overflow: 'hidden',
              }}>
                <div className={`chat-markdown ${msg.role === 'user' ? 'chat-markdown-user' : ''}`}>
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                </div>

                {msg.sql_query && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      type="text"
                      icon={<CodeOutlined />}
                      onClick={() => toggleSql(idx)}
                      style={{ fontSize: 11, color: '#666' }}
                    >
                      {expandedSql[idx] ? 'Hide SQL' : 'Show SQL'}
                    </Button>
                    {expandedSql[idx] && (
                      <pre style={{
                        background: '#1A1A1A',
                        color: '#00FF88',
                        padding: 12,
                        borderRadius: 4,
                        fontSize: 11,
                        overflowX: 'auto',
                        marginTop: 8,
                        fontFamily: "'Space Mono', monospace",
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {msg.sql_query}
                      </pre>
                    )}
                  </div>
                )}

                {msg.result_data && msg.result_data.rows && msg.result_data.rows.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      type="text"
                      icon={<TableOutlined />}
                      onClick={() => toggleData(idx)}
                      style={{ fontSize: 11, color: '#666' }}
                    >
                      {expandedData[idx] ? 'Hide Data' : `Show Data (${msg.result_data.rowCount} rows)`}
                    </Button>
                    {expandedData[idx] && (
                      <div style={{ marginTop: 8, maxHeight: 300, overflow: 'auto', maxWidth: '100%' }}>
                        <Table
                          size="small"
                          dataSource={msg.result_data.rows.map((row, i) => ({ ...row, _key: i }))}
                          columns={msg.result_data.columns.map(col => ({
                            title: col,
                            dataIndex: col,
                            key: col,
                            ellipsis: true,
                            width: 150,
                          }))}
                          rowKey="_key"
                          pagination={{ pageSize: 10, size: 'small' }}
                          scroll={{ x: 'max-content' }}
                          bordered
                        />
                      </div>
                    )}
                  </div>
                )}

                {msg.source && (
                  <Tag
                    style={{ marginTop: 8, fontSize: 10 }}
                    color={msg.source === 'sqlite' ? 'blue' : 'green'}
                  >
                    {msg.source === 'sqlite' ? 'Telemetry DB' : 'JSONL Stats'}
                  </Tag>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#E8E8E0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RobotOutlined style={{ color: INK, fontSize: 14 }} />
              </div>
              <div style={{ padding: '12px 16px', background: '#F5F5F0', borderRadius: 8 }}>
                <Spin size="small" /> <span style={{ fontSize: 12, marginLeft: 8, color: '#888' }}>Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E0E0E0',
          background: '#FAFAF5',
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Input.TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about your Claude usage stats..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={sendMessage}
              loading={loading}
              style={{ height: 'auto', minHeight: 40 }}
            >
              Send
            </Button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssistantChat;
