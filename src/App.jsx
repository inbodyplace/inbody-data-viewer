import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const METRICS = [
  { key: "WT",  label: "Weight",          unit: "kg", color: "#3b82f6" },
  { key: "SMM", label: "Skeletal Muscle", unit: "kg", color: "#22c55e" },
  { key: "BFM", label: "Body Fat Mass",   unit: "kg", color: "#f59e0b" },
  { key: "PBF", label: "Body Fat %",      unit: "%",  color: "#ef4444" },
  { key: "BMI", label: "BMI",             unit: "",   color: "#a855f7" },
];

const STATUS_COLOR = {
  success: "#22c55e", pending: "#f59e0b", error: "#ef4444",
  skipped_temp: "#64748b", skipped_no_config: "#64748b",
};

function parseDate(dt) {
  if (!dt || dt.length < 8) return dt;
  return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
}

function parseRecord(row) {
  return { ...row, date: parseDate(row.test_at) };
}

export default function App() {
  const [stats, setStats]                   = useState(null);
  const [events, setEvents]                 = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [measurements, setMeasurements]     = useState([]);
  const [activeMetrics, setActiveMetrics]   = useState(["WT", "SMM", "BFM"]);
  const [loadingChart, setLoadingChart]     = useState(false);
  const [simulating, setSimulating]         = useState(false);

  const simulateEvent = async () => {
    setSimulating(true);
    try { await axios.post("/api/test-webhook", {}); }
    catch { /* silent */ }
    finally { setSimulating(false); }
  };

  // ── Auto-refresh every 5s ──────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        axios.get("/api/stats"),
        axios.get("/api/events?limit=50"),
      ]);
      setStats(s.data);
      setEvents(e.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(loadDashboard, 5000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  // ── Fetch member history when selected ─────────────────────────────────────
  useEffect(() => {
    if (!selectedUserId) return;
    setLoadingChart(true);
    axios
      .get(`/api/members/${encodeURIComponent(selectedUserId)}/history`)
      .then((res) => setMeasurements(res.data.map(parseRecord).reverse()))
      .catch(() => setMeasurements([]))
      .finally(() => setLoadingChart(false));
  }, [selectedUserId, events]); // re-fetch whenever events update

  const toggleMetric = (key) =>
    setActiveMetrics((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key],
    );

  const chartData = {
    labels: measurements.map((m) => m.date),
    datasets: METRICS.filter((m) => activeMetrics.includes(m.key)).map((m) => ({
      label: `${m.label}${m.unit ? ` (${m.unit})` : ""}`,
      data: measurements.map((r) => (r[m.key] != null ? Number(r[m.key]) : null)),
      borderColor: m.color, backgroundColor: m.color + "22",
      borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
      tension: 0.35, fill: false, spanGaps: true,
    })),
  };

  const chartOptions = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { color: "#94a3b8", boxWidth: 12, padding: 16, font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: "#64748b", maxRotation: 45, font: { size: 11 } }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "#1e293b" } },
    },
  };

  const latest = measurements.length ? measurements[measurements.length - 1] : null;

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>⚖️ InBody Data Viewer</div>
        <div style={s.headerStats}>
          {stats && (
            <>
              <Chip label="Today" value={stats.todayMeasurements} />
              <Chip label="Members" value={stats.totalMembers} />
              <Chip label="This week" value={stats.weekMeasurements} />
              <span style={{ fontSize: 11, color: stats.apiConfigured ? "#22c55e" : "#ef4444" }}>
                {stats.apiConfigured ? "● API Connected" : "● API Not Configured"}
              </span>
            </>
          )}
          <button style={s.btnSim} onClick={simulateEvent} disabled={simulating}>
            {simulating ? "…" : "⚡ Simulate Event"}
          </button>
        </div>
      </header>

      <div style={s.body}>
        {/* Left panel */}
        <div style={s.panel}>
          {selectedUserId ? (
            <>
              <div style={s.sectionTitle}>Selected Member</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6", marginBottom: 16 }}>{selectedUserId}</div>

              <div style={s.sectionTitle}>Metrics</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {METRICS.map((m) => (
                  <label key={m.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={activeMetrics.includes(m.key)} onChange={() => toggleMetric(m.key)} style={{ accentColor: m.color }} />
                    <span style={{ color: activeMetrics.includes(m.key) ? "#f1f5f9" : "#64748b" }}>
                      {m.label}{m.unit ? ` (${m.unit})` : ""}
                    </span>
                  </label>
                ))}
              </div>

              {latest && (
                <>
                  <div style={{ ...s.sectionTitle, marginTop: 24 }}>Latest Snapshot</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>{latest.date}</div>
                  <div style={s.snapshotGrid}>
                    {METRICS.map((m) =>
                      latest[m.key] != null && (
                        <div key={m.key} style={s.snapshotCard}>
                          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{m.label}</div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: m.color }}>
                            {latest[m.key]}
                            <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>{m.unit ? ` ${m.unit}` : ""}</span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </>
              )}

              <button style={{ ...s.btnSecondary, marginTop: 24, width: "100%" }} onClick={() => setSelectedUserId(null)}>
                ← Back to list
              </button>
            </>
          ) : (
            <>
              <div style={s.sectionTitle}>How to use</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.8 }}>
                When a measurement is taken on an InBody device, a webhook is automatically received.<br /><br />
                Click any row in the events table to view that member's body composition chart.<br /><br />
                <span style={{ color: "#475569" }}>Webhook endpoint:</span><br />
                <code style={{ color: "#3b82f6", wordBreak: "break-all" }}>POST /webhook</code>
              </div>
            </>
          )}
        </div>

        {/* Main */}
        <div style={s.main}>
          {/* Events table */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={s.cardTitle}>Webhook Events</div>
              <span style={{ fontSize: 11, color: "#475569" }}>Auto-refresh every 5s</span>
            </div>
            {events.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, padding: "32px 0", textAlign: "center" }}>
                No webhook events received yet.<br />
                <span style={{ fontSize: 11 }}>Events will appear here once a measurement is taken on an InBody device.</span>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>ID</th>
                      <th style={s.th}>User ID</th>
                      <th style={s.th}>Test Date</th>
                      <th style={s.th}>Device</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}>Received At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, i) => (
                      <tr
                        key={ev.id}
                        style={{
                          background: selectedUserId === ev.user_id
                            ? "rgba(59,130,246,0.12)"
                            : i % 2 === 0 ? "transparent" : "#0f172a",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedUserId(ev.user_id)}
                        title="Click to view body composition chart"
                      >
                        <td style={{ ...s.td, color: "#475569" }}>{ev.id}</td>
                        <td style={{ ...s.td, color: "#3b82f6", fontWeight: 600 }}>{ev.user_id}</td>
                        <td style={s.td}>{parseDate(ev.test_at)}</td>
                        <td style={{ ...s.td, color: "#64748b" }}>{ev.equip || "—"}</td>
                        <td style={{ ...s.td, color: STATUS_COLOR[ev.fetch_status] || "#64748b", fontSize: 11 }}>
                          {ev.fetch_status}
                        </td>
                        <td style={{ ...s.td, color: "#475569", fontSize: 11 }}>
                          {ev.received_at ? new Date(ev.received_at).toLocaleString("en-US") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Member chart */}
          {selectedUserId && (
            <div style={s.card}>
              <div style={{ ...s.cardTitle, marginBottom: 16 }}>Body Composition Trend — {selectedUserId}</div>
              {loadingChart ? (
                <div style={s.loadingBox}><div style={s.spinner} />Loading…</div>
              ) : measurements.length === 0 ? (
                <div style={{ color: "#475569", fontSize: 13, padding: "32px 0", textAlign: "center" }}>
                  No measurement data stored yet.<br />
                  <span style={{ fontSize: 11 }}>Data will appear once the InBody API fetch completes (fetch_status: success).</span>
                </div>
              ) : (
                <>
                  <Line data={chartData} options={chartOptions} />
                  <div style={{ marginTop: 24 }}>
                    <div style={{ ...s.cardTitle, marginBottom: 12 }}>Measurement History ({measurements.length})</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            <th style={s.th}>Date</th>
                            {METRICS.map((m) => <th key={m.key} style={s.th}>{m.label}{m.unit ? ` (${m.unit})` : ""}</th>)}
                            <th style={s.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...measurements].reverse().map((r, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#0f172a" }}>
                              <td style={s.td}>{r.date}</td>
                              {METRICS.map((m) => (
                                <td key={m.key} style={{ ...s.td, color: m.color }}>
                                  {r[m.key] != null ? r[m.key] : "—"}
                                </td>
                              ))}
                              <td style={{ ...s.td, color: STATUS_COLOR[r.fetch_status] || "#64748b", fontSize: 11 }}>
                                {r.fetch_status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <span style={{ fontSize: 12, color: "#94a3b8" }}>
      {label}: <b style={{ color: "#f1f5f9" }}>{value}</b>
    </span>
  );
}

const s = {
  root: { background: "#0f172a", color: "#f1f5f9", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 14 },
  header: { background: "#1e293b", borderBottom: "1px solid #2a3347", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  logo: { fontWeight: 700, fontSize: 15 },
  headerStats: { display: "flex", gap: 20, alignItems: "center" },
  body: { display: "flex", height: "calc(100vh - 56px)" },
  panel: { width: 240, background: "#1e293b", borderRight: "1px solid #2a3347", padding: "20px 16px", overflowY: "auto", flexShrink: 0 },
  sectionTitle: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 10 },
  snapshotGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  snapshotCard: { background: "#0f172a", border: "1px solid #2a3347", borderRadius: 8, padding: 10 },
  btnSecondary: { background: "transparent", border: "1px solid #2a3347", borderRadius: 6, color: "#94a3b8", padding: "7px 14px", fontSize: 13, cursor: "pointer" },
  btnSim: { background: "#1e3a5f", border: "1px solid #3b82f6", borderRadius: 6, color: "#93c5fd", padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  main: { flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 },
  card: { background: "#1e293b", border: "1px solid #2a3347", borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#f1f5f9" },
  loadingBox: { display: "flex", alignItems: "center", gap: 12, color: "#64748b", padding: 40, justifyContent: "center" },
  spinner: { width: 20, height: 20, border: "2px solid #2a3347", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #2a3347", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" },
  td: { padding: "8px 12px", color: "#cbd5e1", whiteSpace: "nowrap" },
};
