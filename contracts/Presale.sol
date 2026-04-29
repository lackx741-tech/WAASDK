// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Presale
 * @notice Transparent, auditable presale contract for IntegratedDEX.
 *
 * Flow:
 *  1. Owner deploys with softcap, hardcap, token rate, and presale duration.
 *  2. Anyone contributes native token (ETH/BNB/MATIC) during the active window.
 *  3a. If softcap reached before end: owner calls withdrawFunds(); contributors
 *      call claim() to receive tokens proportionally.
 *  3b. If softcap NOT reached by end: contributors call refund() to get ETH back.
 */
contract Presale {
    // ─── State ────────────────────────────────────────────────────────────────

    address public immutable owner;

    /// ERC-20 token distributed to contributors (must be pre-loaded into this contract)
    address public immutable token;

    /// Minimum raise required for the presale to succeed
    uint256 public immutable softcap;

    /// Maximum raise; contributions are rejected once reached
    uint256 public immutable hardcap;

    /// Unix timestamp when the presale closes
    uint256 public immutable presaleEndTime;

    /// How many token wei are awarded per 1 native token wei contributed
    uint256 public immutable tokensPerNative;

    /// Total native token raised so far
    uint256 public totalRaised;

    /// Native token contributed per address
    mapping(address => uint256) public contributions;

    /// Whether an address has already claimed their tokens
    mapping(address => bool) public claimedTokens;

    /// Whether an address has already received a refund
    mapping(address => bool) public refunded;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Contributed(address indexed contributor, uint256 amount, uint256 newTotal);
    event Claimed(address indexed contributor, uint256 tokenAmount);
    event Refunded(address indexed contributor, uint256 nativeAmount);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error PresaleNotActive();
    error PresaleStillActive();
    error SoftcapReached();
    error SoftcapNotReached();
    error HardcapReached();
    error ZeroContribution();
    error AlreadyClaimed();
    error AlreadyRefunded();
    error NoContribution();
    error NotOwner();
    error TransferFailed();
    error InvalidConfig();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _token           Address of the ERC-20 token to distribute
     * @param _softcap         Minimum native token raise (in wei)
     * @param _hardcap         Maximum native token raise (in wei)
     * @param _tokensPerNative Token wei awarded per 1 native wei contributed
     * @param _durationSeconds How many seconds the presale runs from deployment
     */
    constructor(
        address _token,
        uint256 _softcap,
        uint256 _hardcap,
        uint256 _tokensPerNative,
        uint256 _durationSeconds
    ) {
        if (_softcap == 0 || _hardcap == 0 || _softcap > _hardcap) revert InvalidConfig();
        if (_tokensPerNative == 0) revert InvalidConfig();
        if (_durationSeconds == 0) revert InvalidConfig();
        if (_token == address(0)) revert InvalidConfig();

        owner = msg.sender;
        token = _token;
        softcap = _softcap;
        hardcap = _hardcap;
        tokensPerNative = _tokensPerNative;
        presaleEndTime = block.timestamp + _durationSeconds;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// Returns true while contributions are accepted
    function presaleActive() external view returns (bool) {
        return block.timestamp < presaleEndTime && totalRaised < hardcap;
    }

    /// Returns true once softcap has been reached
    function softcapReached() public view returns (bool) {
        return totalRaised >= softcap;
    }

    // ─── Contribute ───────────────────────────────────────────────────────────

    /**
     * @notice Contribute native token to the presale.
     * Reverts if the presale window has closed or the hardcap has been reached.
     */
    function contribute() external payable {
        if (block.timestamp >= presaleEndTime) revert PresaleNotActive();
        if (totalRaised >= hardcap) revert HardcapReached();
        if (msg.value == 0) revert ZeroContribution();

        // Cap the accepted amount at the remaining headroom to the hardcap
        uint256 available = hardcap - totalRaised;
        uint256 accepted = msg.value > available ? available : msg.value;

        contributions[msg.sender] += accepted;
        totalRaised += accepted;

        // Refund any excess over the hardcap immediately
        uint256 excess = msg.value - accepted;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            if (!ok) revert TransferFailed();
        }

        emit Contributed(msg.sender, accepted, totalRaised);
    }

    // ─── Claim ────────────────────────────────────────────────────────────────

    /**
     * @notice Claim tokens after a successful presale.
     * Can only be called after the presale ends AND the softcap has been reached.
     */
    function claim() external {
        if (block.timestamp < presaleEndTime) revert PresaleStillActive();
        if (!softcapReached()) revert SoftcapNotReached();
        if (contributions[msg.sender] == 0) revert NoContribution();
        if (claimedTokens[msg.sender]) revert AlreadyClaimed();

        claimedTokens[msg.sender] = true;

        uint256 tokenAmount = contributions[msg.sender] * tokensPerNative;

        // Transfer tokens from this contract to the contributor
        (bool ok, ) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", msg.sender, tokenAmount)
        );
        if (!ok) revert TransferFailed();

        emit Claimed(msg.sender, tokenAmount);
    }

    // ─── Refund ───────────────────────────────────────────────────────────────

    /**
     * @notice Claim a full refund if the softcap was not reached.
     * Can only be called after the presale window has closed and softcap was missed.
     */
    function refund() external {
        if (block.timestamp < presaleEndTime) revert PresaleStillActive();
        if (softcapReached()) revert SoftcapReached();
        if (contributions[msg.sender] == 0) revert NoContribution();
        if (refunded[msg.sender]) revert AlreadyRefunded();

        refunded[msg.sender] = true;
        uint256 amount = contributions[msg.sender];
        contributions[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Refunded(msg.sender, amount);
    }

    // ─── Owner Withdraw ───────────────────────────────────────────────────────

    /**
     * @notice Owner withdraws raised funds after a successful presale.
     * Only callable after the presale ends and softcap has been reached.
     */
    function withdrawFunds() external onlyOwner {
        if (block.timestamp < presaleEndTime) revert PresaleStillActive();
        if (!softcapReached()) revert SoftcapNotReached();

        uint256 amount = address(this).balance;
        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit FundsWithdrawn(owner, amount);
    }
}
