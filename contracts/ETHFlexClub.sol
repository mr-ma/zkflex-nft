// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./FlexNFT.sol";
import "./FlexClub.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract ETHFlexClub is FlexClub {
    using SafeMath for uint256;

    uint public immutable MINIMUM_WAIT_BLOCKS;


    address public flexNFTContract;
    //deposits
    mapping(address => uint256) private _balances;
    //deposit blocks
    mapping(address => uint256) private _depositBlocks;

    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight,
        address _flexNFT,
        uint _minimumWaitBlocks
    ) FlexClub(_verifier, _hasher, _denomination, _merkleTreeHeight) {

        flexNFTContract =  _flexNFT;
        require(_minimumWaitBlocks>0, "zero min wait blocks");
        MINIMUM_WAIT_BLOCKS = _minimumWaitBlocks; 
    }

    function getFlexNFTAddress() view external returns (address) {
        return address(flexNFTContract);
    }

    function getBalance() view external returns (uint256){
        return _balances[msg.sender];
    }

    function getDepositBlock() view external returns (uint) {
        return _depositBlocks[msg.sender];
    }

    function getMinimumWaitBlocks() view external returns (uint) {
        return MINIMUM_WAIT_BLOCKS;
    }

    function _processDeposit() internal override {
        require(msg.value == denomination, "Please send `mixDenomination` ETH along with transaction");
        _balances[msg.sender] = _balances[msg.sender].add(msg.value);
        _depositBlocks[msg.sender] = block.number;
    }

    modifier canWithdraw(address sender) {
        require(_balances[sender] > 0, "no balance");
        require(block.number.sub(_depositBlocks[sender]) >= MINIMUM_WAIT_BLOCKS, "min wait blocks not met");
        _;
    }

    function _processWithdraw(address payable _recipient) canWithdraw(_recipient) internal override  {
        (bool success, ) = _recipient.call{ value: _balances[_recipient] }("");
        require(success, "payment to _recipient did not go thru");
    }

    function _processMint(
        address payable _recipient,
        address payable _relayer,
        uint256 _fee
    ) internal override {
        // sanity checks
        require(msg.value == 0, "Message value is supposed to be zero for ETH instance");
        // mint FlexNFT
        FlexNFT(flexNFTContract).awardNFT(_recipient);

        // if (_fee > 0) {
        //   (success, ) = _relayer.call{ value: _fee }("");
        //   require(success, "payment to _relayer did not go thru");
        // }
    }
}
