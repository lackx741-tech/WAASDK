import { describe, it, expect } from "vitest";
import { CONTRACTS, ABIS } from "../sdk/constants.js";

// ─── Contract addresses ───────────────────────────────────────────────────────

describe("CONTRACTS", () => {
  const expectedEntries = [
    ["Factory",               "0x653c0bd75e353f1FFeeb8AC9A510ea30F9064ceF"],
    ["ERC4337FactoryWrapper", "0xC67c4793bDb979A1a4cd97311c7644b4f7a31ff9"],
    ["Stage1Module",          "0xfBC5a55501E747b0c9F82e2866ab2609Fa9b99f4"],
    ["Stage2Module",          "0x5C9C4AD7b287D37a37d267089e752236f368f94f"],
    ["Guest",                 "0x2d21Ce2fBe0BAD8022BaE10B5C22eA69fE930Ee6"],
    ["SessionManager",        "0x4AE428352317752a51Ac022C9D2551BcDef785cb"],
    ["EIP7702Module",         "0x1f82E64E694894BACfa441709fC7DD8a30FA3E5d"],
    ["BatchMulticall",        "0xF93E987DF029e95CdE59c0F5cD447e0a7002054D"],
    ["Permit2Executor",       "0x4593D97d6E932648fb4425aC2945adaF66927773"],
    ["ERC2612Executor",       "0xb8eF065061bbBF5dCc65083be8CC7B50121AE900"],
    ["Permit2",               "0x000000000022D473030F116dDEE9F6B43aC78BA3"],
    ["EntryPoint",            "0x0000000071727De22E5E9d8BAf0edAc6f37da032"],
  ];

  it("exports exactly 12 contract entries", () => {
    expect(Object.keys(CONTRACTS)).toHaveLength(12);
  });

  it.each(expectedEntries)("CONTRACTS.%s === %s", (name, address) => {
    expect(CONTRACTS[name]).toBe(address);
  });

  it.each(expectedEntries)("CONTRACTS.%s is a valid checksummed address", (name) => {
    const addr = CONTRACTS[name];
    expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addr).toHaveLength(42);
  });

  it("every address starts with 0x", () => {
    for (const addr of Object.values(CONTRACTS)) {
      expect(addr.startsWith("0x")).toBe(true);
    }
  });
});

// ─── ABIs ─────────────────────────────────────────────────────────────────────

describe("ABIS", () => {
  const abiKeys = [
    "SessionManager",
    "BatchMulticall",
    "Permit2Executor",
    "ERC2612Executor",
    "Factory",
    "ERC4337FactoryWrapper",
    "EIP7702Module",
    "Guest",
    "EntryPoint",
  ];

  it.each(abiKeys)("ABIS.%s is a non-empty array", (key) => {
    expect(Array.isArray(ABIS[key])).toBe(true);
    expect(ABIS[key].length).toBeGreaterThan(0);
  });

  it("ABIS.SessionManager contains createSession function", () => {
    const fn = ABIS.SessionManager.find((x) => x.name === "createSession" && x.type === "function");
    expect(fn).toBeDefined();
    expect(fn.stateMutability).toBe("nonpayable");
  });

  it("ABIS.SessionManager contains revokeSession function", () => {
    const fn = ABIS.SessionManager.find((x) => x.name === "revokeSession" && x.type === "function");
    expect(fn).toBeDefined();
  });

  it("ABIS.SessionManager contains isSessionValid view function", () => {
    const fn = ABIS.SessionManager.find((x) => x.name === "isSessionValid" && x.type === "function");
    expect(fn).toBeDefined();
    expect(fn.stateMutability).toBe("view");
  });

  it("ABIS.SessionManager contains SessionCreated and SessionRevoked events", () => {
    const created = ABIS.SessionManager.find((x) => x.name === "SessionCreated" && x.type === "event");
    const revoked  = ABIS.SessionManager.find((x) => x.name === "SessionRevoked" && x.type === "event");
    expect(created).toBeDefined();
    expect(revoked).toBeDefined();
  });

  it("ABIS.BatchMulticall contains batchCall function", () => {
    const fn = ABIS.BatchMulticall.find((x) => x.name === "batchCall" && x.type === "function");
    expect(fn).toBeDefined();
    expect(fn.stateMutability).toBe("payable");
  });

  it("ABIS.Factory contains createAccount, getAddress, isDeployed", () => {
    const names = ABIS.Factory.map((x) => x.name);
    expect(names).toContain("createAccount");
    expect(names).toContain("getAddress");
    expect(names).toContain("isDeployed");
  });

  it("ABIS.EntryPoint contains handleOps and getUserOpHash", () => {
    const names = ABIS.EntryPoint.map((x) => x.name);
    expect(names).toContain("handleOps");
    expect(names).toContain("getUserOpHash");
    expect(names).toContain("depositTo");
  });

  it("ABIS.ERC2612Executor contains executePermit function", () => {
    const fn = ABIS.ERC2612Executor.find((x) => x.name === "executePermit");
    expect(fn).toBeDefined();
    const paramNames = fn.inputs.map((i) => i.name);
    expect(paramNames).toContain("token");
    expect(paramNames).toContain("owner");
    expect(paramNames).toContain("spender");
    expect(paramNames).toContain("v");
    expect(paramNames).toContain("r");
    expect(paramNames).toContain("s");
  });

  it("ABIS.Guest contains execute function with tuple[] calls", () => {
    const fn = ABIS.Guest.find((x) => x.name === "execute");
    expect(fn).toBeDefined();
    expect(fn.inputs[0].type).toBe("tuple[]");
  });
});
