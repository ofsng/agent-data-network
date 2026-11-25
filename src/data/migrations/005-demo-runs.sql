-- V1.5 guided demo run state (additive). One row per isolated run; state is JSON
-- produced by the orchestrator from actual chain/service results.
CREATE TABLE IF NOT EXISTS demo_runs (
 run_id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN('LOCAL_VALIDATOR','DEVNET','SIMULATION')), token_hash TEXT NOT NULL,
 step TEXT NOT NULL, state_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
