import { z } from "zod";

// One rule for every phone/contact field in the app: digits with common
// formatting (spaces, + - ( ) . /) and nothing alphabetic. Server-side only —
// the browser's type="tel" does not block letters.
export const PHONE_PATTERN = /^\+?[0-9()\-\s./]*$/;
export const PHONE_MESSAGE = "Phone number cannot contain letters — digits, spaces and + - ( ) . / only";

const hasDigit = (value: string) => value === "" || /[0-9]/.test(value);
const hasEnoughDigits = (value: string) => (value.match(/[0-9]/g) ?? []).length >= 7;

export const optionalPhone = z
  .string()
  .trim()
  .regex(PHONE_PATTERN, PHONE_MESSAGE)
  .refine(hasDigit, PHONE_MESSAGE)
  .optional();
export const optionalPhoneWithDefault = z
  .string()
  .trim()
  .regex(PHONE_PATTERN, PHONE_MESSAGE)
  .refine(hasDigit, PHONE_MESSAGE)
  .optional()
  .default("");
export const requiredPhone = (message: string) =>
  z.string().trim().min(7, message).regex(PHONE_PATTERN, PHONE_MESSAGE).refine(hasEnoughDigits, message);
