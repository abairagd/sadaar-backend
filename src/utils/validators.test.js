const {
  isValidEmail,
  isValidCategory,
  isValidBrandCategory,
  categoriesForBrand,
  cleanString,
  isPositiveNumber,
  isNonNegativeInt,
} = require("./validators");

describe("isValidEmail", () => {
  test("accepts a normal valid email", () => {
    expect(isValidEmail("hello@sadaar.com")).toBe(true);
  });
  test("trims surrounding whitespace before checking", () => {
    expect(isValidEmail("  hello@sadaar.com  ")).toBe(true);
  });
  test("rejects missing @", () => {
    expect(isValidEmail("hellosadaar.com")).toBe(false);
  });
  test("rejects missing domain", () => {
    expect(isValidEmail("hello@")).toBe(false);
  });
  test("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
  test("rejects non-string input", () => {
    expect(isValidEmail(12345)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
  test("rejects an email over 160 characters", () => {
    const longEmail = "a".repeat(155) + "@sa.com";
    expect(isValidEmail(longEmail)).toBe(false);
  });
});

describe("isValidCategory", () => {
  test("accepts Men", () => {
    expect(isValidCategory("Men")).toBe(true);
  });
  test("accepts Perfumes", () => {
    expect(isValidCategory("Perfumes")).toBe(true);
  });
  test("accepts Women", () => {
    expect(isValidCategory("Women")).toBe(true);
  });
  test("rejects a category not on the list", () => {
    expect(isValidCategory("Kids")).toBe(false);
  });
  test("is case-sensitive — rejects lowercase", () => {
    expect(isValidCategory("men")).toBe(false);
  });
  test("rejects empty string and undefined", () => {
    expect(isValidCategory("")).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });
});

describe("cleanString", () => {
  test("trims leading and trailing whitespace", () => {
    expect(cleanString("  hello  ", 50)).toBe("hello");
  });
  test("returns null for an empty string", () => {
    expect(cleanString("", 50)).toBe(null);
  });
  test("returns null for a whitespace-only string", () => {
    expect(cleanString("   ", 50)).toBe(null);
  });
  test("returns null for non-string input", () => {
    expect(cleanString(123, 50)).toBe(null);
    expect(cleanString(null, 50)).toBe(null);
    expect(cleanString(undefined, 50)).toBe(null);
    expect(cleanString({}, 50)).toBe(null);
  });
  test("truncates a string longer than maxLen", () => {
    expect(cleanString("abcdefghij", 5)).toBe("abcde");
  });
});

describe("isPositiveNumber", () => {
  test("accepts a positive number", () => {
    expect(isPositiveNumber(5)).toBe(true);
  });
  test("accepts a positive number passed as a string (form inputs are strings)", () => {
    expect(isPositiveNumber("5")).toBe(true);
  });
  test("rejects zero", () => {
    expect(isPositiveNumber(0)).toBe(false);
  });
  test("rejects negative numbers", () => {
    expect(isPositiveNumber(-5)).toBe(false);
  });
  test("rejects non-numeric strings", () => {
    expect(isPositiveNumber("abc")).toBe(false);
  });
  test("rejects Infinity", () => {
    expect(isPositiveNumber(Infinity)).toBe(false);
  });
  test("rejects null/undefined", () => {
    expect(isPositiveNumber(null)).toBe(false);
    expect(isPositiveNumber(undefined)).toBe(false);
  });
});

describe("isNonNegativeInt", () => {
  test("accepts a positive integer", () => {
    expect(isNonNegativeInt(5)).toBe(true);
  });
  test("accepts zero (a product can have zero stock)", () => {
    expect(isNonNegativeInt(0)).toBe(true);
  });
  test("rejects negative numbers", () => {
    expect(isNonNegativeInt(-1)).toBe(false);
  });
  test("rejects decimals — stock must be a whole number", () => {
    expect(isNonNegativeInt(5.5)).toBe(false);
  });
  test("accepts a whole number passed as a string", () => {
    expect(isNonNegativeInt("5")).toBe(true);
  });
  test("rejects non-numeric strings", () => {
    expect(isNonNegativeInt("abc")).toBe(false);
  });
});

describe("isValidBrandCategory", () => {
  test("accepts Men, Women, Perfumes and Both", () => {
    for (const c of ["Men", "Women", "Perfumes", "Both"]) {
      expect(isValidBrandCategory(c)).toBe(true);
    }
  });
  test("rejects anything else", () => {
    expect(isValidBrandCategory("Kids")).toBe(false);
    expect(isValidBrandCategory("")).toBe(false);
  });
  test("products still cannot be Both", () => {
    expect(isValidCategory("Both")).toBe(false);
  });
});

describe("categoriesForBrand", () => {
  test("single-category brands can only list in that category", () => {
    expect(categoriesForBrand("Men")).toEqual(["Men"]);
    expect(categoriesForBrand("Women")).toEqual(["Women"]);
    expect(categoriesForBrand("Perfumes")).toEqual(["Perfumes"]);
  });
  test("Both means Men and Women, not Perfumes", () => {
    expect(categoriesForBrand("Both")).toEqual(["Men", "Women"]);
  });
  test("unknown or missing values do not lock a brand out", () => {
    expect(categoriesForBrand(undefined)).toEqual(["Men", "Women", "Perfumes"]);
    expect(categoriesForBrand("Kids")).toEqual(["Men", "Women", "Perfumes"]);
  });
});
