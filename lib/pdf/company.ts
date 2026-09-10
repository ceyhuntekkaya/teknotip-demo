import companyJson from "@/app/data/company.json";

export type CompanyInfo = {
  legalName: string;
  legalNameUpper: string;
  logo: string;
  addressLines: string[];
  footerAddress: string;
  taxOffice: string;
  mersis: string;
  vkn: string;
  phone: string;
  fax: string;
  web: string;
  email: string;
};

export type BankInfo = {
  accountName: string;
  bank: string;
  branch: string;
  branchCode: string;
  ibanTl: string;
  ibanEur: string;
  ibanUsd: string;
};

export type CompanyTexts = {
  documentTitle: string;
  dateLabel: string;
  phoneLabel: string;
  faxLabel: string;
  quoteNoLabel: string;
  greeting: string;
  intro: string[];
  table: {
    no: string;
    code: string;
    description: string;
    quantity: string;
    unitPrice: string;
    price: string;
  };
  totals: {
    gross: string;
    discount: string;
    net: string;
    tax: string;
    grand: string;
    only: string;
  };
  closing: string;
  vatIncluded: string;
  salesConditionsTitle: string;
  bankTitle: string;
  customerApprovalTitle: string;
  customerApprovalText: string;
};

export type TermCondition = {
  title: string;
  body: string;
};

export type CompanyTerms = {
  validityDays: number;
  conditions: TermCondition[];
  notes: string[];
};

export type CompanyTemplate = {
  company: CompanyInfo;
  bank: BankInfo;
  texts: CompanyTexts;
  terms: CompanyTerms;
};

export const companyTemplate: CompanyTemplate = companyJson;
