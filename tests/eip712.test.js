import { describe, it, expect } from "vitest";
import {
  encodeType,
  buildDomain,
  buildTypedData,
  splitSignature,
} from "../sdk/eip712.js";

describe("encodeType", () => {
  it("encodes a simple type string", () => {
    const result = encodeType("Mail", { from: "address", to: "address", contents: "string" });
    expect(result).toBe("Mail(address from,address to,string contents)");
  });

  it("handles a single-field type", () => {
    expect(encodeType("Foo", { bar: "uint256" })).toBe("Foo(uint256 bar)");
  });
});

describe("buildDomain", () => {
  it("constructs a domain object with all fields", () => {
    const domain = buildDomain({
      name: "TestApp",
      version: "1",
      chainId: 1,
      verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    });

    expect(domain).toEqual({
      name: "TestApp",
      version: "1",
      chainId: 1,
      verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    });
  });

  it("includes salt when provided", () => {
    const domain = buildDomain({
      name: "A",
      version: "1",
      chainId: 1,
      verifyingContract: "0x" + "0".repeat(40),
      salt: "0x" + "1".repeat(64),
    });
    expect(domain.salt).toBeDefined();
  });

  it("omits salt when not provided", () => {
    const domain = buildDomain({ name: "A", version: "1", chainId: 1, verifyingContract: "0x" + "0".repeat(40) });
    expect(domain.salt).toBeUndefined();
  });
});

describe("buildTypedData", () => {
  it("always includes EIP712Domain in types", () => {
    const domain = buildDomain({ name: "App", version: "1", chainId: 1, verifyingContract: "0x" + "0".repeat(40) });
    const types = { Foo: [{ name: "bar", type: "uint256" }] };
    const td = buildTypedData(domain, types, "Foo", { bar: 42 });

    expect(td.types.EIP712Domain).toBeDefined();
    expect(td.types.Foo).toBeDefined();
    expect(td.primaryType).toBe("Foo");
    expect(td.message.bar).toBe(42);
  });
});

describe("splitSignature", () => {
  it("splits a valid 65-byte hex signature", () => {
    const r = "a".repeat(64);
    const s = "b".repeat(64);
    const v = "1c"; // 28
    const sig = `0x${r}${s}${v}`;
    const result = splitSignature(sig);

    expect(result.r).toBe(`0x${r}`);
    expect(result.s).toBe(`0x${s}`);
    expect(result.v).toBe(28);
  });

  it("handles signatures without 0x prefix", () => {
    const raw = "a".repeat(64) + "b".repeat(64) + "1b";
    const result = splitSignature(raw);
    expect(result.v).toBe(27);
  });

  it("throws on invalid signature length", () => {
    expect(() => splitSignature("0xdeadbeef")).toThrow();
  });
});
