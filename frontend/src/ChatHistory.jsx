import { useState, useEffect, useRef } from "react";
import {
  Input,
  Button,
  Card,
  Spin,
  Tag,
  List,
  Empty,
  Select,
  Space,
  Tooltip as AntTooltip,
} from "antd";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  RobotOutlined,
  UserOutlined,
  HistoryOutlined,
  SearchOutlined,
  ProjectOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  ToolOutlined,
  CodeOutlined,
  ApiOutlined,
} from "@ant-design/icons";

const API_URL = "http://localhost:3001";
const INK = "#1A1A1A";

function ChatHistory() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [showSidebar, setShowSidebar] = useState(true);
  const [expandedTools, setExpandedTools] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (conversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/history/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(session) {
    setSelectedSession(session);
    setLoadingConversation(true);
    setConversation(null);

    try {
      // Extract project dir from projectName
      const projectDir = session.projectName
        .replace(/^~\//, "Users-tirthp-")
        .replace(/\//g, "-");

      const res = await fetch(
        `${API_URL}/api/history/sessions/${projectDir}/${session.sessionId}`,
      );
      const data = await res.json();
      setConversation(data);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setLoadingConversation(false);
    }
  }

  function toggleToolDetails(msgIdx) {
    setExpandedTools((prev) => ({ ...prev, [msgIdx]: !prev[msgIdx] }));
  }

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      !searchTerm ||
      session.preview.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.projectName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProject =
      filterProject === "all" || session.projectName === filterProject;

    return matchesSearch && matchesProject;
  });

  // Get unique projects for filter
  const uniqueProjects = [
    ...new Set(sessions.map((s) => s.projectName)),
  ].sort();

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 200px)",
        minHeight: "600px",
      }}
    >
      {/* Sidebar */}
      {showSidebar && (
        <div
          style={{
            width: 320,
            borderRight: `1px solid ${INK}`,
            display: "flex",
            flexDirection: "column",
            background: "#FAFAF5",
          }}
        >
          <div style={{ padding: "16px", borderBottom: `1px solid #E0E0E0` }}>
            <h3
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <HistoryOutlined /> Chat History
            </h3>
            <Input
              placeholder="Search conversations..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                marginBottom: 8,
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
              }}
            />
            <Select
              value={filterProject}
              onChange={setFilterProject}
              style={{ width: "100%" }}
              size="small"
            >
              <Select.Option value="all">All Projects</Select.Option>
              {uniqueProjects.map((proj) => (
                <Select.Option key={proj} value={proj}>
                  {proj}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : filteredSessions.length === 0 ? (
              <Empty
                description="No conversations found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ marginTop: 60 }}
              />
            ) : (
              <List
                size="small"
                dataSource={filteredSessions}
                renderItem={(session) => (
                  <List.Item
                    style={{
                      cursor: "pointer",
                      padding: "12px",
                      background:
                        selectedSession?.sessionId === session.sessionId
                          ? "#E8E8E0"
                          : "transparent",
                      borderRadius: 4,
                      marginBottom: 4,
                      border: "1px solid transparent",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSession?.sessionId !== session.sessionId) {
                        e.currentTarget.style.border = "1px solid #E0E0E0";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.border = "1px solid transparent";
                    }}
                    onClick={() => loadConversation(session)}
                  >
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {session.preview}
                      </div>
                      <div
                        style={{ fontSize: 10, color: "#666", marginBottom: 4 }}
                      >
                        <ProjectOutlined style={{ marginRight: 4 }} />
                        {session.projectName}
                      </div>
                      <Space size={4} wrap>
                        <Tag style={{ fontSize: 10, margin: 0 }}>
                          <MessageOutlined style={{ fontSize: 9 }} />{" "}
                          {session.messageCount}
                        </Tag>
                        {session.gitBranch && (
                          <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                            <BranchesOutlined style={{ fontSize: 9 }} />{" "}
                            {session.gitBranch}
                          </Tag>
                        )}
                      </Space>
                      <div
                        style={{ fontSize: 10, color: "#999", marginTop: 4 }}
                      >
                        {new Date(session.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
      )}

      {/* Chat Display Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #E0E0E0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#FAFAF5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? "Hide" : "Show"} Sessions
            </Button>
            {selectedSession && (
              <div style={{ fontSize: 12, color: "#666" }}>
                <ProjectOutlined /> {selectedSession.projectName}
                {selectedSession.gitBranch && (
                  <span style={{ marginLeft: 8 }}>
                    <BranchesOutlined /> {selectedSession.gitBranch}
                  </span>
                )}
              </div>
            )}
          </div>
          {conversation && (
            <Space size={8}>
              <Tag icon={<MessageOutlined />}>
                {conversation.messageCount} messages
              </Tag>
              <Tag icon={<ClockCircleOutlined />}>
                {new Date(conversation.metadata.createdAt).toLocaleDateString()}
              </Tag>
            </Space>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {!selectedSession ? (
            <div style={{ textAlign: "center", paddingTop: 100 }}>
              <HistoryOutlined
                style={{ fontSize: 64, color: "#CCC", marginBottom: 16 }}
              />
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>
                Select a conversation to view
              </h3>
              <p style={{ color: "#888", fontSize: 13 }}>
                Browse through your Claude Code session history from the sidebar
              </p>
            </div>
          ) : loadingConversation ? (
            <div style={{ textAlign: "center", paddingTop: 100 }}>
              <Spin size="large" />
              <p style={{ marginTop: 16, color: "#888" }}>
                Loading conversation...
              </p>
            </div>
          ) : conversation ? (
            <>
              {conversation.conversation.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: 24,
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: msg.role === "user" ? INK : "#E8E8E0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {msg.role === "user" ? (
                      <UserOutlined style={{ color: "#FFF", fontSize: 16 }} />
                    ) : (
                      <RobotOutlined style={{ color: INK, fontSize: 16 }} />
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    style={{
                      maxWidth: "75%",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 18px",
                        background: msg.role === "user" ? INK : "#F5F5F0",
                        color: msg.role === "user" ? "#FFF" : INK,
                        borderRadius: 12,
                        fontSize: 13,
                        lineHeight: 1.6,
                        overflow: "hidden",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div className={`chat-markdown ${msg.role === "user" ? "chat-markdown-user" : ""}`}>
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                      </div>

                      {/* Tool Calls */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid #E0E0E0",
                          }}
                        >
                          <Button
                            size="small"
                            type="text"
                            icon={<ToolOutlined />}
                            onClick={() => toggleToolDetails(idx)}
                            style={{ fontSize: 11, color: "#666", padding: 0 }}
                          >
                            {expandedTools[idx] ? "Hide" : "Show"}{" "}
                            {msg.toolCalls.length} tool call(s)
                          </Button>
                          {expandedTools[idx] && (
                            <div style={{ marginTop: 8 }}>
                              {msg.toolCalls.map((tool, toolIdx) => (
                                <div
                                  key={toolIdx}
                                  style={{
                                    background: "#1A1A1A",
                                    color: "#00FF88",
                                    padding: 10,
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontFamily: "'Space Mono', monospace",
                                    marginBottom: 6,
                                  }}
                                >
                                  <div
                                    style={{ color: "#FFF", marginBottom: 4 }}
                                  >
                                    <ToolOutlined /> {tool.name}
                                  </div>
                                  <pre
                                    style={{
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      color: "#00FF88",
                                    }}
                                  >
                                    {JSON.stringify(tool.input, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: "#999",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent:
                          msg.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      {msg.timestamp && (
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                      {msg.model && (
                        <Tag style={{ fontSize: 9, margin: 0 }}>
                          <ApiOutlined style={{ fontSize: 8 }} />{" "}
                          {msg.model.replace("claude-", "")}
                        </Tag>
                      )}
                      {msg.usage && (
                        <AntTooltip
                          title={`Input: ${msg.usage.input_tokens} | Output: ${msg.usage.output_tokens}`}
                        >
                          <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>
                            {msg.usage.input_tokens + msg.usage.output_tokens}{" "}
                            tokens
                          </Tag>
                        </AntTooltip>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div style={{ textAlign: "center", paddingTop: 100 }}>
              <Empty description="Failed to load conversation" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatHistory;
