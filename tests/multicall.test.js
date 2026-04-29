import { describe, it, expect } from "vitest";
import { buildCall, MULTICALL3_ADDRESS } from "../sdk/multicall.js";

describe("MULTICALL3_ADDRESS", () => {
  it("is the canonical Multicall3 address", () => {
    expect(MULTICALL3_ADDRESS).toBe("0xcA11bde05977b3631167028862bE2a173976CA11");
  });
});

describe("buildCall", () => {
  const target = "0x" + "a".repeat(40);
  const callData = "0xabcdef";

  it("builds a call descriptor with allowFailure=true by default", () => {
    const call = buildCall(target, callData);
    expect(call).toEqual({ target, allowFailure: true, callData });
  });

  it("respects an explicit allowFailure=false", () => {
    const call = buildCall(target, callData, false);
    expect(call.allowFailure).toBe(false);
  });
});
