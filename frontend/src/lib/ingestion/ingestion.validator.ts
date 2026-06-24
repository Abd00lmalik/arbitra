/*
 * @file ingestion.validator.ts
 * @description Validates extracted invoice text before deterministic parsing.
 */

import { validateExtractionText as validateExtractionTextInParser } from "./invoice.parser";

export const validateExtractionText = validateExtractionTextInParser;
