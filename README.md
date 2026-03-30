# InBody Data Viewer

InBody 기기에서 **웹훅**을 수신하면 **MySQL**에 저장하고, React 뷰어로 체성분 추이를 시각화하는 앱입니다.

```
InBody 기기
    │
    ▼  POST /webhook
Express 서버
    ├─ webhook_events 테이블에 저장
    └─ 백그라운드: GetInBodyDataByID 호출 후 inbody_data 업데이트
           │
           ▼
        MySQL
           │
           ▼  GET /api/members/:userId/history
       React Viewer
    (이벤트 목록 자동 갱신 → 클릭 → 체성분 차트)
```

## 기능

- **웹훅 수신** — InBody 기기 측정 완료 시 `POST /webhook`으로 이벤트 자동 수신
- **자동 데이터 저장** — 웹훅 수신 즉시 응답 후 백그라운드에서 InBody API 호출, 측정 데이터를 MySQL에 저장
- **이벤트 목록** — 수신된 웹훅 이벤트를 5초마다 자동 갱신하여 표시
- **체성분 차트** — 이벤트 행 클릭 시 해당 멤버의 측정 이력 차트 표시
- **대시보드 통계** — 오늘 측정 수, 전체 멤버 수, 이번주 측정 수 헤더에 표시
- **Simulate Event** — 헤더의 ⚡ 버튼으로 테스트 웹훅 즉시 발송

## Quick Start

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 항목을 입력합니다:

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

# 웹훅 보안 헤더 (선택)
WEBHOOK_HEADER_NAME=X-InBody-Secret
WEBHOOK_HEADER_VALUE=your_secret_value
```

> DB는 처음 실행 시 `webhook_events` 테이블을 자동으로 생성합니다.

### 2. 패키지 설치

```bash
npm install
```

### 3. 실행

**개발 모드** (터미널 두 개):

```bash
# 백엔드 (Express + MySQL)
npm run dev:server

# 프론트엔드 (Vite dev server)
npm run dev
```

- 뷰어: http://localhost:5174
- 웹훅 수신 주소: http://localhost:3001/webhook

**프로덕션 빌드**:

```bash
npm run build     # React 앱을 dist/ 로 빌드
node server.js    # Express가 정적 파일까지 함께 서빙
```

## 화면 구성

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚖️ InBody Data Viewer   오늘:2  멤버:5  이번주:8   ⚡ Simulate  │
├──────────────┬──────────────────────────────────────────────────┤
│ 선택된 멤버  │ 수신된 웹훅 이벤트 (5초마다 자동 갱신)           │
│ member001    │ ID │ User ID   │ 측정일시   │ Status             │
│              │  3 │ member001 │ 2024-09-10 │ success ←클릭      │
│ 지표 선택    │  2 │ testuser9-09 │ success            │
│ ✓ Weight     ├──────────────────────────────────────────────────┤
│ ✓ Skeletal   │ 체성분 추이 — member001                          │
│ ✓ Body Fat   │  ╭──╮                                            │
│              │  │  ╰──╮    ╭──╮                                │
│ 최근 측정값  │  │     ╰────╯  ╰──                              │
│ 72.3 kg      │  ──────────────────────                         │
│ 30.1 kg      │                                                  │
│              │ 측정 이력 테이블                                  │
│ ← 목록으로   │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path                           | 설명                              |
| ------ | ------------------------------ | --------------------------------- |
| `POST` | `/webhook`                     | InBody 기기 웹훅 수신             |
| `GET`  | `/api/stats`                   | 오늘/이번주 측정 수, 전체 멤버 수 |
| `GET`  | `/api/events?limit=50`         | 최근 웹훅 이벤트 목록             |
| `GET`  | `/api/members/:userId/history` | 특정 멤버 측정 이력 (DB)          |
| `POST` | `/api/test-webhook`            | 테스트용 웹훅 이벤트 주입         |

## DB 스키마

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
  inbody_data  JSON,                    -- InBody API 응답
  fetch_status VARCHAR(30)  DEFAULT 'pending',
  fetch_error  TEXT,
  received_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
)
```

`fetch_status` 값:

| 값                  | 의미                   |
| ------------------- | ---------------------- |
| `pending`           | API 조회 대기 중       |
| `success`           | 데이터 저장 완료       |
| `error`             | API 조회 실패          |
| `skipped_temp`      | 임시 측정값이라 스킵   |
| `skipped_no_config` | API 키 미설정으로 스킵 |

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
