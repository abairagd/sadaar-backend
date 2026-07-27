const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_CATEGORIES = ["Men", "Women"];

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim()) && email.length <= 160;
}

function isValidCategory(category) {
  return ALLOWED_CATEGORIES.includes(category);
}

function cleanString(value, maxLen) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
}

function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function isNonNegativeInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

module.exports = { isValidEmail, isValidCategory, cleanString, isPositiveNumber, isNonNegativeInt, ALLOWED_CATEGORIES };
