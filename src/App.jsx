import { useState, useCallback } from "react";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ─── Constants ────────────────────────────────────────────────────────────────
const METRICS = [
  { key: "WT", label: "Weight", unit: "kg", color: "#3b82f6" },
  { key: "SMM", label: "Skeletal Muscle", unit: "kg", color: "#22c55e" },
  { key: "BFM", label: "Body Fat Mass", unit: "kg", color: "#f59e0b" },
  { key: "PBF", label: "Body Fat %", unit: "%", color: "#ef4444" },
  { key: "BMI", label: "BMI", unit: "", color: "#a855f7" },
];

const MAX_FETCH = 20; // max measurements to fetch (to avoid rate limit)

// ─── API helpers ──────────────────────────────────────────────────────────────
function makeHeaders(account, apiKey) {
  return { 'Account': account, 'API-KEY': apiKey, 'Content-Type': 'application/json' }
}
async function fetchDatetimes(account, apiKey, userId) {
  const res = await axios.post(
    "https://apikr.lookinbody.com/Inbody/GetDatetimesByID",
    { UserID: userId },
    { headers: makeHeaders(account, apiKey) },
  );

  return Array.isArray(res.data) ? res.data : (res.data?.datetimes ?? []);
}

async function fetchMeasurement(account, apiKey, userId, datetimes) {
  const res = await axios.post(
    "https://apikr.lookinbody.com/Inbody/GetInBodyDataByID",
    { UserID: userId, Datetimes: datetimes },
    { headers: makeHeaders(account, apiKey) },
  );

  return res.data;
}

// "20190811120103" → "2019-08-11"
function parseDate(dt) {
  if (!dt || dt.length < 8) return dt;
  return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [account, setAccount] = useState(
    localStorage.getItem("ib_account") || "",
  );
  const [apiKey, setApiKey] = useState(localStorage.getItem("ib_apikey") || "");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [activeMetrics, setActiveMetrics] = useState(["WT", "SMM", "BFM"]);

  const saveConfig = () => {
    localStorage.setItem("ib_account", account);
    localStorage.setItem("ib_apikey", apiKey);
  };

  const search = useCallback(async () => {
    if (!account || !apiKey || !userId) return;
    saveConfig();
    setLoading(true);
    setError(null);
    setMeasurements([]);
    try {
      // 1. Get datetime list
      const datetimes = await fetchDatetimes(account, apiKey, userId);
      if (!datetimes.length) {
        setError("No measurements found for this user.");
        return;
      }

      // 2. Fetch most recent MAX_FETCH measurements (oldest → newest for chart)
      const toFetch = [...datetimes].reverse().slice(-MAX_FETCH);
      const results = [];
      for (const dt of toFetch) {
        try {
          const data = await fetchMeasurement(account, apiKey, userId, dt);
          results.push({ datetimes: dt, date: parseDate(dt), ...data });
        } catch {
          /* skip failed individual fetch */
        }
      }
      setMeasurements(results);
    } catch (err) {
      const code = err.response?.data?.errorCode;
      setError(code ? `API Error: ${code}` : err.message);
    } finally {
      setLoading(false);
    }
  }, [account, apiKey, userId]);

  const toggleMetric = (key) => {
    setActiveMetrics((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key],
    );
  };

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = {
    labels: measurements.map((m) => m.date),
    datasets: METRICS.filter((m) => activeMetrics.includes(m.key)).map((m) => ({
      label: `${m.label}${m.unit ? ` (${m.unit})` : ""}`,
      data: measurements.map((r) => {
        const v = r[m.key];
        return v !== undefined && v !== null ? Number(v) : null;
      }),
      borderColor: m.color,
      backgroundColor: m.color + "22",
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: false,
      spanGaps: true,
    })),
  };

  const chartOptions = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#94a3b8",
          boxWidth: 12,
          padding: 16,
          font: { size: 12 },
        },
      },
      title: { display: false },
    },
    scales: {
      x: {
        ticks: { color: "#64748b", maxRotation: 45, font: { size: 11 } },
        grid: { color: "#1e293b" },
      },
      y: {
        ticks: { color: "#64748b", font: { size: 11 } },
        grid: { color: "#1e293b" },
      },
    },
  };

  // ── Latest snapshot ─────────────────────────────────────────────────────────
  const latest = measurements.length
    ? measurements[measurements.length - 1]
    : null;

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={{ color: "#3b82f6" }}>⚖️</span> InBody Data Viewer
        </div>
        <span style={styles.headerSub}>
          {measurements.length > 0 &&
            `${measurements.length} measurements · UserID: ${userId}`}
        </span>
      </header>

      <div style={styles.body}>
        {/* Config panel */}
        <div style={styles.configPanel}>
          <div style={styles.sectionTitle}>API Configuration</div>
          <label style={styles.label}>LBWeb Account</label>
          <input
            style={styles.input}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="your_account"
          />
          <label style={styles.label}>API Key</label>
          <input
            style={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="••••••••••••••••"
          />
          <div style={{ height: 16 }} />
          <div style={styles.sectionTitle}>Member</div>
          <label style={styles.label}>User ID</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...styles.input, flex: 1 }}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="member001"
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button
              style={styles.btn}
              onClick={search}
              disabled={loading || !account || !apiKey || !userId}
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {/* Metric toggles */}
          {measurements.length > 0 && (
            <>
              <div style={{ ...styles.sectionTitle, marginTop: 24 }}>
                Show Metrics
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {METRICS.map((m) => (
                  <label
                    key={m.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={activeMetrics.includes(m.key)}
                      onChange={() => toggleMetric(m.key)}
                      style={{ accentColor: m.color }}
                    />
                    <span
                      style={{
                        color: activeMetrics.includes(m.key)
                          ? "#f1f5f9"
                          : "#64748b",
                      }}
                    >
                      {m.label}
                      {m.unit ? ` (${m.unit})` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Latest snapshot */}
          {latest && (
            <>
              <div style={{ ...styles.sectionTitle, marginTop: 24 }}>
                Latest Snapshot
              </div>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>
                {latest.date}
              </div>
              <div style={styles.snapshotGrid}>
                {METRICS.map(
                  (m) =>
                    latest[m.key] != null && (
                      <div key={m.key} style={styles.snapshotCard}>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginBottom: 2,
                          }}
                        >
                          {m.label}
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: m.color,
                          }}
                        >
                          {latest[m.key]}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 400,
                              color: "#64748b",
                            }}
                          >
                            {m.unit ? ` ${m.unit}` : ""}
                          </span>
                        </div>
                      </div>
                    ),
                )}
              </div>
            </>
          )}
        </div>

        {/* Main content */}
        <div style={styles.main}>
          {error && <div style={styles.errorBox}>❌ {error}</div>}

          {loading && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              Fetching measurements…
            </div>
          )}

          {!loading && measurements.length === 0 && !error && (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <div>
                Enter your API credentials and a User ID to view body
                composition trends.
              </div>
            </div>
          )}

          {measurements.length > 0 && (
            <>
              {/* Chart */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>Body Composition Trend</div>
                <Line data={chartData} options={chartOptions} />
              </div>

              {/* Table */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  Measurement History ({measurements.length})
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        {METRICS.map((m) => (
                          <th key={m.key} style={styles.th}>
                            {m.label}
                            {m.unit ? ` (${m.unit})` : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...measurements].reverse().map((r, i) => (
                        <tr
                          key={i}
                          style={{
                            background: i % 2 === 0 ? "transparent" : "#0f172a",
                          }}
                        >
                          <td style={styles.td}>{r.date}</td>
                          {METRICS.map((m) => (
                            <td
                              key={m.key}
                              style={{ ...styles.td, color: m.color }}
                            >
                              {r[m.key] != null ? r[m.key] : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    background: "#0f172a",
    color: "#f1f5f9",
    minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
  },
  header: {
    background: "#1e293b",
    borderBottom: "1px solid #2a3347",
    padding: "0 24px",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerSub: { fontSize: 12, color: "#64748b" },
  body: { display: "flex", gap: 0, height: "calc(100vh - 56px)" },
  configPanel: {
    width: 260,
    background: "#1e293b",
    borderRight: "1px solid #2a3347",
    padding: "20px 16px",
    overflowY: "auto",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
    marginBottom: 10,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    width: "100%",
    background: "#0f172a",
    border: "1px solid #2a3347",
    borderRadius: 6,
    padding: "7px 10px",
    color: "#f1f5f9",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  },
  btn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  snapshotGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  snapshotCard: {
    background: "#0f172a",
    border: "1px solid #2a3347",
    borderRadius: 8,
    padding: "10px",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  card: {
    background: "#1e293b",
    border: "1px solid #2a3347",
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 16,
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: "12px 16px",
    color: "#fca5a5",
    fontSize: 13,
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#64748b",
    padding: 40,
    justifyContent: "center",
  },
  spinner: {
    width: 20,
    height: 20,
    border: "2px solid #2a3347",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    textAlign: "center",
    lineHeight: 1.7,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "8px 12px",
    borderBottom: "1px solid #2a3347",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  td: { padding: "8px 12px", color: "#cbd5e1", whiteSpace: "nowrap" },
};
