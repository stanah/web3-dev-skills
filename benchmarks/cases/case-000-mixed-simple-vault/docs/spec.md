# SimpleVault Specification

## Overview
SimpleVault is a contract that allows an owner to deposit and withdraw ETH, with a whitelist for additional depositors.

## Requirements

### Access Control
- R-AUTH-001: Only the contract owner MUST be able to call `withdraw()`.
- R-AUTH-002: The contract owner MUST be able to add and remove addresses from the whitelist.
- R-AUTH-003: Only whitelisted addresses or the owner MUST be able to call `deposit()`.

### Deposit
- R-DEP-001: `deposit()` MUST accept ETH and credit the sender's balance.
- R-DEP-002: `deposit()` MUST revert if `msg.value` is 0.
- R-DEP-003: A `Deposited(address, uint256)` event MUST be emitted on successful deposit.

### Withdrawal
- R-WDR-001: `withdraw(uint256 amount)` MUST transfer the specified amount to the owner.
- R-WDR-002: `withdraw()` MUST revert if `amount` exceeds the contract balance.
- R-WDR-003: A `Withdrawn(address, uint256)` event MUST be emitted on successful withdrawal.
- R-WDR-004: Withdrawal SHOULD follow the checks-effects-interactions pattern.

### Emergency
- R-EMR-001: `emergencyPause()` MUST halt all deposits and withdrawals.
- R-EMR-002: Only the owner MUST be able to call `emergencyPause()` and `emergencyUnpause()`.
