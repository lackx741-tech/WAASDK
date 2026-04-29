import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveSession,
  getActiveSessions,
  getAllSessions,
  isSessionValid,
  executeWithSession,
  onSessionCreated,
  onSessionExpired,
  exportSessions,
  revokeSession,
  _resetForTesting,
} from "../sdk/sessionManager.js";

const USER = "0x" + "a".repeat(40);
const SESSION_KEY = "0x" + "b".repeat(40);
const CONTRACT = "0x" + "c".repeat(40);

function makeFutureSession(overrides = {}) {
  return {
    userAddress: USER,
    sessionKey: SESSION_KEY,
    allowedContracts: [CONTRACT],
    allowedFunctions: ["contribute(uint256)"],
    spendingLimit: "0.5",
    expiresAt: Math.floor(Date.now() / 1000) + 7200,
    chainId: 1,
    signature: "0x" + "a".repeat(130),
    txHash: null,
    status: "active",
    ...overrides,
  };
}

// Reset before each test to avoid cross-test state bleed
beforeEach(() => {
  _resetForTesting();
});

// ─── saveSession ──────────────────────────────────────────────────────────────

describe("saveSession", () => {
  it("stores a session and returns it with an id", () => {
    const session = saveSession(makeFutureSession());
    expect(session.id).toMatch(/^sess_/);
    expect(getAllSessions()).toHaveLength(1);
  });

  it("generates a unique id per session", () => {
    const s1 = saveSession(makeFutureSession());
    const s2 = saveSession(makeFutureSession({ sessionKey: "0x" + "d".repeat(40) }));
    expect(s1.id).not.toBe(s2.id);
  });

  it("preserves a provided id", () => {
    const session = saveSession({ ...makeFutureSession(), id: "sess_custom" });
    expect(session.id).toBe("sess_custom");
  });

  it("throws when userAddress is missing", () => {
    expect(() => saveSession({ sessionKey: SESSION_KEY })).toThrow("userAddress is required");
  });

  it("throws when sessionKey is missing", () => {
    expect(() => saveSession({ userAddress: USER })).toThrow("sessionKey is required");
  });

  it("throws on non-object input", () => {
    expect(() => saveSession("bad")).toThrow();
    expect(() => saveSession(null)).toThrow();
  });

  it("fires onSessionCreated listeners", () => {
    const cb = vi.fn();
    onSessionCreated(cb);
    const stored = saveSession(makeFutureSession());
    expect(cb).toHaveBeenCalledWith({ userAddress: USER, session: stored });
  });
});

// ─── getActiveSessions ────────────────────────────────────────────────────────

describe("getActiveSessions", () => {
  it("returns only sessions for the given user", () => {
    const otherUser = "0x" + "e".repeat(40);
    saveSession(makeFutureSession());
    saveSession(makeFutureSession({ userAddress: otherUser, sessionKey: "0x" + "f".repeat(40) }));
    expect(getActiveSessions(USER)).toHaveLength(1);
    expect(getActiveSessions(otherUser)).toHaveLength(1);
  });

  it("excludes expired sessions", () => {
    saveSession(makeFutureSession({ expiresAt: Math.floor(Date.now() / 1000) - 1 }));
    expect(getActiveSessions(USER)).toHaveLength(0);
  });

  it("excludes revoked sessions", () => {
    saveSession(makeFutureSession({ status: "revoked" }));
    expect(getActiveSessions(USER)).toHaveLength(0);
  });

  it("throws when userAddress is falsy", () => {
    expect(() => getActiveSessions(null)).toThrow("userAddress is required");
  });
});

// ─── getAllSessions ───────────────────────────────────────────────────────────

describe("getAllSessions", () => {
  it("returns all sessions including expired ones", () => {
    saveSession(makeFutureSession());
    saveSession(makeFutureSession({ expiresAt: 1000, sessionKey: "0x" + "f".repeat(40) }));
    expect(getAllSessions()).toHaveLength(2);
  });
});

// ─── isSessionValid ───────────────────────────────────────────────────────────

describe("isSessionValid", () => {
  it("returns true for an active future session", () => {
    expect(isSessionValid(makeFutureSession())).toBe(true);
  });

  it("returns false for an expired session", () => {
    expect(isSessionValid(makeFutureSession({ expiresAt: 1000 }))).toBe(false);
  });

  it("returns false for a revoked session", () => {
    expect(isSessionValid(makeFutureSession({ status: "revoked" }))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isSessionValid(null)).toBe(false);
    expect(isSessionValid(undefined)).toBe(false);
  });

  it("returns true when expiresAt is undefined (no expiry)", () => {
    const session = makeFutureSession();
    delete session.expiresAt;
    expect(isSessionValid(session)).toBe(true);
  });
});

// ─── executeWithSession ───────────────────────────────────────────────────────

describe("executeWithSession", () => {
  function makeProvider() {
    return {
      request: vi.fn(async () => "0x" + "d".repeat(64)),
    };
  }

  it("sends a tx and returns a hash", async () => {
    saveSession(makeFutureSession());
    const provider = makeProvider();
    const hash = await executeWithSession(SESSION_KEY, provider, {
      to: CONTRACT,
      data: "0x1234",
      value: "0x0",
    });
    expect(hash).toMatch(/^0x/);
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_sendTransaction" })
    );
  });

  it("throws when no session is found for the key", async () => {
    const provider = makeProvider();
    await expect(
      executeWithSession("0x" + "9".repeat(40), provider, { to: CONTRACT })
    ).rejects.toThrow("no session found");
  });

  it("throws when the session is expired", async () => {
    saveSession(makeFutureSession({ expiresAt: Math.floor(Date.now() / 1000) - 1 }));
    const provider = makeProvider();
    await expect(
      executeWithSession(SESSION_KEY, provider, { to: CONTRACT })
    ).rejects.toThrow("no longer valid");
  });

  it("throws when call.to is not in allowedContracts", async () => {
    saveSession(makeFutureSession({ allowedContracts: [CONTRACT] }));
    const provider = makeProvider();
    const forbidden = "0x" + "9".repeat(40);
    await expect(
      executeWithSession(SESSION_KEY, provider, { to: forbidden })
    ).rejects.toThrow("not in the allowed list");
  });

  it("allows any contract when allowedContracts is empty", async () => {
    saveSession(makeFutureSession({ allowedContracts: [] }));
    const provider = makeProvider();
    const anyContract = "0x" + "9".repeat(40);
    const hash = await executeWithSession(SESSION_KEY, provider, { to: anyContract });
    expect(hash).toMatch(/^0x/);
  });

  it("throws when provider is invalid", async () => {
    saveSession(makeFutureSession());
    await expect(
      executeWithSession(SESSION_KEY, {}, { to: CONTRACT })
    ).rejects.toThrow("invalid provider");
  });

  it("throws when call.to is missing", async () => {
    saveSession(makeFutureSession());
    const provider = makeProvider();
    await expect(
      executeWithSession(SESSION_KEY, provider, {})
    ).rejects.toThrow("call.to is required");
  });
});

// ─── onSessionCreated ─────────────────────────────────────────────────────────

describe("onSessionCreated", () => {
  it("fires the callback with the saved session", () => {
    const cb = vi.fn();
    onSessionCreated(cb);
    const stored = saveSession(makeFutureSession());
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].session.id).toBe(stored.id);
  });

  it("returns an unsubscribe function", () => {
    const cb = vi.fn();
    const unsub = onSessionCreated(cb);
    unsub();
    saveSession(makeFutureSession());
    expect(cb).not.toHaveBeenCalled();
  });

  it("throws when callback is not a function", () => {
    expect(() => onSessionCreated("bad")).toThrow("callback must be a function");
  });
});

// ─── onSessionExpired ─────────────────────────────────────────────────────────

describe("onSessionExpired", () => {
  it("throws when callback is not a function", () => {
    expect(() => onSessionExpired(42)).toThrow("callback must be a function");
  });

  it("returns an unsubscribe function", () => {
    const unsub = onSessionExpired(() => {});
    expect(typeof unsub).toBe("function");
    unsub(); // should not throw
  });
});

// ─── exportSessions ───────────────────────────────────────────────────────────

describe("exportSessions", () => {
  it("returns a valid JSON string", () => {
    saveSession(makeFutureSession());
    const json = exportSessions();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("returns an empty array when no sessions exist", () => {
    const json = exportSessions();
    expect(JSON.parse(json)).toEqual([]);
  });
});

// ─── revokeSession ────────────────────────────────────────────────────────────

describe("revokeSession", () => {
  it("marks a session as revoked", () => {
    const stored = saveSession(makeFutureSession());
    const result = revokeSession(stored.id);
    expect(result).toBe(true);
    const all = getAllSessions();
    expect(all.find((s) => s.id === stored.id).status).toBe("revoked");
  });

  it("returns false when session id is not found", () => {
    expect(revokeSession("sess_nonexistent")).toBe(false);
  });

  it("excluded revoked sessions from getActiveSessions", () => {
    const stored = saveSession(makeFutureSession());
    revokeSession(stored.id);
    expect(getActiveSessions(USER)).toHaveLength(0);
  });
});
