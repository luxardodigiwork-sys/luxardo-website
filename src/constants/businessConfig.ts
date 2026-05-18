export const BUSINESS_CONFIG = {
  brandName: "LUXARDO FASHION",
  legalEntityName: "LUXARDO FASHION WORLD PRIVATE LIMITED",
  domain: "luxardofashion.com",
  gstin: "08AAGCL8467K1ZT",
  cinNumber: "U47711RJ2026PTC113529",
  phone: "+919664040699",
  whatsapp: "919664040699",
  email: "connect@luxardofashion.com",
  businessAddress: {
    line1: "First Floor, Plot No. 6, Aaraji No. 3608",
    line2: "Engineers Colony, BSL Road",
    city: "Bhilwara",
    state: "Rajasthan",
    pinCode: "311001",
    country: "India"
  },
  pickupAddress: {
    line1: "First Floor, Plot No. 6, Aaraji No. 3608",
    line2: "Engineers Colony, BSL Road",
    city: "Bhilwara",
    state: "Rajasthan",
    pinCode: "311001",
    country: "India"
  },
  CODAvailablePINs: [
    "311001", "312001", "305008",
    "302001", "302002", "302003", "302004", "302005", "302006",
    "302012", "302013", "302015", "302016", "302017", "302018",
    "302020", "302021", "302022", "302026", "302027", "302029",
    "302031", "303033", "302039", "302040", "302041", "302042",
    "302044", "302046", "302048",
    "303001", "303050"
  ],
  upiId: "",
  bankAccount: { 
    name: "LUXARDO FASHION WORLD PRIVATE LIMITED",
    number: "2243102100003569",
    ifsc: "PUNB0224310",
    bank: "PUNJAB NATIONAL BANK",
    branch: "SIDDHARTH SQUARE, GANDHI NAGAR, BHILWARA"
  },
  CODFeeAmount: 0,
  CODMaxOrderValue: 200000,
  freeShippingMinAmount: 7500,
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