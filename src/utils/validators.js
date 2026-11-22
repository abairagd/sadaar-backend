const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_CATEGORIES = ["Men", "Women", "Perfumes"];
// What a brand can say it sells when applying. "Both" means Men and Women.
// Products themselves are still always Men, Women or Perfumes.
const ALLOWED_BRAND_CATEGORIES = [...ALLOWED_CATEGORIES, "Both"];

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim()) && email.length <= 160;
}

function isValidCategory(category) {
  return ALLOWED_CATEGORIES.includes(category);
}

function isValidBrandCategory(category) {
  return ALLOWED_BRAND_CATEGORIES.includes(category);
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

module.exports = { isValidEmail, isValidCategory, isValidBrandCategory, cleanString, isPositiveNumber, isNonNegativeInt, ALLOWED_CATEGORIES };
