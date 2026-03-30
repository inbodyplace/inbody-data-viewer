# InBody Data Viewer

Receives **webhooks** from InBody devices, stores measurements in **MySQL**, and visualizes body composition trends in a React viewer.

```
InBody Device
    │
    ▼  POST /webhook
Express Server
    ├─ Save to webhook_events table
    └─ Background: call GetInBodyDataByID → update inbody_data
           │
           ▼
        MySQL
           │
           ▼  GET /api/members/:userId/history
       React Viewer
    (auto-refresh event list → click row → body composition chart)
```

## Features

- **Webhook receiver** — automatically receives events via `POST /webhook` when a measurement is taken on an InBody device
- **Auto data storage** — responds immediately on webhook receipt, then fetches InBody API data in the background and stores it in MySQL
- **Event list** — displays received webhook events with auto-refresh every 5 seconds
- **Body composition chart** — click any event row to view that member's measurement history chart
- **Dashboard stats** — today's measurements, total members, and this week's count shown in the header
- **Simulate Event** — send a test webhook instantly via the ⚡ button in the header

## Quick Start

### 1. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=3001

INBODY_API_BASE_URL=https://apikr.lookinbody.com
INBODY_ACCOUNT=your_account
INBODY_API_KEY=your_api_key

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=inbody_viewer

# Webhook security header (optional)
WEBHOOK_HEADER_NAME=X-InBody-Secret
WEBHOOK_HEADER_VALUE=your_secret_value
```

> The `webhook_events` table is created automatically on first run.

### 2. Install dependencies

```bash
npm install
```

### 3. Run

**Development mode** (two terminals):

```bash
# Backend (Express + MySQL)
npm run dev:server

# Frontend (Vite dev server)
npm run dev
```

- Viewer: http://localhost:5174
- Webhook endpoint: http://localhost:3001/webhook

**Production build**:

```bash
npm run build     # Build React app into dist/
node server.js    # Express serves both API and static files
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚖️ InBody Data Viewer  Today:2  Members:5  This week:8  ⚡ Sim  │
├──────────────┬──────────────────────────────────────────────────┤
│ Selected     │ Webhook Events (auto-refresh every 5s)           │
│ Member:      │ ID │ User ID   │ Test Date  │ Status             │
│ member001    │  3 │ member001 │ 2024-09-10 │ success ← click   │
│              │  2 │ testuser  │ 2024-09-09 │ success            │
│ Metrics      ├──────────────────────────────────────────────────┤
│ ✓ Weight     │ Body Composition Trend — member001               │
│ ✓ Skeletal   │  ╭──╮                                            │
│ ✓ Body Fat   │  │  ╰──╮    ╭──╮                                │
│              │  │     ╰────╯  ╰──                              │
│ Latest       │  ──────────────────────                         │
│ Snapshot     │                                                  │
│ 72.3 kg      │ Measurement History table                        │
│ 30.1 kg      │                                                  │
│ ← Back       │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path                           | Description                        |
| ------ | ------------------------------ | ---------------------------------- |
| `POST` | `/webhook`                     | Receive webhook from InBody device |
| `GET`  | `/api/stats`                   | Today/week counts, total members   |
| `GET`  | `/api/events?limit=50`         | Recent webhook event list          |
| `GET`  | `/api/members/:userId/history` | Member measurement history (DB)    |
| `POST` | `/api/test-webhook`            | Inject a test webhook event        |

## DB Schema

```sql
CREATE TABLE webhook_events (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(50)  NOT NULL,
  user_token   VARCHAR(20),
  equip        VARCHAR(100),
  equip_serial VARCHAR(50),
  test_at      VARCHAR(14)  NOT NULL,   -- YYYYMMDDHHmmss
  account      VARCHAR(100),
  is_temp      TINYINT(1)   NOT NULL DEFAULT 0,
  inbody_data  JSON,                    -- InBody API response
  fetch_status VARCHAR(30)  DEFAULT 'pending',
  fetch_error  TEXT,
  received_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
)
```

`fetch_status` values:

| Value               | Meaning                                  |
| ------------------- | ---------------------------------------- |
| `pending`           | Waiting for API fetch                    |
| `success`           | Data fetched and stored                  |
| `error`             | API fetch failed                         |
| `skipped_temp`      | Skipped — temporary measurement          |
| `skipped_no_config` | Skipped — API credentials not configured |

## Metrics

| Key   | Label                | Unit |
| ----- | -------------------- | ---- |
| `WT`  | Weight               | kg   |
| `SMM` | Skeletal Muscle Mass | kg   |
| `BFM` | Body Fat Mass        | kg   |
| `PBF` | Body Fat %           | %    |
| `BMI` | BMI                  | —    |

## Tech Stack

- **React** 18 + **Vite** 5
- **Chart.js** 4 + **react-chartjs-2**
- **Express** 4
- **mysql2** 3
- **Axios** + **dotenv**
