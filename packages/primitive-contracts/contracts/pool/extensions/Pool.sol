pragma solidity ^0.6.2;

/**
 * @title   Vanilla Option Pool Base
 * @author  Primitive
 */

import "../../option/interfaces/IOption.sol";
import "../interfaces/IPool.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Pool is IPool, Ownable, Pausable, ReentrancyGuard, ERC20 {
    using SafeMath for uint256;

    uint256 public constant MIN_LIQUIDITY = 10**4;

    address public override factory;
    address public override tokenP;

    event Deposit(address indexed from, uint256 inTokenU, uint256 outTokenPULP);
    event Withdraw(
        address indexed from,
        uint256 inTokenPULP,
        uint256 outTokenU
    );

    constructor(address _tokenP, address _factory)
        public
        ERC20("Primitive V1 Pool", "PULP")
    {
        tokenP = _tokenP;
        factory = _factory;
    }

    function kill() public override onlyOwner returns (bool) {
        paused() ? _unpause() : _pause();
    }

    /**
     * @dev Private function to mint tokenPULP to depositor.
     */
    function _addLiquidity(
        address to,
        uint256 inTokenU,
        uint256 poolBalance
    ) internal returns (uint256 outTokenPULP) {
        // Mint LP tokens proportional to the Total LP Supply and Total Pool Balance.
        uint256 _totalSupply = totalSupply();

        // If liquidity is not intiialized, mint the initial liquidity.
        if (_totalSupply == 0) {
            outTokenPULP = inTokenU;
        } else {
            outTokenPULP = inTokenU.mul(_totalSupply).div(poolBalance);
        }

        require(
            outTokenPULP > uint256(0) && outTokenPULP >= MIN_LIQUIDITY,
            "ERR_ZERO_LIQUIDITY"
        );
        _mint(to, outTokenPULP);
        emit Deposit(to, inTokenU, outTokenPULP);
    }

    function _removeLiquidity(
        address to,
        uint256 inTokenPULP,
        uint256 poolBalance
    ) internal returns (uint256 outTokenU) {
        require(
            balanceOf(to) >= inTokenPULP && inTokenPULP > 0,
            "ERR_BAL_PULP"
        );
        uint256 _totalSupply = totalSupply();

        // Calculate output amounts.
        outTokenU = inTokenPULP.mul(poolBalance).div(_totalSupply);
        require(outTokenU > uint256(0), "ERR_ZERO");
        // Burn tokenPULP.
        _burn(to, inTokenPULP);
        emit Withdraw(to, inTokenPULP, outTokenU);
    }

    function _write(uint256 outTokenU) internal returns (uint256 outTokenP) {
        address _tokenP = tokenP;
        address tokenU = IOption(_tokenP).tokenU();
        require(
            IERC20(tokenU).balanceOf(address(this)) >= outTokenU,
            "ERR_BAL_UNDERLYING"
        );
        // Transfer underlying tokens to option contract.
        IERC20(tokenU).transfer(_tokenP, outTokenU);

        // Mint  and  Redeem to the receiver.
        (outTokenP, ) = IOption(_tokenP).mint(address(this));
    }

    function _exercise(
        address receiver,
        uint256 outTokenS,
        uint256 inTokenP
    ) internal returns (uint256 outTokenU) {
        address _tokenP = tokenP;
        // Transfer strike token to option contract.
        IERC20(IOption(_tokenP).tokenS()).transfer(_tokenP, outTokenS);

        // Transfer option token to option contract.
        IERC20(_tokenP).transferFrom(msg.sender, _tokenP, inTokenP);

        // Call the exercise function to receive underlying tokens.
        (, outTokenU) = IOption(_tokenP).exercise(
            receiver,
            inTokenP,
            new bytes(0)
        );
    }

    function _redeem(address receiver, uint256 outTokenR)
        internal
        returns (uint256 inTokenS)
    {
        address _tokenP = tokenP;
        // Push tokenR to _tokenP so we can call redeem() and pull tokenS.
        IERC20(IOption(_tokenP).tokenR()).transfer(_tokenP, outTokenR);
        // Call redeem function to pull tokenS.
        inTokenS = IOption(_tokenP).redeem(receiver);
    }

    function _close(uint256 outTokenR, uint256 inTokenP)
        internal
        returns (uint256 outTokenU)
    {
        address _tokenP = tokenP;
        // Transfer redeem to the option contract.
        IERC20(IOption(_tokenP).tokenR()).transfer(_tokenP, outTokenR);

        // Transfer option token to option contract.
        IERC20(_tokenP).transferFrom(msg.sender, _tokenP, inTokenP);

        // Call the close function to have the receive underlying tokens.
        (, , outTokenU) = IOption(_tokenP).close(address(this));
    }

    function balances()
        public
        override
        view
        returns (uint256 balanceU, uint256 balanceR)
    {
        (address tokenU, , address tokenR) = IOption(tokenP).getTokens();
        balanceU = IERC20(tokenU).balanceOf(address(this));
        balanceR = IERC20(tokenR).balanceOf(address(this));
    }
}
