/**
 * Unit tests for sdk/sessionAuth.js and sdk/imageHash.js
 *
 * Covers:
 *   - computeImageHash produces deterministic bytes32
 *   - buildSessionImageHash includes both owner and session key
 *   - signSessionWithImageHash returns a valid signature structure (mock provider)
 *   - getSessionPermissions builds correct Permission struct
 */

import { describe, it, expect, vi } from "vitest";
import {
  computeImageHash,
  buildSessionImageHash,
} from "../sdk/imageHash.js";
import {
  signSessionWithImageHash,
  getSessionPermissions,
} from "../sdk/sessionAuth.js";

// ─── computeImageHash ─────────────────────────────────────────────────────────

describe("computeImageHash", () => {
  const ownerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const threshold = 2;

  it("returns a bytes32 hex string", () => {
    const hash = computeImageHash([{ address: ownerAddress, weight: 2 }], threshold);
    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("is deterministic — same inputs produce the same hash", () => {
    const h1 = computeImageHash([{ address: ownerAddress, weight: 2 }], threshold);
    const h2 = computeImageHash([{ address: ownerAddress, weight: 2 }], threshold);
    expect(h1).toBe(h2);
  });

  it("changes when threshold changes", () => {
    const h1 = computeImageHash([{ address: ownerAddress, weight: 2 }], 1);
    const h2 = computeImageHash([{ address: ownerAddress, weight: 2 }], 2);
    expect(h1).not.toBe(h2);
  });

  it("changes when signer weight changes", () => {
    const h1 = computeImageHash([{ address: ownerAddress, weight: 1 }], 1);
    const h2 = computeImageHash([{ address: ownerAddress, weight: 2 }], 1);
    expect(h1).not.toBe(h2);
  });

  it("is order-independent (sorts signers by address)", () => {
    const addr1 = "0x1000000000000000000000000000000000000001";
    const addr2 = "0x2000000000000000000000000000000000000002";
    const h1 = computeImageHash(
      [{ address: addr1, weight: 1 }, { address: addr2, weight: 1 }],
      1
    );
    const h2 = computeImageHash(
      [{ address: addr2, weight: 1 }, { address: addr1, weight: 1 }],
      1
    );
    expect(h1).toBe(h2);
  });

  it("throws on zero threshold", () => {
    expect(() => computeImageHash([{ address: ownerAddress, weight: 1 }], 0)).toThrow();
  });

  it("throws on empty signers array", () => {
    expect(() => computeImageHash([], 1)).toThrow();
  });
});

// ─── buildSessionImageHash ────────────────────────────────────────────────────

describe("buildSessionImageHash", () => {
  const owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const session = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  it("returns a bytes32 hex string", () => {
    const hash = buildSessionImageHash(owner, session);
    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("differs when only owner signs vs owner+session", () => {
    const ownerOnly = computeImageHash([{ address: owner, weight: 2 }], 2);
    const withSession = buildSessionImageHash(owner, session);
    expect(ownerOnly).not.toBe(withSession);
  });

  it("differs when session key changes", () => {
    const session2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const h1 = buildSessionImageHash(owner, session);
    const h2 = buildSessionImageHash(owner, session2);
    expect(h1).not.toBe(h2);
  });

  it("is deterministic with same inputs", () => {
    expect(buildSessionImageHash(owner, session)).toBe(buildSessionImageHash(owner, session));
  });

  it("respects custom weights and threshold", () => {
    const h1 = buildSessionImageHash(owner, session, { ownerWeight: 2, sessionWeight: 1, threshold: 2 });
    const h2 = buildSessionImageHash(owner, session, { ownerWeight: 3, sessionWeight: 2, threshold: 3 });
    expect(h1).not.toBe(h2);
  });
});

// ─── signSessionWithImageHash ─────────────────────────────────────────────────

describe("signSessionWithImageHash", () => {
  const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const sessionPublicKey = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const imageHash = "0x" + "ab".repeat(32);
  const MOCK_SIG = "0x" + "cc".repeat(65);

  function mockProvider() {
    return {
      request: vi.fn().mockResolvedValue(MOCK_SIG),
    };
  }

  it("returns a valid signature structure", async () => {
    const provider = mockProvider();
    const result = await signSessionWithImageHash(provider, account, {
      sessionPublicKey,
      allowedContracts: ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"],
      allowedFunctions: ["contribute(uint256)"],
      spendingLimit: "0.5",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      chainId: 1,
      imageHash,
    });

    expect(result.signature).toBe(MOCK_SIG);
    expect(result.sessionKey).toBe(sessionPublicKey);
    expect(result.imageHash).toBe(imageHash);
    expect(result.payload).toBeDefined();
    expect(result.attestation).toBeDefined();
  });

  it("calls personal_sign exactly once", async () => {
    const provider = mockProvider();
    await signSessionWithImageHash(provider, account, {
      sessionPublicKey,
      allowedContracts: [],
      allowedFunctions: [],
      spendingLimit: "0",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      chainId: 1,
      imageHash,
    });

    expect(provider.request).toHaveBeenCalledTimes(1);
    expect(provider.request.mock.calls[0][0].method).toBe("personal_sign");
  });

  it("attestation contains all expected fields", async () => {
    const provider = mockProvider();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const result = await signSessionWithImageHash(provider, account, {
      sessionPublicKey,
      allowedContracts: ["0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"],
      allowedFunctions: ["foo(uint256)"],
      spendingLimit: "1.0",
      expiresAt,
      chainId: 137,
      imageHash,
    });

    expect(result.attestation.sessionPublicKey).toBe(sessionPublicKey);
    expect(result.attestation.allowedContracts).toContain("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc");
    expect(result.attestation.allowedFunctions).toContain("foo(uint256)");
    expect(result.attestation.spendingLimit).toBe("1.0");
    expect(result.attestation.expiresAt).toBe(expiresAt);
    expect(result.attestation.chainId).toBe(137);
  });

  it("payload has the correct shape", async () => {
    const provider = mockProvider();
    const result = await signSessionWithImageHash(provider, account, {
      sessionPublicKey,
      allowedContracts: [],
      allowedFunctions: [],
      spendingLimit: "0",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      chainId: 1,
      imageHash,
    });

    const { payload } = result;
    expect(payload.kind).toBe(0);
    expect(payload.noChainId).toBe(false);
    expect(Array.isArray(payload.calls)).toBe(true);
    expect(payload.calls.length).toBe(0);
    expect(payload.imageHash).toBe(imageHash);
  });

  it("throws when provider is missing", async () => {
    await expect(
      signSessionWithImageHash(null, account, {
        sessionPublicKey,
        allowedContracts: [],
        allowedFunctions: [],
        spendingLimit: "0",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        chainId: 1,
        imageHash,
      })
    ).rejects.toThrow("invalid provider");
  });

  it("throws when imageHash is missing", async () => {
    const provider = mockProvider();
    await expect(
      signSessionWithImageHash(provider, account, {
        sessionPublicKey,
        allowedContracts: [],
        allowedFunctions: [],
        spendingLimit: "0",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        chainId: 1,
        imageHash: "",
      })
    ).rejects.toThrow("imageHash is required");
  });
});

// ─── getSessionPermissions ────────────────────────────────────────────────────

describe("getSessionPermissions", () => {
  const sessionKey = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const allowedContracts = [
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  ];
  const allowedFunctions = ["contribute(uint256)", "claim()"];
  const spendingLimit = "0.5";
  const expiresAt = Math.floor(Date.now() / 1000) + 4 * 3600;

  it("returns a permission struct with the session key as signer", () => {
    const perm = getSessionPermissions(
      sessionKey, allowedContracts, allowedFunctions, spendingLimit, expiresAt
    );
    expect(perm.signer).toBe(sessionKey);
  });

  it("sets the correct deadline", () => {
    const perm = getSessionPermissions(
      sessionKey, allowedContracts, allowedFunctions, spendingLimit, expiresAt
    );
    expect(perm.deadline).toBe(expiresAt);
  });

  it("includes an allowed-contract rule for each contract", () => {
    const perm = getSessionPermissions(
      sessionKey, allowedContracts, allowedFunctions, spendingLimit, expiresAt
    );
    // 2 contract rules + 1 spending limit rule
    expect(perm.rules.length).toBe(3);
  });

  it("includes a cumulative spending limit rule", () => {
    const perm = getSessionPermissions(
      sessionKey, allowedContracts, allowedFunctions, spendingLimit, expiresAt
    );
    const limitRule = perm.rules.find((r) => r.cumulative === true);
    expect(limitRule).toBeDefined();
    expect(limitRule.operation).toBe(1); // LESS_THAN_OR_EQUAL
  });

  it("does not add a spending limit rule when limit is 0", () => {
    const perm = getSessionPermissions(
      sessionKey, allowedContracts, allowedFunctions, "0", expiresAt
    );
    const limitRule = perm.rules.find((r) => r.cumulative === true);
    expect(limitRule).toBeUndefined();
  });

  it("exposes allowedContracts and allowedFunctions on the struct", () => {
    const perm = getSessionPermissions(
      sessionKey, allowedContracts, allowedFunctions, spendingLimit, expiresAt
    );
    expect(perm.allowedContracts).toEqual(allowedContracts);
    expect(perm.allowedFunctions).toEqual(allowedFunctions);
  });
});
