/**
 * @file ArbitraRiskCalculator.sol
 * @description Computes encrypted invoice discount rates and purchase prices using FHE arithmetic.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }   from "@fhevm/solidity/config/ZamaConfig.sol";

contract ArbitraRiskCalculator is ZamaEthereumConfig {

    /*************** NatSpec ***************/

    /**
     * @notice Calculate the encrypted discount rate for an invoice.
     * @dev Cap rate at MAX_DISCOUNT_BPS = 1500 (15%) using FHE.select.
     * @param eBaseRate             Encrypted base market rate in BPS.
     * @param eReputationMultiplier Encrypted supplier risk scalar (1-10).
     * @param eExpectedDelayDays    Encrypted historical payment delay in days.
     * @return eDiscount            Encrypted final discount rate in BPS.
     */
    function calculateConfidentialDiscount(
        euint64 eBaseRate,
        euint64 eReputationMultiplier,
        euint64 eExpectedDelayDays
    ) external returns (euint64 eDiscount) {
        /* 15 BPS premium per delayed day */
        euint64 eDelayFactor  = FHE.mul(eExpectedDelayDays, FHE.asEuint64(15));
        euint64 eRiskPremium  = FHE.mul(eReputationMultiplier, eDelayFactor);
        euint64 eRawDiscount  = FHE.add(eBaseRate, eRiskPremium);

        /* Cap at MAX_DISCOUNT_BPS = 1500 using FHE.select */
        euint64 eMaxCap  = FHE.asEuint64(1500);
        ebool isOverCap  = FHE.gt(eRawDiscount, eMaxCap);
        eDiscount        = FHE.select(isOverCap, eMaxCap, eRawDiscount);

        FHE.allowThis(eDiscount);
        FHE.allow(eDiscount, msg.sender);
    }

    /**
     * @notice Calculate the purchase price for an invoice.
     * @dev P = V - V * d * t / (10000 * 365)
     * @param eFaceValue          Encrypted face value of the invoice.
     * @param eDiscountBps        Encrypted discount rate in basis points.
     * @param timeToMaturityDays  Time to maturity in days (plaintext).
     * @return ePurchasePrice     Encrypted purchase price.
     */
    function calculatePurchasePrice(
        euint64 eFaceValue,
        euint64 eDiscountBps,
        uint64 timeToMaturityDays
    ) external returns (euint64 ePurchasePrice) {
        euint64 eVtimesD   = FHE.mul(eFaceValue, eDiscountBps);
        euint64 eVtimesDtT = FHE.mul(eVtimesD, timeToMaturityDays);
        euint64 eDiscount  = FHE.div(eVtimesDtT, 3_650_000); /* 10000 * 365 */
        euint64 ePrice     = FHE.sub(eFaceValue, eDiscount);

        ePurchasePrice = ePrice;
        FHE.allowThis(ePurchasePrice);
        FHE.allow(ePurchasePrice, msg.sender);
    }
}
