/**
 * @file ArbitraRiskCalculator.sol
 * @description Computes encrypted invoice pricing and underwriting values using FHE arithmetic.
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
     * @dev Flat discount pricing per user feedback: P = V - V * d / 10000.
     *      timeToMaturityDays is unused but kept in signature for compatibility.
     * @param eFaceValue          Encrypted face value of the invoice.
     * @param eDiscountBps        Encrypted discount rate in basis points.
     * @return ePurchasePrice     Encrypted purchase price.
     */
    function calculatePurchasePrice(
        euint64 eFaceValue,
        euint64 eDiscountBps,
        uint64 /* timeToMaturityDays */
    ) external returns (euint64 ePurchasePrice) {
        euint64 eVtimesD   = FHE.mul(eFaceValue, eDiscountBps);
        /* Changed from annualized to flat discount calculation per user feedback.
           Trade finance operations prefer flat fees over time-compounded calculations,
           simplifying reconciliation and aligning with real-world factoring expectations. */
        /* Flat discount calculation: Discount = FaceValue * DiscountBps / 10000 */
        euint64 eDiscount  = FHE.div(eVtimesD, 10000);
        euint64 ePrice     = FHE.sub(eFaceValue, eDiscount);

        ePurchasePrice = ePrice;
        FHE.allowThis(ePurchasePrice);
        FHE.allow(ePurchasePrice, msg.sender);
    }

    /**
     * @notice Calculate encrypted underwriting score and risk band for an invoice.
     * @dev Higher scores mean higher risk. Inputs stay encrypted and the
     *      returned handles are granted only to the caller registry.
     * @param eRepaymentRatioBps Encrypted repayment ratio in basis points.
     * @param eHistoricalDefaultCount Encrypted count of confirmed supplier defaults.
     * @param eFaceValue Encrypted invoice face value in USDC micro-units.
     * @param eTenorDays Encrypted invoice tenor in days.
     * @param eReputationMultiplier Encrypted supplier reputation multiplier.
     * @return eRiskScore Encrypted final risk score from 0 to 100.
     * @return eRiskBand Encrypted final risk band: 0 low, 1 medium, 2 high.
     */
    function calculateConfidentialRiskScore(
        euint64 eRepaymentRatioBps,
        euint64 eHistoricalDefaultCount,
        euint64 eFaceValue,
        euint64 eTenorDays,
        euint64 eReputationMultiplier
    ) external returns (euint64 eRiskScore, euint64 eRiskBand) {
        euint64 maxRatio = FHE.asEuint64(10000);
        euint64 boundedRatio = FHE.select(FHE.gt(eRepaymentRatioBps, maxRatio), maxRatio, eRepaymentRatioBps);
        euint64 repaymentRisk = FHE.div(FHE.sub(maxRatio, boundedRatio), 200);

        euint64 defaultRiskRaw = FHE.mul(eHistoricalDefaultCount, FHE.asEuint64(15));
        euint64 defaultRisk = FHE.select(FHE.gt(defaultRiskRaw, FHE.asEuint64(30)), FHE.asEuint64(30), defaultRiskRaw);

        euint64 sizeRiskMid = FHE.select(FHE.gt(eFaceValue, FHE.asEuint64(50_000_000_000)), FHE.asEuint64(15), FHE.asEuint64(5));
        euint64 sizeRisk = FHE.select(FHE.gt(eFaceValue, FHE.asEuint64(200_000_000_000)), FHE.asEuint64(25), sizeRiskMid);

        euint64 tenorRiskMid = FHE.select(FHE.gt(eTenorDays, FHE.asEuint64(45)), FHE.asEuint64(10), FHE.asEuint64(5));
        euint64 tenorRisk = FHE.select(FHE.gt(eTenorDays, FHE.asEuint64(75)), FHE.asEuint64(15), tenorRiskMid);

        euint64 reputationRiskRaw = FHE.mul(eReputationMultiplier, FHE.asEuint64(3));
        euint64 reputationRisk = FHE.select(FHE.gt(reputationRiskRaw, FHE.asEuint64(20)), FHE.asEuint64(20), reputationRiskRaw);

        euint64 rawRisk = FHE.add(FHE.add(FHE.add(repaymentRisk, defaultRisk), FHE.add(sizeRisk, tenorRisk)), reputationRisk);
        eRiskScore = FHE.select(FHE.gt(rawRisk, FHE.asEuint64(100)), FHE.asEuint64(100), rawRisk);

        euint64 lowOrMedium = FHE.select(FHE.gt(eRiskScore, FHE.asEuint64(33)), FHE.asEuint64(1), FHE.asEuint64(0));
        eRiskBand = FHE.select(FHE.gt(eRiskScore, FHE.asEuint64(66)), FHE.asEuint64(2), lowOrMedium);

        FHE.allowThis(eRiskScore);
        FHE.allowThis(eRiskBand);
        FHE.allow(eRiskScore, msg.sender);
        FHE.allow(eRiskBand, msg.sender);
    }
}
