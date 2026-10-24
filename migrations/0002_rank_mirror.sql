-- 리워드 순위체크 (플레이스 · N 가격비교) — 사내 순위 서버(ai-desk, 회사 PC)가 수집해 올려 보내는 복사본.
-- 원본은 순위 서버에 있고, 여기 표는 화면에 보여 주기 위한 것이다. 기존 표는 건드리지 않는다.
CREATE TABLE IF NOT EXISTS rk_targets (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, keyword TEXT NOT NULL, ref_id TEXT NOT NULL, url TEXT, name TEXT, group_name TEXT,
  memo TEXT, client TEXT, contract_start TEXT, contract_end TEXT, source TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT, created_at TEXT, last_checked_at TEXT, last_rank INTEGER, prev_rank INTEGER, last_status TEXT,
  search_volume INTEGER, rep_keywords TEXT, hl_color TEXT, alert INTEGER NOT NULL DEFAULT 0, sort_order INTEGER,
  archived_at TEXT, item_count INTEGER, fail_count INTEGER, synced_at TEXT
);
CREATE INDEX IF NOT EXISTS rk_targets_kind ON rk_targets(kind, active);
CREATE TABLE IF NOT EXISTS rk_history (
  target_id INTEGER NOT NULL, day TEXT NOT NULL, source TEXT NOT NULL,
  rank INTEGER, depth INTEGER, total INTEGER, visitor_reviews INTEGER, blog_reviews INTEGER,
  keep_count INTEGER, purchase_count INTEGER, review_count INTEGER, score REAL, checked_at TEXT,
  PRIMARY KEY (target_id, day, source)
);
CREATE TABLE IF NOT EXISTS rk_groups (kind TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY (kind, name));
CREATE TABLE IF NOT EXISTS rk_shares (token TEXT PRIMARY KEY, client TEXT, target_id INTEGER, expires_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS rk_meta (k TEXT PRIMARY KEY, v TEXT, at TEXT);
-- 화면에서 누른 등록·삭제·재검색 등 → 순위 서버가 가져가 처리하고 결과를 적는다
CREATE TABLE IF NOT EXISTS rk_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, path TEXT NOT NULL, query TEXT, body TEXT, actor TEXT,
  created_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', taken_at TEXT, done_at TEXT, status INTEGER, result TEXT
);
CREATE INDEX IF NOT EXISTS rk_commands_state ON rk_commands(state, id);
