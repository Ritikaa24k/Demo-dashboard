import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, ResponsiveContainer } from "recharts";
import "./App.css";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];
const API = "http://127.0.0.1:8000";

const StatCard = ({ title, value, subtitle }) => (
  <div className="stat-card">
    <p className="stat-title">{title}</p>
    <h2 className="stat-value">{value}</h2>
    {subtitle && <p className="stat-subtitle">{subtitle}</p>}
  </div>
);

export default function App() {
  const [stats, setStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your Demo analyst powered by semantic search. Ask me anything about your users!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats);
    fetch(`${API}/anomalies`).then(r => r.json()).then(d => setAnomalies(d.anomalies));
  }, []);

  const askAI = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          history: messages
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    }
    setLoading(false);
  };

  if (!stats) return <div className="loading">Loading Demo Analytics...</div>;

  const userTypeData = [
    { name: "Power Users", value: stats.powerUsers },
    { name: "Active Users", value: stats.activeUsers },
    { name: "Casual Users", value: stats.casualUsers },
    { name: "Inactive Users", value: stats.inactiveUsers },
  ];

  return (
    <div className="container">
  <div className="header">
    <div className="header-left">
      <h1 className="title">Demo User Analytics</h1>
      <p className="subtitle">Real-time insights across 2,000 users</p>
    </div>
    <span className="header-badge">Live Dashboard</span>
  </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard title="Total Users" value={stats.total.toLocaleString()} />
        <StatCard title="Power Users" value={stats.powerUsers} subtitle="300+ Demos generated" />
        <StatCard title="Avg Demos / User" value={stats.avgDemos} />
        <StatCard title="Total Demos" value={stats.totalDemos.toLocaleString()} />
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="anomaly-card">
          <h3>🔍 AI Detected Anomalies</h3>
          {anomalies.map((a, i) => (
            <div key={i} className="anomaly-item">{a}</div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>User Segmentation</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={userTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {userTypeData.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>User Growth Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.monthlyGrowth}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card full-width">
          <h3>Demo Usage by Company</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.companyStats}>
              <XAxis dataKey="company" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalDemos" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Chat */}
      <div className="chat-card">
        <h3>Ask Your AI Analyst</h3>
        <p className="chat-subtitle">Powered by semantic search + GPT-4o</p>
        <div className="suggested-questions">
          {["Who are our power users?", "Which company uses Demo most?", "Which users are at churn risk?"].map(q => (
            <button key={q} className="suggestion-btn" onClick={() => setInput(q)}>{q}</button>
          ))}
        </div>
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <span>{m.content}</span>
            </div>
          ))}
          {loading && <div className="message assistant"><span>Thinking...</span></div>}
        </div>
        <div className="chat-input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && askAI()}
            placeholder="Ask anything about your users..."
          />
          <button onClick={askAI}>Send</button>
        </div>
      </div>
    </div>
  );
}