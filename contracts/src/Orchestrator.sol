// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./StorageLib.sol";

/**
 * @title Orchestrator
 * @notice EIP-7702 delegatecall-based modular account orchestrator.
 *
 * Architecture
 * ────────────
 *  EOA (EIP-7702 delegated to this contract)
 *    └─► Orchestrator  (module registry + delegate executor + fallback router)
 *          └─► delegatecall → installed modules
 *                (BatchModule, SessionKeyModule, …)
 *
 * Security model
 * ──────────────
 * • All orchestrator state is stored at a namespaced slot (see StorageLib)
 *   to prevent storage collisions.
 * • Only the owner (or an active session key) can execute modules.
 * • Modules must be explicitly installed by the owner before use.
 * • The fallback router only routes selectors that have been registered by
 *   the owner via `registerSelector`.
 *
 * ⚠️  delegatecall gives modules full access to the account's storage and
 *   balance.  Only install modules from audited, allowlisted registries.
 */
contract Orchestrator {
    // ─── Events ───────────────────────────────────────────────────────────────

    event ModuleInstalled(address indexed module);
    event ModuleUninstalled(address indexed module);
    event SelectorRegistered(bytes4 indexed selector, address indexed module);
    event SelectorDeregistered(bytes4 indexed selector);
    event SessionKeyAdded(address indexed key, uint256 expiry);
    event SessionKeyRevoked(address indexed key);
    event Executed(address indexed module, uint256 nonce);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotOwner();
    error Unauthorized();
    error ModuleNotInstalled(address module);
    error ModuleAlreadyInstalled(address module);
    error NotAContract(address module);
    error SessionKeyExpired(address key);
    error SelectorNotRegistered(bytes4 selector);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != StorageLib.layout().owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        StorageLib.Layout storage l = StorageLib.layout();
        bool isOwner = msg.sender == l.owner;
        bool isSession = l.sessionKeys[msg.sender];
        if (isSession) {
            uint256 expiry = l.sessionKeyExpiry[msg.sender];
            if (expiry != 0 && block.timestamp > expiry) revert SessionKeyExpired(msg.sender);
        }
        if (!isOwner && !isSession) revert Unauthorized();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _owner  Initial owner of the orchestrator.
     *                For EIP-7702 usage this is typically the EOA itself.
     */
    constructor(address _owner) {
        StorageLib.layout().owner = _owner;
    }

    // ─── Module Registry ──────────────────────────────────────────────────────

    /**
     * @notice Install a module.  The address must be a deployed contract.
     * @dev    Only the owner may install modules.
     */
    function installModule(address module) external onlyOwner {
        StorageLib.Layout storage l = StorageLib.layout();
        if (module.code.length == 0) revert NotAContract(module);
        if (l.installedModules[module]) revert ModuleAlreadyInstalled(module);
        l.installedModules[module] = true;
        emit ModuleInstalled(module);
    }

    /**
     * @notice Uninstall a previously installed module.
     */
    function uninstallModule(address module) external onlyOwner {
        delete StorageLib.layout().installedModules[module];
        emit ModuleUninstalled(module);
    }

    /**
     * @notice Check whether a module is installed.
     */
    function isModuleInstalled(address module) external view returns (bool) {
        return StorageLib.layout().installedModules[module];
    }

    // ─── Selector Registry ────────────────────────────────────────────────────

    /**
     * @notice Map a function selector to an installed module for fallback routing.
     * @param selector  4-byte function selector (e.g. `bytes4(keccak256("batchExecute(…)"))`)
     * @param module    Must already be installed.
     */
    function registerSelector(bytes4 selector, address module) external onlyOwner {
        if (!StorageLib.layout().installedModules[module]) revert ModuleNotInstalled(module);
        StorageLib.layout().selectorToModule[selector] = module;
        emit SelectorRegistered(selector, module);
    }

    /**
     * @notice Remove a selector mapping.
     */
    function deregisterSelector(bytes4 selector) external onlyOwner {
        delete StorageLib.layout().selectorToModule[selector];
        emit SelectorDeregistered(selector);
    }

    /**
     * @notice Return the module registered for a selector (address(0) if none).
     */
    function moduleForSelector(bytes4 selector) external view returns (address) {
        return StorageLib.layout().selectorToModule[selector];
    }

    // ─── Session Keys ─────────────────────────────────────────────────────────

    /**
     * @notice Grant a session key execution rights, optionally with an expiry.
     * @param key     Address to grant.
     * @param expiry  Unix timestamp after which the key is invalid (0 = no expiry).
     */
    function addSessionKey(address key, uint256 expiry) external onlyOwner {
        StorageLib.Layout storage l = StorageLib.layout();
        l.sessionKeys[key] = true;
        l.sessionKeyExpiry[key] = expiry;
        emit SessionKeyAdded(key, expiry);
    }

    /**
     * @notice Revoke a session key.
     */
    function revokeSessionKey(address key) external onlyOwner {
        StorageLib.Layout storage l = StorageLib.layout();
        delete l.sessionKeys[key];
        delete l.sessionKeyExpiry[key];
        emit SessionKeyRevoked(key);
    }

    /**
     * @notice Check whether a session key is currently valid.
     */
    function isSessionKeyValid(address key) external view returns (bool) {
        StorageLib.Layout storage l = StorageLib.layout();
        if (!l.sessionKeys[key]) return false;
        uint256 expiry = l.sessionKeyExpiry[key];
        return expiry == 0 || block.timestamp <= expiry;
    }

    // ─── Delegate Executor ────────────────────────────────────────────────────

    /**
     * @notice Execute a module function via delegatecall.
     *
     * @param module  Installed module address.
     * @param data    ABI-encoded function call for the module.
     * @return result Raw return bytes from the module.
     *
     * @dev The module executes inside this contract's storage context.
     *      Modules that use StorageLib will operate on the same Layout slot.
     */
    function execute(
        address module,
        bytes calldata data
    ) external payable onlyAuthorized returns (bytes memory result) {
        StorageLib.Layout storage l = StorageLib.layout();
        if (!l.installedModules[module]) revert ModuleNotInstalled(module);

        (bool success, bytes memory ret) = module.delegatecall(data);
        if (!success) {
            // Bubble up revert reason
            // solhint-disable-next-line no-inline-assembly
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }

        emit Executed(module, l.nonce);
        l.nonce++;

        return ret;
    }

    // ─── Fallback Router ──────────────────────────────────────────────────────

    /**
     * @notice Automatic selector-based delegatecall routing.
     *
     * If the incoming calldata selector has been registered via
     * `registerSelector`, the call is transparently forwarded to the
     * corresponding module via delegatecall — making the orchestrator appear
     * as if it directly implements the module's interface.
     *
     * Unregistered selectors revert with SelectorNotRegistered.
     */
    fallback() external payable {
        StorageLib.Layout storage l = StorageLib.layout();
        address module = l.selectorToModule[msg.sig];
        if (module == address(0)) revert SelectorNotRegistered(msg.sig);

        // Gas-optimised delegatecall via inline assembly (Diamond / Kernel pattern)
        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), module, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}

    // ─── State Readers ────────────────────────────────────────────────────────

    /** @notice Current execution nonce. */
    function nonce() external view returns (uint256) {
        return StorageLib.layout().nonce;
    }

    /** @notice Owner address stored in namespaced slot. */
    function owner() external view returns (address) {
        return StorageLib.layout().owner;
    }
}
