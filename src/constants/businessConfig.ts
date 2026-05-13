// LUXARDO FASHION Business Configuration

export const BUSINESS_CONFIG = {
  brandName: "LUXARDO FASHION",
  domain: "luxardofashion.com",
  phone: "+919664040699",
  whatsapp: "919664040699",
  email: "connect@luxardofashion.com",
  CODAvailablePINs: [
    "311001", "312001", "305008",
    "302001", "302002", "302003", "302004", "302005", "302006",
    "302012", "302013", "302015", "302016", "302017", "302018",
    "302020", "302021", "302022", "302026", "302027", "302029",
    "302031", "302033", "302039", "302040", "302041", "302042",
    "302044", "302046", "302048",
    "303001", "303050"
  ],
  upiId: "",
  bankAccount: { name: "", number: "", ifsc: "", bank: "", branch: "" },
  CODFeeAmount: 0,
  CODMaxOrderValue: 50000,
  freeShippingMinAmount: 5000,
  shippingFlatRate: 100,
  GSTRate: 0.18,
  defaultCurrency: "INR",
  currencySymbol: "INR"
};

export function isCODEligible(pinCode: string): boolean {
  return BUSINESS_CONFIG.CODAvailablePINs.includes(pinCode.trim());
}

export function whatsappLink(message?: string): string {
  const defaultMsg = "Hi LUXARDO FASHION, I want to know more.";
  const text = encodeURIComponent(message || defaultMsg);
  return "https://wa.me/" + BUSINESS_CONFIG.whatsapp + "?text=" + text;
}
