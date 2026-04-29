import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signAuthorization,
  executeBatch,
  createSessionKey,
  revokeSessionKey,
  getSessionKeyStatus,
  sponsorTransaction,
} from "../sdk/eip7702.js";

// ─── Mock provider ────────────────────────────────────────────────────────────

function makeProvider(overrides = {}) {
  return {
    request: vi.fn(async ({ method }) => {
      if (method === "eth_signTypedData_v4") return "0x" + "a".repeat(130);
      if (method === "eth_sendTransaction") return "0x" + "b".repeat(64);
      if (method === "eth_call") return "0x" + "1".padStart(64, "0");
      return null;
    }),
    ...overrides,
  };
}

const ACCOUNT = "0x" + "a".repeat(40);
const CONTRACT = "0x" + "b".repeat(40);
const SESSION_KEY = "0x" + "c".repeat(40);

// ─── signAuthorization ────────────────────────────────────────────────────────

describe("signAuthorization", () => {
  it("returns authorization and signature for valid inputs", async () => {
    const provider = makeProvider();
    const result = await signAuthorization(provider, ACCOUNT, {
      contractAddress: CONTRACT,
      chainId: 1,
      nonce: 0,
    });

    expect(result).toHaveProperty("authorization");
    expect(result).toHaveProperty("signature");
    expect(result.authorization.contractAddress).toBe(CONTRACT);
    expect(result.authorization.chainId).toBe(1);
    expect(result.authorization.nonce).toBe(0);
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_signTypedData_v4" })
    );
  });

  it("includes expiry in authorization when provided", async () => {
    const provider = makeProvider();
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const { authorization } = await signAuthorization(provider, ACCOUNT, {
      contractAddress: CONTRACT,
      chainId: 1,
      nonce: 1,
      expiry,
    });
    expect(authorization.expiry).toBe(expiry);
  });

  it("omits expiry when not provided", async () => {
    const provider = makeProvider();
    const { authorization } = await signAuthorization(provider, ACCOUNT, {
      contractAddress: CONTRACT,
      chainId: 1,
      nonce: 0,
    });
    expect(authorization.expiry).toBeUndefined();
  });

  it("throws on invalid provider", async () => {
    await expect(signAuthorization(null, ACCOUNT, { contractAddress: CONTRACT, chainId: 1, nonce: 0 }))
      .rejects.toThrow("invalid provider");
  });

  it("throws on invalid account address", async () => {
    const provider = makeProvider();
    await expect(signAuthorization(provider, "not-an-address", { contractAddress: CONTRACT, chainId: 1, nonce: 0 }))
      .rejects.toThrow("invalid account address");
  });

  it("throws on invalid contractAddress", async () => {
    const provider = makeProvider();
    await expect(signAuthorization(provider, ACCOUNT, { contractAddress: "bad", chainId: 1, nonce: 0 }))
      .rejects.toThrow("invalid contractAddress");
  });

  it("throws on non-positive chainId", async () => {
    const provider = makeProvider();
    await expect(signAuthorization(provider, ACCOUNT, { contractAddress: CONTRACT, chainId: 0, nonce: 0 }))
      .rejects.toThrow("invalid chainId");
  });

  it("throws on negative nonce", async () => {
    const provider = makeProvider();
    await expect(signAuthorization(provider, ACCOUNT, { contractAddress: CONTRACT, chainId: 1, nonce: -1 }))
      .rejects.toThrow("invalid nonce");
  });
});

// ─── executeBatch ─────────────────────────────────────────────────────────────

describe("executeBatch", () => {
  it("returns a tx hash for valid calls", async () => {
    const provider = makeProvider();
    const hash = await executeBatch(provider, ACCOUNT, [
      { to: CONTRACT, data: "0x1234", value: "0x0" },
    ]);
    expect(hash).toMatch(/^0x[0-9a-f]+$/i);
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_sendTransaction" })
    );
  });

  it("sends to the account address (self) per EIP-7702", async () => {
    const provider = makeProvider();
    await executeBatch(provider, ACCOUNT, [
      { to: CONTRACT, data: "0x", value: "0x0" },
    ]);
    const call = provider.request.mock.calls[0][0];
    expect(call.params[0].to).toBe(ACCOUNT);
  });

  it("sums values across calls", async () => {
    const provider = makeProvider();
    await executeBatch(provider, ACCOUNT, [
      { to: CONTRACT, data: "0x", value: "0x1" },
      { to: CONTRACT, data: "0x", value: "0x2" },
    ]);
    const call = provider.request.mock.calls[0][0];
    expect(call.params[0].value).toBe("0x3");
  });

  it("throws on empty calls array", async () => {
    const provider = makeProvider();
    await expect(executeBatch(provider, ACCOUNT, [])).rejects.toThrow("non-empty array");
  });

  it("throws on invalid call.to address", async () => {
    const provider = makeProvider();
    await expect(executeBatch(provider, ACCOUNT, [{ to: "bad", data: "0x" }]))
      .rejects.toThrow("invalid call.to address");
  });

  it("throws on invalid provider", async () => {
    await expect(executeBatch({}, ACCOUNT, [{ to: CONTRACT }])).rejects.toThrow("invalid provider");
  });
});

// ─── createSessionKey ─────────────────────────────────────────────────────────

describe("createSessionKey", () => {
  const futureExpiry = Math.floor(Date.now() / 1000) + 7200;

  it("returns a session object with expected fields", async () => {
    const provider = makeProvider();
    const session = await createSessionKey(provider, ACCOUNT, {
      sessionPublicKey: SESSION_KEY,
      allowedContracts: [CONTRACT],
      allowedFunctions: ["contribute(uint256)"],
      spendingLimit: "0.5",
      expiresAt: futureExpiry,
      chainId: 1,
    });

    expect(session.id).toMatch(/^sess_/);
    expect(session.userAddress).toBe(ACCOUNT);
    expect(session.sessionKey).toBe(SESSION_KEY);
    expect(session.allowedContracts).toEqual([CONTRACT]);
    expect(session.allowedFunctions).toEqual(["contribute(uint256)"]);
    expect(session.spendingLimit).toBe("0.5");
    expect(session.expiresAt).toBe(futureExpiry);
    expect(session.chainId).toBe(1);
    expect(session.signature).toBeTruthy();
    expect(session.status).toBe("active");
  });

  it("calls eth_signTypedData_v4 on the provider", async () => {
    const provider = makeProvider();
    await createSessionKey(provider, ACCOUNT, {
      sessionPublicKey: SESSION_KEY,
      expiresAt: futureExpiry,
      chainId: 1,
    });
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_signTypedData_v4" })
    );
  });

  it("throws when expiresAt is in the past", async () => {
    const provider = makeProvider();
    await expect(
      createSessionKey(provider, ACCOUNT, {
        sessionPublicKey: SESSION_KEY,
        expiresAt: 1000,
        chainId: 1,
      })
    ).rejects.toThrow("future Unix timestamp");
  });

  it("throws on invalid sessionPublicKey", async () => {
    const provider = makeProvider();
    await expect(
      createSessionKey(provider, ACCOUNT, {
        sessionPublicKey: "bad",
        expiresAt: futureExpiry,
        chainId: 1,
      })
    ).rejects.toThrow("invalid sessionPublicKey");
  });
});

// ─── revokeSessionKey ─────────────────────────────────────────────────────────

describe("revokeSessionKey", () => {
  it("returns a tx hash", async () => {
    const provider = makeProvider();
    const hash = await revokeSessionKey(provider, ACCOUNT, SESSION_KEY);
    expect(hash).toMatch(/^0x/);
  });

  it("sends a transaction to the account address", async () => {
    const provider = makeProvider();
    await revokeSessionKey(provider, ACCOUNT, SESSION_KEY);
    const call = provider.request.mock.calls[0][0];
    expect(call.params[0].from).toBe(ACCOUNT);
    expect(call.params[0].to).toBe(ACCOUNT);
  });

  it("throws on invalid sessionPublicKey", async () => {
    const provider = makeProvider();
    await expect(revokeSessionKey(provider, ACCOUNT, "bad")).rejects.toThrow("invalid sessionPublicKey");
  });
});

// ─── getSessionKeyStatus ──────────────────────────────────────────────────────

describe("getSessionKeyStatus", () => {
  it("returns true when eth_call returns non-zero", async () => {
    const provider = makeProvider();
    const active = await getSessionKeyStatus(provider, ACCOUNT, SESSION_KEY);
    expect(active).toBe(true);
  });

  it("returns false when eth_call returns all-zeros", async () => {
    const provider = makeProvider({
      request: vi.fn(async () => "0x" + "0".repeat(64)),
    });
    const active = await getSessionKeyStatus(provider, ACCOUNT, SESSION_KEY);
    expect(active).toBe(false);
  });

  it("throws on invalid account address", async () => {
    const provider = makeProvider();
    await expect(getSessionKeyStatus(provider, "bad", SESSION_KEY)).rejects.toThrow("invalid account address");
  });
});

// ─── sponsorTransaction ───────────────────────────────────────────────────────

describe("sponsorTransaction", () => {
  it("returns a tx hash", async () => {
    const provider = makeProvider();
    const hash = await sponsorTransaction(provider, ACCOUNT, {
      from: SESSION_KEY,
      to: CONTRACT,
      data: "0x1234",
      value: "0x0",
    });
    expect(hash).toMatch(/^0x/);
  });

  it("sends from the sponsor address", async () => {
    const provider = makeProvider();
    await sponsorTransaction(provider, ACCOUNT, {
      from: SESSION_KEY,
      to: CONTRACT,
      data: "0x",
    });
    const call = provider.request.mock.calls[0][0];
    expect(call.params[0].from).toBe(ACCOUNT);
  });

  it("throws on invalid sponsorSigner", async () => {
    const provider = makeProvider();
    await expect(
      sponsorTransaction(provider, "bad", { from: SESSION_KEY, to: CONTRACT })
    ).rejects.toThrow("invalid sponsorSigner");
  });

  it("throws on invalid userTx.from", async () => {
    const provider = makeProvider();
    await expect(
      sponsorTransaction(provider, ACCOUNT, { from: "bad", to: CONTRACT })
    ).rejects.toThrow("userTx.from must be a valid address");
  });

  it("throws on invalid userTx.to", async () => {
    const provider = makeProvider();
    await expect(
      sponsorTransaction(provider, ACCOUNT, { from: SESSION_KEY, to: "bad" })
    ).rejects.toThrow("userTx.to must be a valid address");
  });
});
