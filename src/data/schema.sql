PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
CREATE TABLE assets (
 asset_pda TEXT PRIMARY KEY, provider TEXT NOT NULL, asset_id TEXT NOT NULL CHECK(length(asset_id)=32), version INTEGER NOT NULL CHECK(version>=1), title TEXT NOT NULL, tags TEXT NOT NULL, teaser TEXT NOT NULL,
 body BLOB NOT NULL, license BLOB NOT NULL, content_hash TEXT NOT NULL CHECK(length(content_hash)=64), license_hash TEXT NOT NULL CHECK(length(license_hash)=64), price TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN(0,1)), finalized_slot INTEGER, UNIQUE(provider,asset_id,version)
);
CREATE INDEX assets_active ON assets(active,title);
CREATE TABLE quotes (order_id TEXT PRIMARY KEY CHECK(length(order_id)=32), buyer TEXT NOT NULL, items_json TEXT NOT NULL, total TEXT NOT NULL, expires_at INTEGER NOT NULL, tx_signature TEXT, state TEXT NOT NULL CHECK(state IN('QUOTED','PENDING','FINALIZED','FAILED','UNKNOWN')));
CREATE TABLE receipts (pda TEXT PRIMARY KEY, buyer TEXT NOT NULL, asset_pda TEXT NOT NULL REFERENCES assets(asset_pda), order_id TEXT NOT NULL, kind INTEGER NOT NULL CHECK(kind IN(0,1)), tx_signature TEXT, finalized_slot INTEGER NOT NULL, amount TEXT NOT NULL, provider_amount TEXT NOT NULL, platform_amount TEXT NOT NULL, content_hash TEXT NOT NULL, license_hash TEXT NOT NULL, mint TEXT NOT NULL, version INTEGER NOT NULL, verified_at INTEGER NOT NULL, UNIQUE(buyer,order_id,asset_pda,kind));
CREATE TABLE challenges (nonce_hash TEXT PRIMARY KEY, buyer TEXT NOT NULL, receipt_pda TEXT NOT NULL, message BLOB NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
CREATE INDEX challenges_expiry ON challenges(expires_at);
CREATE TABLE bounties (pda TEXT PRIMARY KEY, requester TEXT NOT NULL, bounty_id TEXT NOT NULL, requirement_json TEXT NOT NULL, requirement_hash TEXT NOT NULL, reward TEXT NOT NULL, deadline INTEGER NOT NULL, vault TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('OPEN','ACCEPTED','REFUNDED')), winner_submission TEXT, finalized_slot INTEGER, UNIQUE(requester,bounty_id));
CREATE TABLE submissions (pda TEXT PRIMARY KEY, bounty_pda TEXT NOT NULL REFERENCES bounties(pda), asset_pda TEXT NOT NULL REFERENCES assets(asset_pda), provider TEXT NOT NULL, finalized_slot INTEGER NOT NULL, UNIQUE(bounty_pda,asset_pda,provider));
CREATE TABLE delivery_log (id INTEGER PRIMARY KEY, receipt_pda TEXT NOT NULL REFERENCES receipts(pda), delivered_at INTEGER NOT NULL, result TEXT NOT NULL CHECK(result IN('VERIFIED','UNAVAILABLE','HASH_MISMATCH')));
-- Application validates u64 decimal strings using BigInt; never cast to float. Store only verified chain cache; no balances ledger.
