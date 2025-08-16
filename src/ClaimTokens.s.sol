// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable}  from "@openzeppelin/contracts/access/Ownable.sol";

contract ClaimTokens is ERC1155, Ownable {
    mapping(address => bool) public isMinter;

    constructor(string memory baseURI, address initialOwner)
        ERC1155(baseURI)
        Ownable(initialOwner)
    {}

    function setMinter(address who, bool on) external onlyOwner {
        isMinter[who] = on;
    }

    function mint(address to, uint256 id, uint256 amount) external {
        require(isMinter[msg.sender], "not minter");
        _mint(to, id, amount, "");
    }

    function burn(address from, uint256 id, uint256 amount) external {
        require(isMinter[msg.sender] || msg.sender == from, "not authorized");
        _burn(from, id, amount);
    }
}
