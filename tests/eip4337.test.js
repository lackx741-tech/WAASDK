import { describe, it, expect } from "vitest";
import { buildUserOp } from "../sdk/eip4337.js";

// ─── buildUserOp ──────────────────────────────────────────────────────────────

describe("buildUserOp", () => {
  const base = {
    sender:   "0x" + "a".repeat(40),
    callData: "0xdeadbeef",
  };

  it("builds a UserOp with default gas fields", () => {
    const op = buildUserOp(base);
    expect(op.sender).toBe(base.sender);
    expect(op.callData).toBe(base.callData);
    expect(op.nonce).toBe(0n);
    expect(op.initCode).toBe("0x");
    expect(op.paymasterAndData).toBe("0x");
    expect(op.signature).toBe("0x");
  });

  it("packs accountGasLimits as a 32-byte hex string", () => {
    const op = buildUserOp(base);
    expect(op.accountGasLimits).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("packs gasFees as a 32-byte hex string", () => {
    const op = buildUserOp(base);
    expect(op.gasFees).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("accepts a custom nonce", () => {
    const op = buildUserOp({ ...base, nonce: 7n });
    expect(op.nonce).toBe(7n);
  });

  it("accepts custom initCode for account deployment", () => {
    const initCode = "0x" + "ff".repeat(10);
    const op = buildUserOp({ ...base, initCode });
    expect(op.initCode).toBe(initCode);
  });

  it("accepts custom paymasterData", () => {
    const paymasterData = "0x" + "ee".repeat(20);
    const op = buildUserOp({ ...base, paymasterData });
    expect(op.paymasterAndData).toBe(paymasterData);
  });

  it("throws when sender is missing", () => {
    expect(() => buildUserOp({ callData: "0xabc" })).toThrow("sender is required");
  });

  it("throws when callData is missing", () => {
    expect(() => buildUserOp({ sender: base.sender })).toThrow("callData is required");
  });

  it("verifies packed gas values decode correctly", () => {
    const verificationGasLimit = 200_000n;
    const callGasLimit         = 300_000n;
    const op = buildUserOp({ ...base, verificationGasLimit, callGasLimit });

    const packed = BigInt(op.accountGasLimits);
    const decodedVerification = packed >> 128n;
    const decodedCall         = packed & ((1n << 128n) - 1n);

    expect(decodedVerification).toBe(verificationGasLimit);
    expect(decodedCall).toBe(callGasLimit);
  });
});
