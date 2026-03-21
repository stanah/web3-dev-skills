// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
    address public owner;
    bool public paused;
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public balances;

    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // BUG: missing whitelist check (violates R-AUTH-003)
    function deposit() external payable {
        require(!paused, "Paused");
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // BUG: sends before state update (violates R-WDR-004, reentrancy)
    function withdraw(uint256 amount) external onlyOwner {
        require(!paused, "Paused");
        require(amount <= address(this).balance, "Insufficient balance");
        emit Withdrawn(msg.sender, amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        // state update after external call - reentrancy risk
    }

    function emergencyPause() external onlyOwner {
        paused = true;
    }

    // BUG: missing onlyOwner modifier (violates R-EMR-002)
    function emergencyUnpause() external {
        paused = false;
    }

    function addToWhitelist(address addr) external onlyOwner {
        whitelist[addr] = true;
    }

    function removeFromWhitelist(address addr) external onlyOwner {
        whitelist[addr] = false;
    }
}
