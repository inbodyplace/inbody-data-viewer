# InBody Data Viewer

A browser-only React app that visualises body composition trends for any member using the [InBody Developers API](https://kr.developers.inbody.com).
No server required — API calls are made directly from the browser.

## What it does

1. **Fetches** the full measurement datetime list via `GetDatetimesByID`
2. **Loads** up to 20 most-recent measurements via `GetInBodyDataByID`
3. **Plots** a line chart for selected metrics (Weight, Skeletal Muscle, Body Fat Mass, Body Fat %, BMI)
4. **Shows** a measurement history table with all fetched data points
5. **Saves** your Account ID and API Key in `localStorage` for convenience

```
┌────────────────────────────────────────────────────────────────┐
│  ⚖️  InBody Data Viewer         12 measurements · UserID: demo  │
├──────────────────┬─────────────────────────────────────────────┤
│ API Config       │  Body Composition Trend                      │
│ ─────────────    │  ╭──╮                                        │
│ Account          │  │  ╰──╮    ╭──╮                            │
│ [your_account]   │  │     ╰────╯  ╰──────                      │
│                  │  ──────────────────────────────────          │
│ API Key          │  2024-01  2024-03  2024-06  2024-09         │
│ [••••••••••]     ├─────────────────────────────────────────────┤
│                  │  Measurement History (12)                    │
│ User ID          │  Date       Weight  Muscle  Fat%  BMI       │
│ [member001] [Go] │  2024-09-10  72.3   32.1   18.4  23.4      │
│                  │  2024-06-05  73.8   31.8   19.2  23.9      │
│ ✓ Weight         │  ...                                        │
│ ✓ Skeletal Muscle│                                             │
│ ✓ Body Fat Mass  │                                             │
│ □ Body Fat %     │                                             │
│ □ BMI            │                                             │
│ ─── Latest ───   │                                             │
│  72.3 kg  32.1kg │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. Enter your credentials

In the left panel:

- **LBWeb Account** — your LookinBody Web account ID
- **API Key** — from **InBody Developers → API Setup → Generate API Key**
- **User ID** — the member ID in LookinBody Web

Press **Search** (or `Enter`) to load the chart.

> Credentials are saved in `localStorage` and restored on next visit.

### Build for production

```bash
npm run build
# Output in dist/
npm run preview  # preview the production build locally
```

## Metrics

| Key   | Label                | Unit |
| ----- | -------------------- | ---- |
| `WT`  | Weight               | kg   |
| `SMM` | Skeletal Muscle Mass | kg   |
| `BFM` | Body Fat Mass        | kg   |
| `PBF` | Body Fat %           | %    |
| `BMI` | BMI                  | —    |

Toggle any metric on/off with the checkboxes in the sidebar.

## API Calls Used

| Endpoint                         | Purpose                                         |
| -------------------------------- | ----------------------------------------------- |
| `POST /Inbody/GetDatetimesByID`  | Get list of measurement timestamps for a user   |
| `POST /Inbody/GetInBodyDataByID` | Fetch body composition data for one measurement |

Both calls are made to `https://apikr.lookinbody.com` with `Account` and `API-KEY` headers.

## Tech Stack

- **React** 18
- **Vite** 5
- **Chart.js** 4 + **react-chartjs-2**
- **Axios**
- No backend, no build-time secrets
