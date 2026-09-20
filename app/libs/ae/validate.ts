import { InputValidator, detectSQLInjection } from "../middleware/security";

// Request validation shared by the /api/ae/* routes.

export const MAX_AE_CUIS = 500;
export const MAX_AE_TERM_LENGTH = 1000;

// Control characters other than tab / newline; the free-text checks below use
// this instead of InputValidator.validateString, whose ASCII-only whitelist
// rejects legitimate vocabulary such as "haemolytic" with a ligature or "≤5".
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

export type Validation = { valid: true } | { valid: false; error: string };

export function validateCuiList(value: unknown, fieldName = "cuis"): Validation {
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false, error: `${fieldName} must be a non-empty array` };
  }
  const arrayCheck = InputValidator.validateArray(value, fieldName, MAX_AE_CUIS);
  if (!arrayCheck.valid) return { valid: false, error: arrayCheck.error! };
  for (let i = 0; i < value.length; i += 1) {
    const cui = value[i];
    if (typeof cui !== "string") return { valid: false, error: `${fieldName}[${i}] must be a string` };
    const check = InputValidator.validateCUI(cui);
    if (!check.valid) return { valid: false, error: `${fieldName}[${i}]: ${check.error}` };
    if (detectSQLInjection(cui)) return { valid: false, error: "Suspicious input detected" };
  }
  return { valid: true };
}

/**
 * An adverse-event term is free text taken verbatim from the summary response
 * ("foot drop", "insertion site reaction"), so the generic SQL-keyword
 * detector would reject valid values. The value is only ever bound as a
 * prepared-statement parameter; here we bound its length and character set and
 * still refuse comment / stored-procedure markers.
 */
export function validateFreeText(value: unknown, fieldName: string, maxLength = MAX_AE_TERM_LENGTH): Validation {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} must be a non-empty string` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength}` };
  }
  if (CONTROL_CHARS.test(value)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }
  if (/(--|\/\*|\*\/|;)/.test(value) || /\b(xp_|sp_|fn_)/i.test(value)) {
    return { valid: false, error: "Suspicious input detected" };
  }
  return { valid: true };
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
