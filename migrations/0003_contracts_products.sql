-- 계약 관리 · 상품 단가표 (2026-10-24 다른 PC에서 운영 D1에 먼저 생성됨 — 기록용, 이미 있으면 무시)
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
