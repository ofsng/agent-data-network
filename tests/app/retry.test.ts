// T57/T58: retries of the guided session recover instead of getting stuck.
// T57: the quote expires before the agent signs (e.g. a presenter pauses between steps);
//      retrying the payment step takes a fresh quote for the same units and pays once.
// T58: the refund step fails right after its bounty was funded; the retry continues with
//      that bounty instead of opening a second one, and the refund completes.
import { expect } from "chai";
import { loadConfig } from "../../src/config";
import { openDb } from "../../src/data/store";
import { createService } from "../../src/api/service";
import { wallets } from "../../src/chain/ops";
import { DemoOrchestrator, POLICY } from "../../src/demo/orchestrator";

describe("guided session retries (T57, T58)", () => {
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const orch = new DemoOrchestrator(createService(cfg, db), wallets(cfg));
  const o = orch as any; // test-only access to the orchestrator's step helpers
  let runId = "";
  const step = async (expect_: string) => {
    const s = await orch.advance(runId, orch.get(runId)!.step);
    expect(s.status, s.error?.message).to.not.equal("error");
    expect(s.step).to.equal(expect_);
    return s;
  };

  before(async function () {
    if (cfg.cluster !== "localnet") this.skip();
    runId = (await orch.createRun()).runId;
  });

  it("T57 expired quote: retry re-quotes the same units and pays once", async () => {
    for (const s of ["PUBLISHED", "SEARCHED", "QUOTED"]) await step(s);
    const first = orch.get(runId)!.data.quote;
    db.prepare("UPDATE quotes SET expires_at=? WHERE order_id=?").run(Math.floor(Date.now() / 1000) - 1, first.orderId);
    const paid = await step("PAYMENT_PENDING");
    expect(paid.data.requotes).to.equal(1);
    expect(paid.data.quote.orderId).to.not.equal(first.orderId);
    expect(paid.data.quote.items.map((i: any) => i.assetPda)).to.deep.equal(first.items.map((i: any) => i.assetPda));
    expect(paid.data.quote.total).to.equal(first.total);
    expect(db.prepare("SELECT state FROM quotes WHERE order_id=?").get(first.orderId)).to.deep.equal({ state: "QUOTED" }); // never sent
    const done = await step("PURCHASED");
    expect(done.deltas.purchase.agent).to.equal(`-${first.total}`);
  });

  it("T58 refund retry after funding: same bounty, no second bounty, full refund", async () => {
    for (const s of ["VERIFIED", "GAP", "BOUNTY_FUNDED", "SUBMITTED", "REVIEWED", "ACCEPTED", "DELIVERED", "ACTIVATED", "RESOLD"]) await step(s);
    // What the step does first, then a crash before anything else is recorded.
    const s = orch.get(runId)!;
    const b = await o.tools(s, "refundRequester").create_bounty("X100_RECYCLING_V2", POLICY.bountyReward, POLICY.refundDeadlineSecs);
    const f = await o.fee(b.signature);
    o.tx(s, "Separate requester funds a short-lived bounty", b.signature, f.slot, f.fee);
    o.save(s);

    const r = await step("REFUND_DEMONSTRATED");
    expect(r.transactions.filter((x) => x.label === "Separate requester funds a short-lived bounty")).to.have.length(1);
    expect(r.data.refund.bountyPda).to.equal(b.bountyPda);
    // Before the deadline the program's rejection is shown; after it, the step says it was not re-checked.
    const early = r.data.refund.earlyRefund;
    expect(early).to.be.oneOf(["DeadlineNotReached", "not re-checked (resumed after the deadline)"]);
    const summary = r.steps.filter((x) => x.step === "REFUND_DEMONSTRATED").pop()!.summary;
    expect(summary.includes("rejected by the program")).to.equal(early === "DeadlineNotReached");
    expect(r.deltas.refund.refundRequester).to.equal(POLICY.bountyReward.toString());
    expect(r.deltas.refund.treasury).to.equal("0");
    const requester = r.wallets.refundRequester;
    const mine = (await o.svc.listBounties(null)).filter((x: any) => x.requester === requester);
    expect(mine.map((x: any) => x.status)).to.deep.equal(["REFUNDED"]);
  });
});
