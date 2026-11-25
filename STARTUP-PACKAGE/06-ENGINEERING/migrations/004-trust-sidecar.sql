-- Apply once transactionally to existing V1.3 DB after verified SQLite backup. No table resets. Application backfills known fixture declarations only; missing trust rows block new quotes.
CREATE TABLE IF NOT EXISTS asset_trust (
 asset_pda TEXT PRIMARY KEY REFERENCES assets(asset_pda), source_label TEXT NOT NULL CHECK(length(source_label) BETWEEN 1 AND 128), observed_at INTEGER NOT NULL CHECK(observed_at>0), rights_declared INTEGER NOT NULL CHECK(rights_declared=1), schema_id TEXT NOT NULL CHECK(schema_id IN('TEXT_V1','BOUNTY_JSON_V2')), validation_status TEXT NOT NULL CHECK(validation_status IN('VALID','INVALID')), accuracy_status TEXT NOT NULL CHECK(accuracy_status='UNVERIFIED'), synthetic INTEGER NOT NULL CHECK(synthetic=1)
);

CREATE TABLE IF NOT EXISTS agent_runs (
 run_id TEXT PRIMARY KEY, policy_hash TEXT NOT NULL CHECK(length(policy_hash)=64), buyer TEXT NOT NULL, token_cap TEXT NOT NULL, sol_cap TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS spend_reservations (
 run_id TEXT NOT NULL REFERENCES agent_runs(run_id), intent_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN('PURCHASE','BOUNTY')), token_reserved TEXT NOT NULL, sol_reserved TEXT NOT NULL, sol_actual TEXT, state TEXT NOT NULL CHECK(state IN('RESERVED','PENDING','UNKNOWN','FINALIZED','NOT_LANDED')), tx_signature TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(run_id,intent_id), UNIQUE(intent_id)
);
-- All amount strings parsed as checked unsigned BigInt by app, never SQL float arithmetic.
-- A signed/pending/unknown intent remains reserved; finalized spends counted once. NOT_LANDED requires proven failure/expiry and no finalized matching PDA; record actual failed-tx fees separately in sol_actual. Refund does not release finalized token spend from run cap.
