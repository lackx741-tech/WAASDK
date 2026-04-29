// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ERC20
 * @notice Minimal, auditable ERC-20 implementation (no external deps required).
 */
contract ERC20 {
    string public name;
    string public symbol;
    uint8  public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        uint8  _decimals,
        address _mintTo
    ) {
        name        = _name;
        symbol      = _symbol;
        decimals    = _decimals;
        totalSupply = _totalSupply;
        balanceOf[_mintTo] = _totalSupply;
        emit Transfer(address(0), _mintTo, _totalSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(to != address(0), "ERC20: transfer to zero address");
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * @title TokenLaunch
 * @notice Factory contract: anyone can deploy a new ERC-20 token from the frontend.
 *
 * Emits TokenDeployed so the frontend can pick up the new token address without
 * parsing the constructor return value.
 */
contract TokenLaunch {
    // ─── Events ───────────────────────────────────────────────────────────────

    event TokenDeployed(
        address indexed deployer,
        address indexed token,
        string  name,
        string  symbol,
        uint256 totalSupply
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error EmptyName();
    error EmptySymbol();
    error ZeroSupply();
    error DecimalsTooHigh();

    // ─── Deploy ───────────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new ERC-20 token. All tokens are minted to msg.sender.
     *
     * @param _name        Token name (non-empty)
     * @param _symbol      Token symbol (non-empty)
     * @param _totalSupply Token total supply in smallest units (> 0)
     * @param _decimals    Decimal places (0–18)
     * @return token       Address of the newly deployed ERC-20 contract
     */
    function deployToken(
        string  calldata _name,
        string  calldata _symbol,
        uint256 _totalSupply,
        uint8   _decimals
    ) external returns (address token) {
        if (bytes(_name).length   == 0) revert EmptyName();
        if (bytes(_symbol).length == 0) revert EmptySymbol();
        if (_totalSupply          == 0) revert ZeroSupply();
        if (_decimals             > 18) revert DecimalsTooHigh();

        ERC20 newToken = new ERC20(_name, _symbol, _totalSupply, _decimals, msg.sender);
        token = address(newToken);

        emit TokenDeployed(msg.sender, token, _name, _symbol, _totalSupply);
    }
}
