import { StyleSheet } from "@react-pdf/renderer";

export const optoStyles = StyleSheet.create({
  page: {
    fontFamily: "IBM Plex Sans",
    fontSize: 9,
    color: "#111111",
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: "right",
    letterSpacing: 1.2,
    marginBottom: 18,
  },
  companyName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
  },
  companyLine: {
    fontSize: 8,
    color: "#333333",
    lineHeight: 1.35,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  logo: {
    width: 150,
    height: 42,
    objectFit: "contain",
    marginBottom: 8,
  },
  contactBlock: {
    width: 180,
    alignItems: "flex-start",
  },
  nameAddressLabel: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  recipientBlock: {
    marginBottom: 16,
    paddingRight: 160,
  },
  attnRow: {
    flexDirection: "row",
    marginBottom: 6,
    gap: 10,
  },
  attnLabel: {
    width: 36,
    fontSize: 9,
    fontWeight: 700,
  },
  attnValue: {
    fontSize: 9,
  },
  institution: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 3,
  },
  address: {
    fontSize: 9,
    lineHeight: 1.35,
  },
  metaBlock: {
    position: "absolute",
    top: 120,
    right: 36,
    width: 150,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: 700,
  },
  metaValue: {
    fontSize: 8,
    fontWeight: 700,
    textAlign: "right",
  },
  tableHeader: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#222222",
    paddingVertical: 6,
    marginTop: 18,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.4,
    borderBottomColor: "#cccccc",
  },
  colNo: { width: "7%" },
  colCode: { width: "18%" },
  colDesc: { width: "37%" },
  colQty: { width: "8%", textAlign: "center" },
  colUnit: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  cell: { fontSize: 8, lineHeight: 1.35 },
  cellBold: { fontSize: 8, fontWeight: 700, lineHeight: 1.35 },
  lineDesc: { fontSize: 8, fontWeight: 400, lineHeight: 1.35, marginTop: 1 },
  bullet: { fontSize: 8, lineHeight: 1.35, marginTop: 1 },
  totalsBlock: {
    marginTop: 16,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 9,
    fontWeight: 700,
    width: 90,
    textAlign: "right",
  },
  footerRow: {
    marginTop: 28,
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderTopColor: "#222222",
    paddingTop: 10,
    gap: 8,
  },
  footerCol: {
    flex: 1,
  },
  footerTitle: {
    fontSize: 7,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  footerBody: {
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.35,
  },
});
