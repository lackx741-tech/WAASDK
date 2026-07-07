// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../StorageLib.sol";

/**
 * @title BatchModule
 * @notice Delegate module that executes an arbitrary batch of calls.
 *
 * This contract is intended to be called via `Orchestrator.execute()` or
 * the fallback router — NOT called directly.  When invoked via delegatecall
 * it executes inside the orchestrator's storage context.
 *
 * Function selector (for fallback registration):
 *   batchExecute(address[],uint256[],bytes[]) → 0x47e7ef24
 *
 * ⚠️  Security: because this module runs in the orchestrator's context,
 *   every target call is made FROM the orchestrator/EOA address.
 */
contract BatchModule {
    // ─── Events ───────────────────────────────────────────────────────────────

    event CallExecuted(address indexed target, uint256 value, bool success);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error LengthMismatch();
    error CallFailed(uint256 index, address target, bytes reason);

    // ─── Core function ────────────────────────────────────────────────────────

    /**
     * @notice Execute a batch of calls sequentially.
     *
     * All calls are made from the orchestrator address (because this function
     * runs via delegatecall).  Any individual call failure reverts the entire
     * batch.
     *
     * @param targets   Destination addresses.
     * @param values    Native token amounts to forward (must sum ≤ account balance).
     * @param payloads  ABI-encoded calldata for each target.
     */
    function batchExecute(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads
    ) external {
        uint256 len = targets.length;
        if (len != values.length || len != payloads.length) revert LengthMismatch();

        for (uint256 i; i < len; ) {
            (bool success, bytes memory reason) =
                targets[i].call{value: values[i]}(payloads[i]);

            emit CallExecuted(targets[i], values[i], success);

            if (!success) revert CallFailed(i, targets[i], reason);

            unchecked { ++i; }
        }
    }

    /**
     * @notice Execute a batch of calls where individual failures are allowed.
     *
     * @param targets       Destination addresses.
     * @param values        Native token amounts.
     * @param payloads      ABI-encoded calldata.
     * @param allowFailures Per-call flag; when true a failed call is skipped
     *                      rather than reverting the whole batch.
     * @return successes    Whether each call succeeded.
     * @return results      Raw return bytes for each call.
     */
    function batchExecuteOptional(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bool[] calldata allowFailures
    ) external returns (bool[] memory successes, bytes[] memory results) {
        uint256 len = targets.length;
        if (
            len != values.length ||
            len != payloads.length ||
            len != allowFailures.length
        ) revert LengthMismatch();

        successes = new bool[](len);
        results   = new bytes[](len);

        for (uint256 i; i < len; ) {
            (bool ok, bytes memory ret) = targets[i].call{value: values[i]}(payloads[i]);
            emit CallExecuted(targets[i], values[i], ok);

            if (!ok && !allowFailures[i]) revert CallFailed(i, targets[i], ret);

            successes[i] = ok;
            results[i]   = ret;

            unchecked { ++i; }
        }
    }
}
