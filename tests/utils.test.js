import { describe, it, expect } from "vitest";
import {
  isValidAddress,
  shortenAddress,
  parseAmount,
  formatAmount,
  getChainInfo,
  getNativeCurrencySymbol,
  getExplorerUrl,
  getTxUrl,
  deadlineFromNow,
  SUPPORTED_CHAINS,
} from "../sdk/utils.js";

describe("isValidAddress", () => {
  it("accepts a valid lowercase address", () => {
    expect(isValidAddress("0xabcdef1234567890abcdef1234567890abcdef12")).toBe(true);
  });

  it("accepts a valid checksummed address", () => {
    expect(isValidAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")).toBe(true);
  });

  it("rejects an address without 0x prefix", () => {
    expect(isValidAddress("abcdef1234567890abcdef1234567890abcdef12")).toBe(false);
  });

  it("rejects an address that is too short", () => {
    expect(isValidAddress("0xabc")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidAddress(null)).toBe(false);
    expect(isValidAddress(undefined)).toBe(false);
    expect(isValidAddress(42)).toBe(false);
  });
});

describe("shortenAddress", () => {
  const addr = "0x1234567890abcdef1234567890abcdef12345678";

  it("returns 0x1234…5678 by default", () => {
    expect(shortenAddress(addr)).toBe("0x1234…5678");
  });

  it("respects custom prefix and suffix lengths", () => {
    expect(shortenAddress(addr, 4, 4)).toBe("0x12…5678");
  });

  it("returns the original string for invalid addresses", () => {
    expect(shortenAddress("not-an-address")).toBe("not-an-address");
  });
});

describe("parseAmount / formatAmount", () => {
  it("parses 1.5 ETH to 1.5e18 wei", () => {
    expect(parseAmount("1.5", 18)).toBe(1500000000000000000n);
  });

  it("parses an integer amount", () => {
    expect(parseAmount("100", 6)).toBe(100000000n);
  });

  it("formats 1e18 back to '1.0000'", () => {
    expect(formatAmount(1000000000000000000n, 18, 4)).toBe("1.0000");
  });

  it("formats 1.5e18 back to '1.5000'", () => {
    expect(formatAmount(1500000000000000000n, 18, 4)).toBe("1.5000");
  });

  it("round-trips through parse and format", () => {
    const raw = parseAmount("42.1337", 18);
    const formatted = formatAmount(raw, 18, 4);
    expect(formatted).toBe("42.1337");
  });
});

describe("getChainInfo", () => {
  it("returns Ethereum info for chainId 1", () => {
    const info = getChainInfo(1);
    expect(info).toBeDefined();
    expect(info.name).toBe("Ethereum");
  });

  it("returns null for unknown chain", () => {
    expect(getChainInfo(99999)).toBeNull();
  });
});

describe("getNativeCurrencySymbol", () => {
  it.each([
    [1, "ETH"],
    [56, "BNB"],
    [137, "MATIC"],
    [43114, "AVAX"],
  ])("chainId %i → %s", (chainId, symbol) => {
    expect(getNativeCurrencySymbol(chainId)).toBe(symbol);
  });

  it("falls back to ETH for unknown chain", () => {
    expect(getNativeCurrencySymbol(99999)).toBe("ETH");
  });
});

describe("getExplorerUrl / getTxUrl", () => {
  it("returns Etherscan URL for chainId 1", () => {
    expect(getExplorerUrl(1)).toBe("https://etherscan.io");
  });

  it("builds a correct tx URL", () => {
    const hash = "0x" + "a".repeat(64);
    expect(getTxUrl(hash, 1)).toBe(`https://etherscan.io/tx/${hash}`);
  });
});

describe("deadlineFromNow", () => {
  it("returns a timestamp ~30 minutes in the future by default", () => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = deadlineFromNow();
    expect(deadline).toBeGreaterThanOrEqual(now + 29 * 60);
    expect(deadline).toBeLessThanOrEqual(now + 31 * 60);
  });

  it("accepts a custom offset", () => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = deadlineFromNow(60);
    expect(deadline).toBeGreaterThanOrEqual(now + 59 * 60);
  });
});

describe("SUPPORTED_CHAINS", () => {
  it("contains the four required chains", () => {
    [1, 56, 137, 43114].forEach((id) => {
      expect(SUPPORTED_CHAINS[id]).toBeDefined();
    });
  });
});
