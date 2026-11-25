// Local-validator integration tests. Requires a validator with the program deployed
// as upgradeable with the deployer key as upgrade authority (scripts/localnet.sh).
import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { createTransferCheckedInstruction, createAccount } from "@solana/spl-token";
import { expect } from "chai";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  QuoteItem,
  ata,
  buildBundleTx,
  loadKeypair,
  pda,
  programFor,
  purchaseIx,
  split,
} from "../../src/chain/adn";
import {
  chainNow,
  connection,
  ensureAta,
  expectFail,
  fund,
  newFunded,
  rand16,
  registerAsset,
  send,
  setupMint,
  sha,
  sleep,
  tokenBal,
} from "./helpers";

const KEYS = process.env.ADN_KEYS_DIR ?? `${process.env.HOME}/.config/adn-demo/keys`;

describe("adn", () => {
  const deployer = loadKeypair(`${KEYS}/deployer.json`);
  let mint: PublicKey;
  let treasury: Keypair;
  let buyer: Keypair, providerA: Keypair, providerB: Keypair, requester: Keypair;
  let A01: QuoteItem & { assetId: Uint8Array }, B01: QuoteItem & { assetId: Uint8Array };
  const results: Record<string, unknown> = {};

  const initIx = (authority: PublicKey, m: PublicKey, t: PublicKey) =>
    programFor(connection, deployer)
      .methods.initializeConfig(t)
      .accountsStrict({
        authority,
        config: pda.config(),
        mint: m,
        program: programFor(connection, deployer).programId,
        programData: pda.programData(),
        systemProgram: SystemProgram.programId,
      })
      .instruction();

  before(async () => {
    await fund(deployer.publicKey, 20);
    [treasury, buyer, providerA, providerB, requester] = await Promise.all([
      newFunded(), newFunded(), newFunded(), newFunded(), newFunded(),
    ]);
    mint = await setupMint(deployer, 6);
    await ensureAta(deployer, mint, treasury.publicKey);
    await ensureAta(deployer, mint, providerA.publicKey);
    await ensureAta(deployer, mint, providerB.publicKey);
    await ensureAta(deployer, mint, buyer.publicKey, 1_000_000n, deployer);
    await ensureAta(deployer, mint, requester.publicKey, 10_000_000n, deployer);
  });

  after(() => console.log("RESULTS", JSON.stringify(results, null, 2)));

  describe("H03 config + registry", () => {
    it("T04 rejects unauthorized and wrong-decimals init, accepts authorized, rejects repeat", async () => {
      const attacker = await newFunded();
      await expectFail(send([await initIx(attacker.publicKey, mint, treasury.publicKey)], [attacker]), "UnauthorizedInitializer");
      const mint9 = await setupMint(deployer, 9);
      await expectFail(send([await initIx(deployer.publicKey, mint9, treasury.publicKey)], [deployer]), "InvalidMint");
      await send([await initIx(deployer.publicKey, mint, treasury.publicKey)], [deployer]);
      const cfg = await programFor(connection, deployer).account.config.fetch(pda.config());
      expect(cfg.mint.toBase58()).to.equal(mint.toBase58());
      expect(cfg.treasury.toBase58()).to.equal(treasury.publicKey.toBase58());
      expect(cfg.feeBps).to.equal(2000);
      expect(cfg.admin.toBase58()).to.equal(deployer.publicKey.toBase58());
      await expectFail(send([await initIx(deployer.publicKey, mint, treasury.publicKey)], [deployer]), /already in use/);
    });

    it("T05 registers assets; only provider can toggle; terms immutable", async () => {
      A01 = await registerAsset(programFor(connection, providerA), providerA, { body: "A01" });
      B01 = await registerAsset(programFor(connection, providerB), providerB, { body: "B01" });
      const progB = programFor(connection, providerB);
      await expectFail(
        progB.methods.setAssetActive(false).accountsStrict({ provider: providerB.publicKey, asset: A01.assetPda }).rpc(),
        "Unauthorized",
      );
      const progA = programFor(connection, providerA);
      await progA.methods.setAssetActive(false).accountsStrict({ provider: providerA.publicKey, asset: A01.assetPda }).rpc();
      expect((await progA.account.dataAsset.fetch(A01.assetPda)).active).to.equal(false);
      await progA.methods.setAssetActive(true).accountsStrict({ provider: providerA.publicKey, asset: A01.assetPda }).rpc();
      const a = await progA.account.dataAsset.fetch(A01.assetPda);
      expect(a.active).to.equal(true);
      expect(a.price.toString()).to.equal("30000");
      expect(Buffer.from(a.contentHash).equals(Buffer.from(A01.contentHash))).to.equal(true);
      // Re-registering the same (provider, id, version) cannot overwrite terms.
      await expectFail(
        registerAsset(progA, providerA, { assetId: A01.assetId, price: 1n, body: "changed" }),
        /already in use/,
      );
    });

    it("T06 rejects zero price, zero hash, version 0, treasury as provider", async () => {
      const prog = programFor(connection, providerA);
      await expectFail(registerAsset(prog, providerA, { price: 0n }), "InvalidPrice");
      await expectFail(registerAsset(prog, providerA, { version: 0 }), "InvalidVersion");
      const id = rand16();
      await expectFail(
        prog.methods
          .registerDataAsset(Array.from(id), 1, new Array(32).fill(0), Array.from(sha("l")), new BN(10), true)
          .accountsStrict({
            provider: providerA.publicKey,
            config: pda.config(),
            asset: pda.asset(providerA.publicKey, id, 1),
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
        "HashMismatch",
      );
      await fund(treasury.publicKey, 1);
      await expectFail(registerAsset(programFor(connection, treasury), treasury), "AliasedAccounts");
    });
  });

  describe("H05 atomic purchase", () => {
    it("T09/T10/T11 two providers, one tx, exact deltas, two receipts, size/CU", async () => {
      const prog = programFor(connection, buyer);
      const orderId = rand16();
      const expiresAt = (await chainNow()) + 120;
      const before = await Promise.all([buyer, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
      const tx = await buildBundleTx(prog, buyer.publicKey, mint, treasury.publicKey, orderId, [A01, B01], expiresAt);
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(buyer);
      const raw = tx.serialize();
      const sim = await connection.simulateTransaction(tx);
      expect(sim.value.err).to.equal(null);
      const sig = await connection.sendRawTransaction(raw);
      await connection.confirmTransaction(sig, "confirmed");
      const after = await Promise.all([buyer, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
      const d = after.map((v, i) => v - before[i]);
      expect(d).to.deep.equal([-60000n, 24000n, 24000n, 12000n]);
      expect(raw.length).to.be.at.most(1232);
      const ra = pda.receipt(buyer.publicKey, orderId, A01.assetPda);
      const rb = pda.receipt(buyer.publicKey, orderId, B01.assetPda);
      for (const [r, item] of [[ra, A01], [rb, B01]] as const) {
        const info = await connection.getAccountInfo(r);
        expect(info!.owner.toBase58()).to.equal(prog.programId.toBase58());
        expect(info!.data.length).to.equal(254);
        const rec = await prog.account.purchaseReceipt.fetch(r);
        expect(rec.buyer.toBase58()).to.equal(buyer.publicKey.toBase58());
        expect(rec.provider.toBase58()).to.equal(item.provider.toBase58());
        expect(rec.asset.toBase58()).to.equal(item.assetPda.toBase58());
        expect(rec.mint.toBase58()).to.equal(mint.toBase58());
        expect(Buffer.from(rec.orderId).equals(Buffer.from(orderId))).to.equal(true);
        expect(Buffer.from(rec.contentHash).equals(Buffer.from(item.contentHash))).to.equal(true);
        expect(Buffer.from(rec.licenseHash).equals(Buffer.from(item.licenseHash))).to.equal(true);
        expect(rec.version).to.equal(1);
        expect(rec.kind).to.equal(0);
        expect([rec.amount, rec.providerAmount, rec.platformAmount].map(String)).to.deep.equal(["30000", "24000", "6000"]);
      }
      const txInfo = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      results.T11 = {
        serializedBytes: raw.length,
        simulatedCU: sim.value.unitsConsumed,
        landedCU: txInfo?.meta?.computeUnitsConsumed,
        feeLamports: txInfo?.meta?.fee,
        receiptRentLamports: await connection.getMinimumBalanceForRentExemption(254),
      };
      (globalThis as any).__firstOrder = { orderId, expiresAt };
    });

    it("T12 rounding: 30001 and 1 base unit", async () => {
      const r1 = await registerAsset(programFor(connection, providerA), providerA, { price: 30001n });
      const r2 = await registerAsset(programFor(connection, providerB), providerB, { price: 1n });
      expect(split(30001n)).to.deep.equal({ provider: 24001n, platform: 6000n });
      expect(split(1n)).to.deep.equal({ provider: 1n, platform: 0n });
      const prog = programFor(connection, buyer);
      const before = await Promise.all([buyer, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
      const tx = await buildBundleTx(prog, buyer.publicKey, mint, treasury.publicKey, rand16(), [r1, r2], (await chainNow()) + 120);
      await connection.sendTransaction(tx, [buyer]).then((s) => connection.confirmTransaction(s, "confirmed"));
      const after = await Promise.all([buyer, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
      expect(after.map((v, i) => v - before[i])).to.deep.equal([-30002n, 24001n, 1n, 6000n]);
    });
  });

  describe("H06 adversarial purchase", () => {
    async function snapshot() {
      return Promise.all([buyer, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
    }

    it("T13 second instruction invalid -> whole tx reverts (landed with skipPreflight)", async () => {
      const prog = programFor(connection, buyer);
      const orderId = rand16();
      const exp = (await chainNow()) + 120;
      const bad = { ...B01, price: 29999n };
      const before = await snapshot();
      const ixs = [
        await purchaseIx(prog, buyer.publicKey, mint, treasury.publicKey, orderId, A01, exp),
        await purchaseIx(prog, buyer.publicKey, mint, treasury.publicKey, orderId, bad, exp),
      ];
      const solBefore = await connection.getBalance(buyer.publicKey);
      await expectFail(send(ixs, [buyer], true), "InvalidTerms");
      expect(await snapshot()).to.deep.equal(before);
      expect(await connection.getAccountInfo(pda.receipt(buyer.publicKey, orderId, A01.assetPda))).to.equal(null);
      expect(await connection.getAccountInfo(pda.receipt(buyer.publicKey, orderId, B01.assetPda))).to.equal(null);
      results.T13 = { networkFeeChargedLamports: solBefore - (await connection.getBalance(buyer.publicKey)) };
    });

    it("T14 replay of the same order ID is rejected with no payment", async () => {
      const { orderId } = (globalThis as any).__firstOrder;
      const prog = programFor(connection, buyer);
      const before = await snapshot();
      const tx = await buildBundleTx(prog, buyer.publicKey, mint, treasury.publicKey, orderId, [A01, B01], (await chainNow()) + 120);
      await expectFail(send(tx.instructions, [buyer]), /already in use/);
      expect(await snapshot()).to.deep.equal(before);
    });

    it("T15 wrong mint, non-canonical ATA, treasury alias, foreign token source all reject", async () => {
      const prog = programFor(connection, buyer);
      const exp = (await chainNow()) + 120;
      const before = await snapshot();
      const base = async (over: Record<string, PublicKey>, orderId = rand16()) =>
        prog.methods
          .purchaseUnit(Array.from(orderId), new BN(30000), Array.from(A01.contentHash), Array.from(A01.licenseHash), new BN(exp))
          .accountsStrict({
            buyer: buyer.publicKey,
            config: pda.config(),
            asset: A01.assetPda,
            receipt: pda.receipt(buyer.publicKey, orderId, A01.assetPda),
            mint,
            buyerToken: ata(buyer.publicKey, mint),
            providerToken: ata(providerA.publicKey, mint),
            treasuryToken: ata(treasury.publicKey, mint),
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            ...over,
          })
          .instruction();
      const otherMint = await setupMint(deployer, 6);
      await expectFail(send([await base({ mint: otherMint })], [buyer]), "InvalidMint");
      // Non-canonical (non-ATA) token account owned by buyer.
      const loose = await createAccount(connection, buyer, mint, buyer.publicKey, Keypair.generate());
      await expectFail(send([await base({ buyerToken: loose })], [buyer]), /ConstraintAssociated|ConstraintTokenOwner|InvalidTokenAccount|2014|2015|3014/);
      await expectFail(send([await base({ treasuryToken: ata(providerA.publicKey, mint) })], [buyer]), /ConstraintAssociated|ConstraintTokenOwner|2009|2015|3014|Duplicate|dup/i);
      await expectFail(send([await base({ providerToken: ata(providerB.publicKey, mint) })], [buyer]), /ConstraintAssociated|ConstraintTokenOwner|2015|3014/);
      // Spend someone else's tokens: requester's ATA as source.
      await expectFail(send([await base({ buyerToken: ata(requester.publicKey, mint) })], [buyer]), /ConstraintAssociated|ConstraintTokenOwner|2015|3014/);
      expect(await snapshot()).to.deep.equal(before);
    });

    it("T16 deactivated asset, changed hash/price, expired quote reject; old receipt remains", async () => {
      const prog = programFor(connection, buyer);
      const progA = programFor(connection, providerA);
      const before = await snapshot();
      const exp = (await chainNow()) + 120;
      await expectFail(
        send([await purchaseIx(prog, buyer.publicKey, mint, treasury.publicKey, rand16(), { ...A01, contentHash: sha("x") }, exp)], [buyer]),
        "InvalidTerms",
      );
      await expectFail(
        send([await purchaseIx(prog, buyer.publicKey, mint, treasury.publicKey, rand16(), { ...A01, price: 1n }, exp)], [buyer]),
        "InvalidTerms",
      );
      await expectFail(
        send([await purchaseIx(prog, buyer.publicKey, mint, treasury.publicKey, rand16(), A01, (await chainNow()) - 1)], [buyer]),
        "ExpiredQuote",
      );
      await progA.methods.setAssetActive(false).accountsStrict({ provider: providerA.publicKey, asset: A01.assetPda }).rpc();
      await expectFail(send([await purchaseIx(prog, buyer.publicKey, mint, treasury.publicKey, rand16(), A01, exp)], [buyer]), "InactiveAsset");
      const { orderId } = (globalThis as any).__firstOrder;
      const old = await prog.account.purchaseReceipt.fetch(pda.receipt(buyer.publicKey, orderId, A01.assetPda));
      expect(old.amount.toString()).to.equal("30000");
      await progA.methods.setAssetActive(true).accountsStrict({ provider: providerA.publicKey, asset: A01.assetPda }).rpc();
      expect(await snapshot()).to.deep.equal(before);
    });

    it("T17 balance covers first item only -> whole bundle fails, no receipt", async () => {
      const poor = await newFunded();
      await ensureAta(deployer, mint, poor.publicKey, 40000n, deployer);
      const prog = programFor(connection, poor);
      const orderId = rand16();
      const pre = await Promise.all([poor, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
      const tx = await buildBundleTx(prog, poor.publicKey, mint, treasury.publicKey, orderId, [A01, B01], (await chainNow()) + 120);
      await expectFail(send(tx.instructions, [poor], true), "InsufficientFunds");
      const post = await Promise.all([poor, providerA, providerB, treasury].map((k) => tokenBal(k.publicKey, mint)));
      expect(post).to.deep.equal(pre);
      expect(await connection.getAccountInfo(pda.receipt(poor.publicKey, orderId, A01.assetPda))).to.equal(null);
    });
  });

  describe("H09/H10 bounty escrow", () => {
    const REWARD = 2_000_000n;
    const requirementHash = sha('{"equipment":"X100","field":"recycling_certificate","requiredValue":"FICT-RECYCLE-2026"}');

    async function createBounty(deadlineIn: number, bountyId = rand16()) {
      const prog = programFor(connection, requester);
      const bounty = pda.bounty(requester.publicKey, bountyId);
      const deadline = (await chainNow()) + deadlineIn;
      await prog.methods
        .createBounty(Array.from(bountyId), Array.from(requirementHash), new BN(REWARD.toString()), new BN(deadline))
        .accountsStrict({
          requester: requester.publicKey,
          config: pda.config(),
          bounty,
          mint,
          requesterToken: ata(requester.publicKey, mint),
          vault: ata(bounty, mint),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      return { bounty, bountyId, deadline, vault: ata(bounty, mint) };
    }

    const submitIx = (provider: Keypair, bounty: PublicKey, asset: PublicKey) =>
      programFor(connection, provider)
        .methods.submitBountySolution()
        .accountsStrict({
          provider: provider.publicKey,
          config: pda.config(),
          bounty,
          asset,
          submission: pda.submission(bounty, provider.publicKey, asset),
          systemProgram: SystemProgram.programId,
        })
        .instruction();

    const acceptIx = (
      signer: Keypair,
      b: { bounty: PublicKey; vault: PublicKey },
      sol: { assetPda: PublicKey; provider: PublicKey; contentHash: Uint8Array; licenseHash: Uint8Array },
      over: Record<string, PublicKey> = {},
      reqHash = requirementHash,
    ) =>
      programFor(connection, signer)
        .methods.acceptBountySolution(Array.from(reqHash), Array.from(sol.contentHash), Array.from(sol.licenseHash))
        .accountsStrict({
          requester: signer.publicKey,
          config: pda.config(),
          bounty: b.bounty,
          submission: pda.submission(b.bounty, sol.provider, sol.assetPda),
          asset: sol.assetPda,
          mint,
          vault: b.vault,
          providerToken: ata(sol.provider, mint),
          treasuryToken: ata(treasury.publicKey, mint),
          bountyReceipt: pda.bountyReceipt(b.bounty, sol.assetPda),
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          ...over,
        })
        .instruction();

    const refundIx = (signer: Keypair, b: { bounty: PublicKey; vault: PublicKey }) =>
      programFor(connection, signer)
        .methods.refundExpiredBounty()
        .accountsStrict({
          requester: signer.publicKey,
          config: pda.config(),
          bounty: b.bounty,
          mint,
          vault: b.vault,
          requesterToken: ata(signer.publicKey, mint),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

    let main: Awaited<ReturnType<typeof createBounty>>;
    let solution: Awaited<ReturnType<typeof registerAsset>>;
    let wrong: Awaited<ReturnType<typeof registerAsset>>;

    it("T24 funding locks exactly 2,000,000 in the PDA vault; status OPEN", async () => {
      const before = await tokenBal(requester.publicKey, mint);
      main = await createBounty(600);
      expect(before - (await tokenBal(requester.publicKey, mint))).to.equal(REWARD);
      expect(await tokenBal(main.bounty, mint)).to.equal(REWARD);
      const b = await programFor(connection, requester).account.bounty.fetch(main.bounty);
      expect(b.status).to.equal(0);
      expect(b.winnerSubmission.toBase58()).to.equal(PublicKey.default.toBase58());
      await expectFail(createBounty(8 * 24 * 3600), "InvalidDeadline");
    });

    it("T25 provider submits inactive asset; no tokens move", async () => {
      solution = await registerAsset(programFor(connection, providerA), providerA, { active: false, body: '{"equipment":"X100","recycling_certificate":"FICT-RECYCLE-2026"}' });
      wrong = await registerAsset(programFor(connection, providerA), providerA, { active: false, body: '{"equipment":"X100","recycling_certificate":"WRONG"}' });
      const vaultBefore = await tokenBal(main.bounty, mint);
      await send([await submitIx(providerA, main.bounty, solution.assetPda)], [providerA]);
      await send([await submitIx(providerA, main.bounty, wrong.assetPda)], [providerA]);
      expect(await tokenBal(main.bounty, mint)).to.equal(vaultBefore);
      const s = await programFor(connection, providerA).account.submission.fetch(pda.submission(main.bounty, providerA.publicKey, solution.assetPda));
      expect(s.asset.toBase58()).to.equal(solution.assetPda.toBase58());
    });

    it("T26 invalid submissions reject (wrong owner, active asset, requester as provider)", async () => {
      await expectFail(send([await submitIx(providerB, main.bounty, solution.assetPda)], [providerB]), "Unauthorized");
      const active = await registerAsset(programFor(connection, providerB), providerB, { active: true });
      await expectFail(send([await submitIx(providerB, main.bounty, active.assetPda)], [providerB]), "InvalidSubmission");
      const own = await registerAsset(programFor(connection, requester), requester, { active: false });
      await expectFail(send([await submitIx(requester, main.bounty, own.assetPda)], [requester]), "AliasedAccounts");
    });

    it("T28 unauthorized/wrong accept attempts reject; bounty stays OPEN", async () => {
      const vaultBefore = await tokenBal(main.bounty, mint);
      const attacker = await newFunded();
      await expectFail(send([await acceptIx(attacker, main, solution)], [attacker]), /Unauthorized|ConstraintSeeds|2006/);
      await expectFail(send([await acceptIx(requester, main, solution, {}, sha("other"))], [requester]), "HashMismatch");
      await expectFail(send([await acceptIx(requester, main, { ...solution, contentHash: sha("z") })], [requester]), "HashMismatch");
      // Submission of solution but asset of `wrong` -> mismatch.
      await expectFail(
        send([await acceptIx(requester, main, solution, { asset: wrong.assetPda, bountyReceipt: pda.bountyReceipt(main.bounty, wrong.assetPda) })], [requester]),
        /InvalidSubmission|ConstraintSeeds|2006/,
      );
      await expectFail(send([await acceptIx(requester, main, solution, { vault: ata(requester.publicKey, mint) })], [requester]), /ConstraintAssociated|ConstraintTokenOwner|2015|3014|dup/i);
      await expectFail(send([await acceptIx(requester, main, solution, { providerToken: ata(providerB.publicKey, mint) })], [requester]), /ConstraintAssociated|ConstraintTokenOwner|2015|3014/);
      await expectFail(send([await acceptIx(requester, main, solution, { treasuryToken: ata(providerB.publicKey, mint) })], [requester]), /ConstraintAssociated|ConstraintTokenOwner|2015|3014/);
      expect(await tokenBal(main.bounty, mint)).to.equal(vaultBefore);
      expect((await programFor(connection, requester).account.bounty.fetch(main.bounty)).status).to.equal(0);
    });

    it("T31+T27 unsolicited dust; accept pays exactly 1.6M/0.4M, receipt, ACCEPTED, surplus stays", async () => {
      const DUST = 777n;
      await send([createTransferCheckedInstruction(ata(requester.publicKey, mint), mint, main.vault, requester.publicKey, DUST, 6)], [requester]);
      const pre = await Promise.all([main.bounty, providerA.publicKey, treasury.publicKey].map((k) => tokenBal(k, mint)));
      expect(pre[0]).to.equal(REWARD + DUST);
      await send([await acceptIx(requester, main, solution)], [requester]);
      const post = await Promise.all([main.bounty, providerA.publicKey, treasury.publicKey].map((k) => tokenBal(k, mint)));
      expect(post.map((v, i) => v - pre[i])).to.deep.equal([-REWARD, 1_600_000n, 400_000n]);
      expect(post[0]).to.equal(DUST);
      const prog = programFor(connection, requester);
      const b = await prog.account.bounty.fetch(main.bounty);
      expect(b.status).to.equal(1);
      expect(b.winnerSubmission.toBase58()).to.equal(pda.submission(main.bounty, providerA.publicKey, solution.assetPda).toBase58());
      const r = await prog.account.purchaseReceipt.fetch(pda.bountyReceipt(main.bounty, solution.assetPda));
      expect(r.kind).to.equal(1);
      expect(r.buyer.toBase58()).to.equal(requester.publicKey.toBase58());
      expect(Buffer.from(r.orderId).equals(Buffer.from(main.bountyId))).to.equal(true);
      expect([r.amount, r.providerAmount, r.platformAmount].map(String)).to.deep.equal(["2000000", "1600000", "400000"]);
      results.T31 = { vaultResidualAfterAccept: post[0].toString() };
    });

    it("T30 double release: second accept (other submission) and refund after accept reject", async () => {
      await expectFail(send([await acceptIx(requester, main, wrong)], [requester]), "BountyNotOpen");
      await expectFail(send([await refundIx(requester, main)], [requester]), /BountyNotOpen|DeadlineNotReached/);
      // Provider may now activate the accepted asset.
      const progA = programFor(connection, providerA);
      await progA.methods.setAssetActive(true).accountsStrict({ provider: providerA.publicKey, asset: solution.assetPda }).rpc();
      expect((await progA.account.dataAsset.fetch(solution.assetPda)).active).to.equal(true);
    });

    it("T29/T30 early refund rejects; after deadline: late accept rejects, refund returns full reward once, no fee", async () => {
      const short = await createBounty(6);
      const sol2 = await registerAsset(programFor(connection, providerB), providerB, { active: false });
      await send([await submitIx(providerB, short.bounty, sol2.assetPda)], [providerB]);
      await expectFail(send([await refundIx(requester, short)], [requester]), "DeadlineNotReached");
      const stranger = await newFunded();
      await ensureAta(deployer, mint, stranger.publicKey);
      while ((await chainNow()) < short.deadline + 1) await sleep(1000);
      await expectFail(send([await submitIx(providerB, short.bounty, (await registerAsset(programFor(connection, providerB), providerB, { active: false })).assetPda)], [providerB]), "DeadlinePassed");
      await expectFail(send([await acceptIx(requester, short, sol2)], [requester]), "DeadlinePassed");
      await expectFail(send([await refundIx(stranger, short)], [stranger]), /Unauthorized|ConstraintSeeds|2006/);
      const pre = await Promise.all([requester.publicKey, short.bounty, treasury.publicKey].map((k) => tokenBal(k, mint)));
      // Two competing refunds in flight: exactly one lands.
      const r = await Promise.allSettled([send([await refundIx(requester, short)], [requester]), send([await refundIx(requester, short), SystemProgram.transfer({ fromPubkey: requester.publicKey, toPubkey: requester.publicKey, lamports: 1 })], [requester])]);
      expect(r.filter((x) => x.status === "fulfilled").length).to.equal(1);
      const post = await Promise.all([requester.publicKey, short.bounty, treasury.publicKey].map((k) => tokenBal(k, mint)));
      expect(post.map((v, i) => v - pre[i])).to.deep.equal([REWARD, -REWARD, 0n]);
      expect((await programFor(connection, requester).account.bounty.fetch(short.bounty)).status).to.equal(2);
    });
  });
});
