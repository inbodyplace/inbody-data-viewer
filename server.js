import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { getPool, initSchema } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// InBody API client
const inbody = axios.create({
  baseURL: process.env.INBODY_API_BASE_URL || "https://apikr.lookinbody.com",
  headers: {
    Account: process.env.INBODY_ACCOUNT,
    "API-KEY": process.env.INBODY_API_KEY,
    "Content-Type": "application/json",
  },
});

// ─── Webhook ──────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const secretHeader = process.env.WEBHOOK_HEADER_NAME;
  const secretValue = process.env.WEBHOOK_HEADER_VALUE;
  if (secretHeader && secretValue) {
    if (req.headers[secretHeader.toLowerCase()] !== secretValue) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const {
    UserID,
    TelHP,
    Equip,
    EquipSerial,
    TestDatetimes,
    Account,
    IsTempData,
  } = req.body;
  const isTemp = IsTempData === true || IsTempData === 1 ? 1 : 0;

  try {
    const db = await getPool();
    const [result] = await db.execute(
      `INSERT INTO webhook_events (user_id, user_token, equip, equip_serial, test_at, account, is_temp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        UserID || null,
        TelHP || null,
        Equip || null,
        EquipSerial || null,
        TestDatetimes || null,
        Account || null,
        isTemp,
      ],
    );

    const eventId = result.insertId;
    console.log(
      `[webhook] Received id=${eventId} user=${UserID} test_at=${TestDatetimes}`,
    );
    res.status(200).json({ received: true, id: eventId });

    const hasCredentials =
      process.env.INBODY_ACCOUNT && process.env.INBODY_API_KEY;
    if (!isTemp && hasCredentials && UserID && TestDatetimes) {
      fetchAndStore(eventId, UserID, TestDatetimes);
    } else {
      const skipReason = isTemp
        ? "skipped_temp"
        : !hasCredentials
          ? "skipped_no_config"
          : "skipped_no_data";
      db.execute("UPDATE webhook_events SET fetch_status = ? WHERE id = ?", [
        skipReason,
        eventId,
      ]).catch(() => {});
    }
  } catch (err) {
    console.error("[webhook] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

async function fetchAndStore(eventId, userId, testAt) {
  try {
    const res = await inbody.post("/Inbody/GetInBodyDataByID", {
      UserID: userId,
      Datetimes: String(testAt),
    });

    const db = await getPool();
    await db.execute(
      `UPDATE webhook_events SET inbody_data = ?, fetch_status = 'success' WHERE id = ?`,
      [JSON.stringify(res.data), eventId],
    );
    console.log(`[fetchAndStore] Success id=${eventId}`);
  } catch (err) {
    const db = await getPool();
    await db
      .execute(
        `UPDATE webhook_events SET fetch_status = 'error', fetch_error = ? WHERE id = ?`,
        [err.message, eventId],
      )
      .catch(() => {});
    console.error(`[fetchAndStore] Error id=${eventId}:`, err.message);
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
  try {
    const db = await getPool();
    const [[row]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM webhook_events WHERE DATE(received_at) = CURDATE())              AS todayMeasurements,
        (SELECT COUNT(DISTINCT user_id) FROM webhook_events)                                    AS totalMembers,
        (SELECT COUNT(*) FROM webhook_events WHERE received_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weekMeasurements
    `);
    res.json({
      ...row,
      apiConfigured: !!(
        process.env.INBODY_ACCOUNT && process.env.INBODY_API_KEY
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/events", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const db = await getPool();
    const [rows] = await db.query(
      `SELECT id, user_id, equip, test_at, is_temp, fetch_status, received_at
       FROM webhook_events ORDER BY received_at DESC LIMIT ${limit}`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/members/:userId/history", async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT id, test_at, equip, is_temp, fetch_status, inbody_data, received_at
       FROM webhook_events WHERE user_id = ? ORDER BY test_at DESC LIMIT 50`,
      [req.params.userId],
    );
    // Note: LIMIT 50 is a literal here (no param binding) — no mysqld_stmt issue
    // Flatten inbody_data into each row so the frontend can access metrics directly
    const result = rows.map((row) => {
      let metrics = {};
      if (row.inbody_data) {
        try {
          metrics =
            typeof row.inbody_data === "string"
              ? JSON.parse(row.inbody_data)
              : row.inbody_data;
        } catch {
          /* ignore */
        }
      }
      return { ...row, inbody_data: undefined, ...metrics };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: raw inbody_data for last 5 success events
app.get("/api/debug/inbody", async (_req, res) => {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT id, user_id, test_at, fetch_status, inbody_data
     FROM webhook_events WHERE fetch_status = 'success' ORDER BY id DESC LIMIT 5`,
  );
  res.json(rows);
});

// Test webhook injection
app.post("/api/test-webhook", async (req, res) => {
  const now = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
  const payload = {
    UserID: req.body.userID || "testuser",
    TelHP: req.body.telHP || null,
    Equip: req.body.equip || "TestEquip",
    EquipSerial: req.body.equipSerial || "SN-0000",
    TestDatetimes: req.body.testDatetimes || now,
    Account: process.env.INBODY_ACCOUNT || null,
    IsTempData: "false",
  };
  try {
    const db = await getPool();
    const hasCredentials = !!(
      process.env.INBODY_ACCOUNT && process.env.INBODY_API_KEY
    );
    const [result] = await db.execute(
      `INSERT INTO webhook_events (user_id, user_token, equip, equip_serial, test_at, account, is_temp, fetch_status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        payload.UserID,
        payload.TelHP,
        payload.Equip,
        payload.EquipSerial,
        payload.TestDatetimes,
        payload.Account,
        hasCredentials ? "pending" : "skipped_no_config",
      ],
    );
    const eventId = result.insertId;
    console.log(
      `[test-webhook] Injected event id=${eventId} user=${payload.UserID}`,
    );
    res.json({ message: "Test event injected", eventId });

    if (hasCredentials) {
      fetchAndStore(eventId, payload.UserID, payload.TestDatetimes);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log(`[server] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

start();
