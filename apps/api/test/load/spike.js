import { check, sleep } from "k6";
import http from "k6/http";

// Environment variables — pass via --env flag when running k6
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

export const options = {
  scenarios: {
    spike: {
      executor: "constant-vus",
      vus: 200,
      duration: "10s",
    },
  },
  thresholds: {
    // Up to 30% failure is acceptable — rate limiter returns 429 (correct behaviour)
    http_req_failed: ["rate<0.30"],
    // Even under spike, successful requests should be fast
    "http_req_duration{status:200}": ["p(95)<500"],
  },
};

export default function () {
  const loginPayload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "spike-test@example.com",
    password: __ENV.TEST_PASSWORD || "SpikeTest123!",
  });

  const res = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "login_spike" },
  });

  // Both 200/201 (success) and 429 (rate limited) are valid responses.
  // A 429 proves the ThrottlerGuard is working correctly.
  check(res, {
    "response is 200, 201, or 429": (r) =>
      r.status === 200 || r.status === 201 || r.status === 429,
  });

  sleep(0.05);
}
