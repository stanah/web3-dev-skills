# Compound V2 cToken Specification

This specification is curated from the [Compound V2 Documentation](https://docs.compound.finance/v2/) and the [Compound Whitepaper](https://compound.finance/documents/Compound.Whitepaper.pdf). It uses RFC 2119 modal verbs (MUST, SHOULD, MAY) to express normative requirements.

## 1. cToken Overview

A cToken is an EIP-20 compliant representation of a balance in a Compound money market. By minting cTokens, users supply assets to the protocol and earn interest. The cToken balance increases in value relative to the underlying asset as interest accrues.

### 1.1 Exchange Rate

- The exchange rate between a cToken and its underlying asset MUST be calculated as:
  ```
  exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  ```
- The exchange rate MUST increase over time as interest accrues (assuming no bad debt).
- If `totalSupply` is zero, the exchange rate MUST return the initial exchange rate stored at deployment.
- The exchange rate MUST be scaled by `1e(18 - 8 + underlyingDecimals)`.

### 1.2 Interest Accrual

- Interest MUST be accrued before any state-changing operation (mint, redeem, borrow, repay, liquidate, transfer).
- The `accrueInterest` function MUST:
  1. Calculate the number of blocks elapsed since the last accrual (`currentBlockNumber - accrualBlockNumber`).
  2. Compute `simpleInterestFactor = borrowRate * blockDelta`.
  3. Update `totalBorrows = totalBorrows + simpleInterestFactor * totalBorrows`.
  4. Update `totalReserves = totalReserves + simpleInterestFactor * totalBorrows * reserveFactorMantissa`.
  5. Update `borrowIndex = borrowIndex + simpleInterestFactor * borrowIndex`.
  6. Set `accrualBlockNumber = currentBlockNumber`.
- If `blockDelta` is zero, `accrueInterest` SHOULD return success without modifying state.
- All arithmetic in `accrueInterest` MUST be checked for overflow (Solidity 0.5.x has no built-in protection).

## 2. Supply Operations

### 2.1 Mint (Supply)

- A user MUST be able to supply underlying assets and receive cTokens in return.
- The number of cTokens minted MUST be calculated as:
  ```
  mintTokens = mintAmount / exchangeRate
  ```
- The function MUST call `accrueInterest` before processing the mint.
- For `CErc20`: the contract MUST call `transferFrom` on the underlying ERC-20 token. The contract MUST handle tokens that do not return a boolean on `transfer`/`transferFrom` (non-standard ERC-20).
- For `CEther`: the mint amount MUST equal `msg.value`. No separate token transfer is needed.
- The Comptroller's `mintAllowed` MUST be called before executing the mint. If it returns a non-zero error code, the mint MUST revert.
- `mintVerify` SHOULD be called after the mint for post-condition checks.

### 2.2 Redeem

- A user MUST be able to redeem cTokens for the underlying asset.
- Two redemption modes MUST be supported:
  - `redeem(uint redeemTokens)`: Redeem a specified number of cTokens.
  - `redeemUnderlying(uint redeemAmount)`: Redeem a specified amount of underlying.
- The underlying amount MUST be calculated as:
  ```
  redeemAmount = redeemTokens * exchangeRate
  ```
- The function MUST call `accrueInterest` before processing.
- The Comptroller's `redeemAllowed` MUST be called. If it returns non-zero, the redemption MUST revert.
- The contract MUST verify it has sufficient cash (`getCash() >= redeemAmount`).
- If the redemption would leave the user with insufficient collateral for outstanding borrows, `redeemAllowed` MUST return an error.
- A redeem of zero tokens MUST be rejected (revert or return error).

## 3. Borrow Operations

### 3.1 Borrow

- A user MUST be able to borrow underlying assets against their collateral.
- The function MUST call `accrueInterest` before processing.
- The Comptroller's `borrowAllowed` MUST be called. If it returns non-zero, the borrow MUST fail.
- The contract MUST verify it has sufficient cash (`getCash() >= borrowAmount`).
- The borrow balance MUST be tracked using an account-level `borrowIndex` snapshot:
  ```
  accountBorrows[account].principal = accountBorrows[account].principal + borrowAmount
  accountBorrows[account].interestIndex = borrowIndex
  ```
- `totalBorrows` MUST be updated: `totalBorrows = totalBorrows + borrowAmount`.

### 3.2 Repay Borrow

- A user MUST be able to repay their own borrow (`repayBorrow`).
- A third party MUST be able to repay on behalf of a borrower (`repayBorrowBehalf`).
- The function MUST call `accrueInterest` before processing.
- The Comptroller's `repayBorrowAllowed` MUST be called.
- The actual repay amount MUST account for accrued interest:
  ```
  accountBorrowsNew = borrowBalanceStored(borrower)  // includes accrued interest
  repayAmount = min(repayAmount, accountBorrowsNew)   // if repayAmount == uint(-1)
  ```
- Using `uint(-1)` (max uint) as the repay amount SHOULD repay the full outstanding borrow.
- `totalBorrows` MUST be updated: `totalBorrows = totalBorrows - actualRepayAmount`.

## 4. Liquidation

### 4.1 Liquidate Borrow

- A liquidator MUST be able to repay part of a borrower's debt and seize collateral at a discount.
- The function MUST call `accrueInterest` on **both** the borrowed market and the collateral market.
- The Comptroller's `liquidateBorrowAllowed` MUST be called.
- A borrower MUST NOT be able to liquidate themselves.
- The repay amount MUST NOT exceed `closeFactor * borrowBalance` (the close factor limits partial liquidation).
- The number of collateral cTokens seized MUST be calculated as:
  ```
  seizeTokens = (repayAmount * liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRateCollateral)
  ```
- The `seize` function MUST transfer cTokens from the borrower to the liquidator.
- The `seize` function MUST only be called by the borrowed cToken market (access control).

## 5. Interest Rate Model

### 5.1 Integration

- Each cToken MUST reference an `InterestRateModel` contract.
- The model MUST implement `getBorrowRate(cash, borrows, reserves)` returning the per-block borrow rate.
- The model MUST implement `getSupplyRate(cash, borrows, reserves, reserveFactorMantissa)` returning the per-block supply rate.
- The borrow rate MUST NOT exceed a hard cap (`borrowRateMaxMantissa`). If the model returns a rate above this cap, `accrueInterest` MUST fail.

### 5.2 WhitePaper Model

- The WhitePaper interest rate model MUST calculate rates as:
  ```
  utilizationRate = borrows / (cash + borrows - reserves)
  borrowRate = baseRate + utilizationRate * multiplier
  supplyRate = utilizationRate * borrowRate * (1 - reserveFactor)
  ```

### 5.3 JumpRate Model

- The JumpRate model MUST behave like the WhitePaper model below the `kink` utilization.
- Above the `kink`, the borrow rate MUST use a steeper `jumpMultiplier`:
  ```
  borrowRate = baseRate + kink * multiplier + (utilizationRate - kink) * jumpMultiplier
  ```

## 6. Admin Functions

### 6.1 Access Control

- Admin functions MUST only be callable by the current `admin` address.
- The admin role MUST be transferable via a two-step process:
  1. `_setPendingAdmin(address)`: Sets the pending admin. MUST only be called by current admin.
  2. `_acceptAdmin()`: Accepts the admin role. MUST only be called by the pending admin.
- After `_acceptAdmin`, the `pendingAdmin` MUST be reset to the zero address.

### 6.2 Reserve Factor

- `_setReserveFactor(uint)` MUST only be callable by admin.
- The reserve factor MUST NOT exceed `reserveFactorMaxMantissa` (typically 1e18, i.e., 100%).
- `accrueInterest` MUST be called before setting the reserve factor.

### 6.3 Reserve Management

- `_reduceReserves(uint)` MUST only be callable by admin.
- The reduction amount MUST NOT exceed `totalReserves`.
- The reduction amount MUST NOT exceed available cash (`getCash()`).
- `accrueInterest` MUST be called before reducing reserves.

### 6.4 Comptroller Setting

- `_setComptroller(ComptrollerInterface)` MUST only be callable by admin.
- The new comptroller MUST pass the `isComptroller` check (returns `true`).

### 6.5 Interest Rate Model Setting

- `_setInterestRateModel(InterestRateModel)` MUST only be callable by admin.
- `accrueInterest` MUST be called before changing the model.
- The new model MUST pass the `isInterestRateModel` check.

## 7. ERC-20 Compliance

### 7.1 Transfer

- cToken transfers MUST follow the ERC-20 specification.
- Before a transfer, the Comptroller's `transferAllowed` MUST be called.
- If `transferAllowed` returns non-zero, the transfer MUST revert.
- This prevents transfers that would leave the sender with insufficient collateral.

### 7.2 Allowances

- `approve`, `transferFrom`, and allowance mechanics MUST follow ERC-20.
- `transferFrom` MUST reduce the allowance by the transfer amount, unless the allowance is `uint(-1)` (infinite approval).

## 8. Error Handling

### 8.1 Error Codes

- Functions MUST return a `uint` error code rather than reverting (with the exception of `require` statements for critical invariants).
- Error code `0` MUST indicate success.
- Non-zero error codes MUST correspond to entries in `ErrorReporter.sol`.
- `CEther` functions that fail MUST revert (since Ether transfers cannot be conditionally returned).

### 8.2 Arithmetic Safety

- All arithmetic operations MUST be checked for overflow and underflow.
- The `SafeMath` library MUST be used for safe math operations.
- `ExponentialNoError` MUST be used for fixed-point multiplication and division with proper scaling.
- Division by zero MUST revert.

## 9. Proxy Pattern (Unitroller)

### 9.1 Delegator/Delegate

- The Comptroller MUST use a proxy pattern via `Unitroller`.
- `Unitroller` MUST delegate all calls to the current implementation contract.
- Implementation upgrades MUST follow a two-step process:
  1. `_setPendingImplementation(address)`: Called by admin.
  2. `_become(Unitroller)`: Called by the new implementation to accept the role.
- Storage layout MUST be compatible across upgrades (inherit `ComptrollerStorage`).

## 10. Non-Standard ERC-20 Handling

- `CErc20` MUST handle underlying tokens that do not return a boolean from `transfer` and `transferFrom`.
- The `EIP20NonStandardInterface` MUST be used for these calls.
- After the call, the contract MUST check `returndatasize` to determine if a boolean was returned, and if so, verify it is `true`.
- This pattern MUST NOT assume that all ERC-20 tokens conform to the standard return-value convention.
