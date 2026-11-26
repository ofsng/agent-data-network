-- Agent accounts for MCP agents on this machine (additive, idempotent).
-- agent_grants: spending allowances a human approved; each is a fixed, non-expandable cap.
-- agent_requests: things the agent asked a human for (big purchases, more budget).
-- agent_activity: what the agent did, for the human watching the web UI.
CREATE TABLE IF NOT EXISTS agent_grants (
  id INTEGER PRIMARY KEY, cluster TEXT NOT NULL, buyer TEXT NOT NULL, cap TEXT NOT NULL CHECK(cap GLOB '[0-9]*'),
  approve_above TEXT NOT NULL CHECK(approve_above GLOB '[0-9]*'), source TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_grants_buyer ON agent_grants(cluster, buyer, id);
CREATE TABLE IF NOT EXISTS agent_requests (
  id TEXT PRIMARY KEY, cluster TEXT NOT NULL, buyer TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN('PURCHASE','BUDGET')),
  amount TEXT NOT NULL, summary TEXT NOT NULL, payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('PENDING','APPROVED','DECLINED','USED')), created_at INTEGER NOT NULL, decided_at INTEGER, decided_by TEXT
);
CREATE INDEX IF NOT EXISTS agent_requests_buyer ON agent_requests(cluster, buyer, created_at);
CREATE TABLE IF NOT EXISTS agent_activity (
  id INTEGER PRIMARY KEY, cluster TEXT NOT NULL, buyer TEXT NOT NULL, at INTEGER NOT NULL, tool TEXT NOT NULL,
  summary TEXT NOT NULL, ok INTEGER NOT NULL CHECK(ok IN(0,1)), ref TEXT
);
CREATE INDEX IF NOT EXISTS agent_activity_buyer ON agent_activity(cluster, buyer, id);
