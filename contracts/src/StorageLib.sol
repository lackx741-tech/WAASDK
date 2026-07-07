// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title StorageLib
 * @notice Namespaced storage library for the EIP-7702 Orchestrator.
 *
 * All orchestrator state lives at a single deterministic slot derived from a
 * keccak256 hash, which prevents storage collisions with EIP-7702 delegated
 * EOA code and with any delegatecall'd module.
 *
 * Modules that need to read or write orchestrator state should import this
 * library so they reference the same canonical slot.
 */
library StorageLib {
    // keccak256("eip7702.orchestrator.storage") — deterministic, collision-safe
    bytes32 internal constant STORAGE_SLOT =
        0x2c8b1ce36a9573e9fde2e8d8fa4f0a7e08e2b5e4b1c4d5f7a3b2e1d0c9f8e7a6;

    struct Layout {
        /// @dev Account owner — the only address that can install/uninstall modules
        ///      and manage session keys without going through a module.
        address owner;
        /// @dev Set of approved (installed) module addresses.
        mapping(address => bool) installedModules;
        /// @dev Session keys granted temporary execution rights.
        mapping(address => bool) sessionKeys;
        /// @dev Per-key expiry timestamps (0 = no expiry).
        mapping(address => uint256) sessionKeyExpiry;
        /// @dev Selector → module routing table used by the fallback router.
        mapping(bytes4 => address) selectorToModule;
        /// @dev Monotonically increasing execution nonce.
        uint256 nonce;
    }

    /**
     * @dev Returns the storage layout struct anchored at STORAGE_SLOT.
     *      Using `pure` is safe because the slot is a compile-time constant.
     */
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            l.slot := slot
        }
    }
}
