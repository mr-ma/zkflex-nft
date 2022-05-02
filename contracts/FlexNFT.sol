// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


interface IFlexNFT {
    function awardNFT(address reciever) external;
}

contract FlexNFT is IFlexNFT, ERC721, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    // string public baseURI;
    address public flexClubContract;
    bool public isInitialized;
    
    constructor(
        string memory _userBaseURI,
        string memory tokenName,
        string memory tokenSymbol
    ) ERC721(tokenName, tokenSymbol) Ownable() {
        _setBaseURI(_userBaseURI);
        isInitialized = false;
    }


    function initialize(address _flexClubContract) external  {
        require(!isInitialized, "already initialized");
        isInitialized = true;
        flexClubContract = _flexClubContract;
    }
    modifier isInit(){
        require(isInitialized, "not init");
        _;
    }
    modifier onlyFlexClubContract(){
        require(msg.sender == flexClubContract, "call from non-flex-club-contract");
        _;
    }

    // function setFlexClubContract() onlyOwner {
    //     require(flexClubContract != address(0x), "flexClub contract is not set");
    //     flexClubContract = _flexClubContract;
    // }
    function awardNFT(address reciever) external override isInit onlyFlexClubContract nonReentrant{
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        //safeMint can reenter!!
        _safeMint(reciever, newTokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal override {
        //FlexNFT tokens are non-transferable 
        revert("nontransferable token");
    }
}

