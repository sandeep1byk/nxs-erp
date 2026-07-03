// Convert AED amount to words (UAE Dirhams / Fils) — used on tax invoices.
// Example: 12345.67 -> "UAE Dirhams Twelve Thousand Three Hundred Forty Five and Fils Sixty Seven Only"

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + " Hundred");
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const scales: [number, string][] = [
    [1_000_000_000, "Billion"],
    [1_000_000, "Million"],
    [1_000, "Thousand"],
    [1, ""],
  ];
  const parts: string[] = [];
  let rem = n;
  for (const [val, name] of scales) {
    const chunk = Math.floor(rem / val);
    if (chunk) {
      parts.push(threeDigits(chunk) + (name ? " " + name : ""));
      rem -= chunk * val;
    }
  }
  return parts.join(" ").trim();
}

export function amountInWords(amount: number | string | null | undefined, currencyName = "UAE Dirhams", fractionName = "Fils"): string {
  const v = Math.abs(Number(amount || 0));
  const dirhams = Math.floor(v);
  const fils = Math.round((v - dirhams) * 100);
  const d = integerToWords(dirhams);
  if (fils === 0) return `${currencyName} ${d} Only`;
  return `${currencyName} ${d} and ${fractionName} ${integerToWords(fils)} Only`;
}
