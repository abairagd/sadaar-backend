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

// Which product categories a brand may list in, based on what it chose when it
// applied (changed only by an admin). Unknown values fall back to everything so
// an old brand record can never get locked out.
function categoriesForBrand(brandCategory) {
  if (brandCategory === "Both") return ["Men", "Women"];
  if (ALLOWED_CATEGORIES.includes(brandCategory)) return [brandCategory];
  return [...ALLOWED_CATEGORIES];
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

module.exports = { isValidEmail, isValidCategory, isValidBrandCategory, categoriesForBrand, cleanString, isPositiveNumber, isNonNegativeInt, ALLOWED_CATEGORIES };
