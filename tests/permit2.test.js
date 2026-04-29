import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signPermitSingle,
  signPermitBatch,
  PERMIT2_ADDRESS,
  PERMIT2_MAX_AMOUNT,
} from "../sdk/permit2.js";

// ─── Mock EIP-712 module ─────────────────────────────────────────────────────

vi.mock("../sdk/eip712.js", () => ({
  buildDomain: vi.fn((opts) => opts),
  buildTypedData: vi.fn((_domain, _types, _primary, message) => ({ message })),
  signTypedData: vi.fn(async () =>
    "0x" + "a".repeat(64) + "b".repeat(64) + "1c"
  ),
  splitSignature: vi.fn((sig) => ({
    r: "0x" + "a".repeat(64),
    s: "0x" + "b".repeat(64),
    v: 28,
    signature: sig,
  })),
}));

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const MOCK_PROVIDER = { request: vi.fn() };
const MOCK_ACCOUNT = "0x" + "a".repeat(40);
const CHAIN_ID = 1;
const TOKEN = "0x" + "b".repeat(40);
const SPENDER = "0x" + "c".repeat(40);

describe("PERMIT2_ADDRESS", () => {
  it("is the canonical Uniswap Permit2 address", () => {
    expect(PERMIT2_ADDRESS).toBe("0x000000000022D473030F116dDEE9F6B43aC78BA3");
  });
});

describe("signPermitSingle", () => {
  it("resolves with signature components", async () => {
    const result = await signPermitSingle(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
      token: TOKEN,
      amount: 1000n,
      spender: SPENDER,
    });

    expect(result).toHaveProperty("signature");
    expect(result).toHaveProperty("r");
    expect(result).toHaveProperty("s");
    expect(result).toHaveProperty("v");
    expect(result).toHaveProperty("deadline");
  });

  it("throws when token address is invalid", async () => {
    await expect(
      signPermitSingle(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
        token: "not-an-address",
        amount: 1000n,
        spender: SPENDER,
      })
    ).rejects.toThrow("Permit2: invalid token address");
  });

  it("throws when spender address is invalid", async () => {
    await expect(
      signPermitSingle(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
        token: TOKEN,
        amount: 1000n,
        spender: "bad-spender",
      })
    ).rejects.toThrow("Permit2: invalid spender address");
  });

  it("throws when amount is missing (prevents silent max approval)", async () => {
    await expect(
      signPermitSingle(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
        token: TOKEN,
        spender: SPENDER,
        // amount deliberately omitted
      })
    ).rejects.toThrow("Permit2: amount is required");
  });

  it("accepts PERMIT2_MAX_AMOUNT when explicitly provided by caller", async () => {
    const result = await signPermitSingle(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
      token: TOKEN,
      amount: PERMIT2_MAX_AMOUNT,
      spender: SPENDER,
    });
    expect(result).toHaveProperty("signature");
  });
});

describe("signPermitBatch", () => {
  it("resolves with signature for valid batch", async () => {
    const result = await signPermitBatch(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
      permits: [
        { token: TOKEN, amount: 500n },
        { token: "0x" + "d".repeat(40), amount: 250n },
      ],
      spender: SPENDER,
    });

    expect(result).toHaveProperty("signature");
    expect(result).toHaveProperty("deadline");
  });

  it("throws when permits array is empty", async () => {
    await expect(
      signPermitBatch(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
        permits: [],
        spender: SPENDER,
      })
    ).rejects.toThrow("non-empty");
  });

  it("throws when a token in the batch has no amount", async () => {
    await expect(
      signPermitBatch(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
        permits: [{ token: TOKEN }], // amount missing
        spender: SPENDER,
      })
    ).rejects.toThrow("amount required");
  });

  it("throws when spender is invalid", async () => {
    await expect(
      signPermitBatch(MOCK_PROVIDER, MOCK_ACCOUNT, CHAIN_ID, {
        permits: [{ token: TOKEN, amount: 100n }],
        spender: "bad",
      })
    ).rejects.toThrow("invalid spender");
  });
});
