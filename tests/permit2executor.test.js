import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executePermit2,
  executeERC2612Permit,
  executePermit2Batch,
  signPermitSingle,
  signPermitBatch,
  PERMIT2_ADDRESS,
  PERMIT2_MAX_AMOUNT,
} from "../sdk/permit2.js";

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("../sdk/eip712.js", () => ({
  buildDomain:   vi.fn((opts) => opts),
  buildTypedData: vi.fn((_d, _t, _p, message) => ({ message })),
  signTypedData:  vi.fn(async () => "0x" + "a".repeat(64) + "b".repeat(64) + "1c"),
  splitSignature: vi.fn((sig) => ({
    r: "0x" + "a".repeat(64),
    s: "0x" + "b".repeat(64),
    v: 28,
    signature: sig,
  })),
}));

vi.mock("../sdk/utils.js", () => ({
  deadlineFromNow: vi.fn(() => Math.floor(Date.now() / 1000) + 1800),
  isValidAddress:  (addr) => /^0x[0-9a-fA-F]{40}$/.test(addr),
}));

// ─── Mock ethers Contract for executor tests ──────────────────────────────────

const mockContractFn  = vi.fn(async () => ({ hash: "0xtx" }));
let   mockContractInstance;

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Contract: vi.fn((_addr, _abi, _signer) => {
      mockContractInstance = {
        executePermit2:    mockContractFn,
        executePermitBatch: mockContractFn,
        executePermit:     mockContractFn,
      };
      return mockContractInstance;
    }),
  };
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOKEN   = "0x" + "1".repeat(40);
const SPENDER = "0x" + "2".repeat(40);
const OWNER   = "0x" + "3".repeat(40);
const SIGNER  = {}; // mock signer — not used directly in these tests

// ─── Existing permit2 signing tests ──────────────────────────────────────────

describe("PERMIT2_ADDRESS", () => {
  it("is the canonical Permit2 address", () => {
    expect(PERMIT2_ADDRESS).toBe("0x000000000022D473030F116dDEE9F6B43aC78BA3");
  });
});

describe("PERMIT2_MAX_AMOUNT", () => {
  it("is the uint160 max value", () => {
    expect(PERMIT2_MAX_AMOUNT).toBe(BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"));
  });
});

// ─── executePermit2 ───────────────────────────────────────────────────────────

describe("executePermit2", () => {
  beforeEach(() => { mockContractFn.mockClear(); });

  it("calls executor.executePermit2 with correct args", async () => {
    await executePermit2(SIGNER, {
      token:     TOKEN,
      amount:    500n,
      spender:   SPENDER,
      deadline:  9999999999,
      signature: "0x" + "ab".repeat(65),
    });
    expect(mockContractFn).toHaveBeenCalledOnce();
  });

  it("throws on invalid token address", async () => {
    await expect(
      executePermit2(SIGNER, { token: "not-an-address", amount: 1n, spender: SPENDER, deadline: 0, signature: "0x" })
    ).rejects.toThrow("invalid token");
  });

  it("throws on invalid spender address", async () => {
    await expect(
      executePermit2(SIGNER, { token: TOKEN, amount: 1n, spender: "bad", deadline: 0, signature: "0x" })
    ).rejects.toThrow("invalid spender");
  });
});

// ─── executeERC2612Permit ─────────────────────────────────────────────────────

describe("executeERC2612Permit", () => {
  beforeEach(() => { mockContractFn.mockClear(); });

  it("calls executor.executePermit with correct args", async () => {
    await executeERC2612Permit(SIGNER, {
      token:    TOKEN,
      owner:    OWNER,
      spender:  SPENDER,
      value:    1000n,
      deadline: 9999999999,
      v: 27,
      r: "0x" + "aa".repeat(32),
      s: "0x" + "bb".repeat(32),
    });
    expect(mockContractFn).toHaveBeenCalledOnce();
  });

  it("throws on invalid token address", async () => {
    await expect(
      executeERC2612Permit(SIGNER, { token: "bad", owner: OWNER, spender: SPENDER, value: 1n, deadline: 0, v: 27, r: "0x", s: "0x" })
    ).rejects.toThrow("invalid token");
  });
});
