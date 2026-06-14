import { check, sleep } from "k6";
import http from "k6/http";

// Environment variables — pass via --env flag when running k6
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const TEST_TOKEN = __ENV.TEST_TOKEN || "";

export const options = {
  scenarios: {
    steady_ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 }, // ramp up to 50 VUs
        { duration: "1m", target: 50 }, // hold at 50 VUs
        { duration: "30s", target: 0 }, // ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95th percentile under 500ms
    http_req_failed: ["rate<0.01"], // less than 1% errors
  },
};

/**
 * Extract a family group ID from a previous auth response body.
 * Falls back to "1" so the script runs without a real token for smoke testing.
 */
function familyGroupId(authBody) {
  return authBody && authBody.familyGroupId ? authBody.familyGroupId : "1";
}

export default function () {
  // --- 1. POST /auth/login ---
  const loginPayload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "load-test@example.com",
    password: __ENV.TEST_PASSWORD || "LoadTest123!",
  });

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "login" },
  });

  check(loginRes, {
    "login: status is 200 or 201": (r) => r.status === 200 || r.status === 201,
  });

  // Use injected token or fall back to the one returned by login
  const token = TEST_TOKEN || loginRes.json("accessToken") || "";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Parse family group id from login response when no token pre-supplied
  const fgId = familyGroupId(loginRes.json());

  sleep(0.5);

  // --- 2. GET /family-groups/:id/transactions ---
  const txRes = http.get(`${BASE_URL}/family-groups/${fgId}/transactions`, {
    headers,
    tags: { endpoint: "transactions" },
  });

  check(txRes, {
    "transactions: status is 200": (r) => r.status === 200,
  });

  sleep(0.5);

  // --- 3. GET /family-groups/:id/dashboard/summary ---
  const summaryRes = http.get(
    `${BASE_URL}/family-groups/${fgId}/dashboard/summary`,
    { headers, tags: { endpoint: "dashboard_summary" } },
  );

  check(summaryRes, {
    "dashboard summary: status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
