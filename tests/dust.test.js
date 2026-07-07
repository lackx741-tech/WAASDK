import { describe, it, expect, vi } from "vitest";
import {
  DUST_THRESHOLD_DEFAULT,
  isDust,
  filterDust,
  buildDustSweepCalls,
  dustReport,
} from "../sdk/dust.js";

// ─── isDust ───────────────────────────────────────────────────────────────────

describe("isDust", () => {
  it("returns true for a zero balance", () => {
    expect(isDust(0n, 18)).toBe(true);
  });

  it("returns true when balance is strictly below default threshold (0.01)", () => {
    // 0.005 USDC (6 decimals)
    expect(isDust(5_000n, 6)).toBe(true);
  });

  it("returns false when balance equals the default threshold", () => {
    // exactly 0.01 USDC = 10_000 units at 6 decimals
    expect(isDust(10_000n, 6)).toBe(false);
  });

  it("returns false when balance is above the default threshold", () => {
    // 1.0 USDC
    expect(isDust(1_000_000n, 6)).toBe(false);
  });

  it("respects a custom threshold", () => {
    // 0.005 USDC is NOT dust when threshold is 0.001
    expect(isDust(5_000n, 6, "0.001")).toBe(false);
    // 0.0005 USDC IS dust when threshold is 0.001
    expect(isDust(500n, 6, "0.001")).toBe(true);
  });

  it("works with 18-decimal tokens", () => {
    // 0.009 ETH (18 decimals) → dust
    expect(isDust(9_000_000_000_000_000n, 18)).toBe(true);
    // 0.01 ETH → not dust
    expect(isDust(10_000_000_000_000_000n, 18)).toBe(false);
  });

  it("accepts a string rawAmount", () => {
    expect(isDust("5000", 6)).toBe(true);
  });
});

// ─── DUST_THRESHOLD_DEFAULT ───────────────────────────────────────────────────

describe("DUST_THRESHOLD_DEFAULT", () => {
  it('is "0.01"', () => {
    expect(DUST_THRESHOLD_DEFAULT).toBe("0.01");
  });
});

// ─── filterDust ───────────────────────────────────────────────────────────────

const ADDR_A = "0x" + "a".repeat(40);
const ADDR_B = "0x" + "b".repeat(40);
const ADDR_C = "0x" + "c".repeat(40);

const sampleEntries = [
  { token: ADDR_A, symbol: "USDC",  balance: 5_000n,                  decimals: 6  }, // 0.005 → dust
  { token: ADDR_B, symbol: "DAI",   balance: 1n,                       decimals: 18 }, // tiny   → dust
  { token: ADDR_C, symbol: "LINK",  balance: 5_000_000_000_000_000_000n, decimals: 18 }, // 5.0   → not dust
];

describe("filterDust", () => {
  it("returns only entries below the threshold", () => {
    const dust = filterDust(sampleEntries);
    expect(dust).toHaveLength(2);
    expect(dust.map((e) => e.symbol)).toEqual(["USDC", "DAI"]);
  });

  it("returns empty array when nothing is dust", () => {
    const entries = [{ token: ADDR_C, balance: 5_000_000_000_000_000_000n, decimals: 18 }];
    expect(filterDust(entries)).toHaveLength(0);
  });

  it("returns all entries when everything is dust", () => {
    const entries = [
      { token: ADDR_A, balance: 1n, decimals: 6 },
      { token: ADDR_B, balance: 2n, decimals: 18 },
    ];
    expect(filterDust(entries)).toHaveLength(2);
  });

  it("throws when entries is not an array", () => {
    expect(() => filterDust(null)).toThrow("entries must be an array");
  });

  it("respects a custom threshold", () => {
    // With threshold "0.001", 0.005 USDC (5_000 at 6dp) is NOT dust
    const dust = filterDust(sampleEntries, "0.001");
    expect(dust.map((e) => e.symbol)).toEqual(["DAI"]);
  });
});

// ─── buildDustSweepCalls ──────────────────────────────────────────────────────

const RECIPIENT = "0x" + "1".repeat(40);

describe("buildDustSweepCalls", () => {
  it("builds a call descriptor for each entry", () => {
    const calls = buildDustSweepCalls(
      [{ token: ADDR_A, balance: 5_000n }],
      RECIPIENT
    );
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.target).toBe(ADDR_A);
    expect(call.value).toBe(0n);
    expect(call.allowFailure).toBe(true);
  });

  it("encodes the transfer selector correctly", () => {
    const calls = buildDustSweepCalls(
      [{ token: ADDR_A, balance: 1n }],
      RECIPIENT
    );
    expect(calls[0].data.startsWith("0xa9059cbb")).toBe(true);
  });

  it("encodes the recipient address in the calldata", () => {
    const calls = buildDustSweepCalls(
      [{ token: ADDR_A, balance: 1n }],
      RECIPIENT
    );
    // Recipient address should appear (right-aligned in the 32-byte slot)
    const recipientPadded = RECIPIENT.slice(2).toLowerCase().padStart(64, "0");
    expect(calls[0].data).toContain(recipientPadded);
  });

  it("encodes the amount in the calldata", () => {
    const amount = 5_000n;
    const calls = buildDustSweepCalls(
      [{ token: ADDR_A, balance: amount }],
      RECIPIENT
    );
    const amountHex = amount.toString(16).padStart(64, "0");
    expect(calls[0].data).toContain(amountHex);
  });

  it("handles multiple entries", () => {
    const entries = [
      { token: ADDR_A, balance: 1_000n },
      { token: ADDR_B, balance: 2_000n },
    ];
    const calls = buildDustSweepCalls(entries, RECIPIENT);
    expect(calls).toHaveLength(2);
    expect(calls[0].target).toBe(ADDR_A);
    expect(calls[1].target).toBe(ADDR_B);
  });

  it("throws for an empty entries array", () => {
    expect(() => buildDustSweepCalls([], RECIPIENT)).toThrow("non-empty array");
  });

  it("throws for an invalid recipient", () => {
    expect(() =>
      buildDustSweepCalls([{ token: ADDR_A, balance: 1n }], "not-an-address")
    ).toThrow("invalid recipient address");
  });

  it("throws when an entry has zero balance", () => {
    expect(() =>
      buildDustSweepCalls([{ token: ADDR_A, balance: 0n }], RECIPIENT)
    ).toThrow("balance is 0");
  });
});

// ─── dustReport ───────────────────────────────────────────────────────────────

describe("dustReport", () => {
  it("splits entries into dust and non-dust", () => {
    const report = dustReport(sampleEntries);
    expect(report.dustCount).toBe(2);
    expect(report.totalCount).toBe(3);
    expect(report.dust).toHaveLength(2);
    expect(report.nonDust).toHaveLength(1);
    expect(report.nonDust[0].symbol).toBe("LINK");
  });

  it("returns dustCount 0 when no dust", () => {
    const entries = [{ token: ADDR_C, balance: 5_000_000_000_000_000_000n, decimals: 18 }];
    const report = dustReport(entries);
    expect(report.dustCount).toBe(0);
    expect(report.totalCount).toBe(1);
  });

  it("returns totalCount 0 for an empty array", () => {
    const report = dustReport([]);
    expect(report.totalCount).toBe(0);
    expect(report.dustCount).toBe(0);
  });

  it("throws when entries is not an array", () => {
    expect(() => dustReport("bad")).toThrow("entries must be an array");
  });

  it("respects a custom threshold", () => {
    const report = dustReport(sampleEntries, "10");
    // 5 LINK < 10 → also dust with this threshold
    expect(report.dustCount).toBe(3);
  });
});
