// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../StorageLib.sol";

/**
 * @title SessionKeyModule
 * @notice Delegate module for managing session keys via delegatecall.
 *
 * Because this module runs inside the orchestrator's delegatecall context
 * it reads and writes the orchestrator's namespaced StorageLib.Layout
 * directly — no cross-contract call required.
 *
 * Function selectors (for fallback registration):
 *   addSessionKey(address,uint256)  → 0x2d2c5565
 *   revokeSessionKey(address)       → 0x5c975abb  (approx — always verify)
 *   isSessionKeyValid(address)      → 0x...
 *
 * ⚠️  Only install this module if you trust it not to escalate privileges.
 *   Because it has write access to sessionKeys it could grant arbitrary
 *   addresses execution rights.  Restrict usage to the account owner.
 */
contract SessionKeyModule {
    // ─── Events ───────────────────────────────────────────────────────────────

    event SessionKeyAdded(address indexed key, uint256 expiry);
    event SessionKeyRevoked(address indexed key);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotOwner();

    // ─── Internal helper ──────────────────────────────────────────────────────

    /**
     * @dev Reverts if msg.sender is not the orchestrator owner.
     *      Reads from the shared namespaced slot.
     */
    function _requireOwner() internal view {
        if (msg.sender != StorageLib.layout().owner) revert NotOwner();
    }

    // ─── Session Key Management ───────────────────────────────────────────────

    /**
     * @notice Grant a session key with an optional expiry timestamp.
     *
     * @param key     Address to grant session-key rights.
     * @param expiry  Unix timestamp after which the key is invalid.
     *                Pass 0 for no expiry.
     */
    function addSessionKey(address key, uint256 expiry) external {
        _requireOwner();
        StorageLib.Layout storage l = StorageLib.layout();
        l.sessionKeys[key] = true;
        l.sessionKeyExpiry[key] = expiry;
        emit SessionKeyAdded(key, expiry);
    }

    /**
     * @notice Revoke an existing session key immediately.
     */
    function revokeSessionKey(address key) external {
        _requireOwner();
        StorageLib.Layout storage l = StorageLib.layout();
        delete l.sessionKeys[key];
        delete l.sessionKeyExpiry[key];
        emit SessionKeyRevoked(key);
    }

    /**
     * @notice Query whether a session key is currently valid.
     * @return True if the key exists and has not expired.
     */
    function isSessionKeyValid(address key) external view returns (bool) {
        StorageLib.Layout storage l = StorageLib.layout();
        if (!l.sessionKeys[key]) return false;
        uint256 expiry = l.sessionKeyExpiry[key];
        return expiry == 0 || block.timestamp <= expiry;
    }

    /**
     * @notice Return the expiry timestamp for a session key (0 = no expiry).
     */
    function sessionKeyExpiry(address key) external view returns (uint256) {
        return StorageLib.layout().sessionKeyExpiry[key];
    }
}
