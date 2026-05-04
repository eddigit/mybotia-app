// Bloc 7H — Template Devis VL Medical (react-pdf).
// Document commercial. Logo neutre, polices par défaut.

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { VlmQuote } from "../../vlm-quote-types";

const COLORS = {
  primary: "#0F172A",
  accent: "#D97706",
  border: "#CBD5E1",
  muted: "#64748B",
  zebra: "#F8FAFC",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: COLORS.primary, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: `1pt solid ${COLORS.accent}`,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: { flexDirection: "column" },
  brandTitle: { fontSize: 16, fontWeight: 700, color: COLORS.primary },
  brandSub: { fontSize: 9, color: COLORS.accent, marginTop: 2, fontWeight: 700 },
  brandTag: { fontSize: 8, color: COLORS.muted, marginTop: 1 },
  docMeta: { textAlign: "right", fontSize: 9, color: COLORS.muted },
  docTitle: { fontSize: 16, fontWeight: 700, color: COLORS.primary, marginBottom: 4 },
  refLine: { fontSize: 11, fontWeight: 700, color: COLORS.accent },
  // Client block
  clientBlock: {
    border: `1pt solid ${COLORS.border}`,
    padding: 10,
    marginBottom: 16,
    backgroundColor: COLORS.zebra,
  },
  clientHeader: { fontSize: 8, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.4 },
  clientName: { fontSize: 12, fontWeight: 700, color: COLORS.primary, marginBottom: 2 },
  clientLine: { fontSize: 9, color: COLORS.primary, marginBottom: 1 },
  // Section title
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.accent,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  // Lines table
  table: {
    borderTop: `1pt solid ${COLORS.border}`,
    borderLeft: `1pt solid ${COLORS.border}`,
    borderRight: `1pt solid ${COLORS.border}`,
  },
  tableRow: { flexDirection: "row", borderBottom: `1pt solid ${COLORS.border}`, alignItems: "stretch" },
  tableHead: { backgroundColor: COLORS.zebra },
  tableCell: { padding: 6, fontSize: 9 },
  tableCellHead: {
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    color: COLORS.muted,
    letterSpacing: 0.4,
  },
  // Totals
  totalsBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  totalsTable: {
    width: "50%",
    borderTop: `1pt solid ${COLORS.border}`,
    borderLeft: `1pt solid ${COLORS.border}`,
    borderRight: `1pt solid ${COLORS.border}`,
  },
  totalsRow: { flexDirection: "row", borderBottom: `1pt solid ${COLORS.border}` },
  totalsLabel: {
    width: "55%",
    padding: 6,
    fontSize: 9,
    color: COLORS.muted,
    textAlign: "right",
    backgroundColor: COLORS.zebra,
  },
  totalsValue: {
    width: "45%",
    padding: 6,
    fontSize: 10,
    color: COLORS.primary,
    textAlign: "right",
    fontWeight: 700,
  },
  totalsRowFinal: { backgroundColor: COLORS.accent },
  totalsLabelFinal: {
    width: "55%",
    padding: 6,
    fontSize: 10,
    color: "#FFFFFF",
    textAlign: "right",
    fontWeight: 700,
    backgroundColor: COLORS.accent,
  },
  totalsValueFinal: {
    width: "45%",
    padding: 6,
    fontSize: 11,
    color: "#FFFFFF",
    textAlign: "right",
    fontWeight: 700,
    backgroundColor: COLORS.accent,
  },
  // Notes / terms
  text: { fontSize: 9, color: COLORS.primary, lineHeight: 1.4 },
  textMuted: { fontSize: 9, color: COLORS.muted, fontStyle: "italic" },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: `1pt solid ${COLORS.border}`,
    paddingTop: 6,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
    fontStyle: "italic",
  },
});

function fmtMoney(n: number, currency: string): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

interface Props {
  quote: VlmQuote;
}

export function VlmQuoteDocument({ quote }: Props) {
  const lines = quote.lines || [];
  const c = quote.currency;

  return (
    <Document
      title={`Devis ${quote.ref}`}
      author="MyBotIA · VL Medical"
      subject={`Devis ${quote.ref} — ${quote.clientName}`}
      creator="MyBotIA"
      producer="MyBotIA"
    >
      <Page size="A4" style={styles.page}>
        {/* Header / Branding */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>MyBotIA · VL Medical</Text>
            <Text style={styles.brandSub}>Distribution médicale · Import-export</Text>
            <Text style={styles.brandTag}>Document commercial</Text>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docTitle}>Devis</Text>
            <Text style={styles.refLine}>{quote.ref}</Text>
            <Text>Émis le : {fmtDate(quote.createdAt)}</Text>
            {quote.validUntil && <Text>Valide jusqu&apos;au : {fmtDate(quote.validUntil)}</Text>}
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientBlock}>
          <Text style={styles.clientHeader}>Client</Text>
          <Text style={styles.clientName}>{quote.clientName}</Text>
          {quote.clientEmail && <Text style={styles.clientLine}>{quote.clientEmail}</Text>}
          {quote.clientAddress &&
            quote.clientAddress.split(/\r?\n/).map((line, i) => (
              <Text key={i} style={styles.clientLine}>{line}</Text>
            ))
          }
        </View>

        {/* Titre devis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objet</Text>
          <Text style={styles.text}>{quote.title}</Text>
        </View>

        {/* Lignes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détail</Text>
          {lines.length === 0 ? (
            <Text style={styles.textMuted}>Aucune ligne dans ce devis.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "40%" }]}>Désignation</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "10%", textAlign: "right" }]}>Qté</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "10%" }]}>Unité</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "13%", textAlign: "right" }]}>P.U. HT</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "10%", textAlign: "right" }]}>TVA</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "17%", textAlign: "right" }]}>Total HT</Text>
              </View>
              {lines.map((l, i) => (
                <View key={l.id} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.zebra } : {}]}>
                  <View style={[styles.tableCell, { width: "40%" }]}>
                    <Text>{l.label}</Text>
                    {l.description && <Text style={{ fontSize: 7, color: COLORS.muted }}>{l.description}</Text>}
                  </View>
                  <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>{l.quantity}</Text>
                  <Text style={[styles.tableCell, { width: "10%" }]}>{l.unit || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "13%", textAlign: "right" }]}>
                    {fmtMoney(l.unitPriceHt, c)}
                  </Text>
                  <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>{l.vatRate}%</Text>
                  <Text style={[styles.tableCell, { width: "17%", textAlign: "right" }]}>
                    {fmtMoney(l.lineTotalHt, c)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Totaux */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total HT</Text>
              <Text style={styles.totalsValue}>{fmtMoney(quote.totalHt, c)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total TVA</Text>
              <Text style={styles.totalsValue}>{fmtMoney(quote.totalVat, c)}</Text>
            </View>
            <View style={[styles.totalsRow, { borderBottom: `1pt solid ${COLORS.accent}` }]}>
              <Text style={styles.totalsLabelFinal}>Total TTC</Text>
              <Text style={styles.totalsValueFinal}>{fmtMoney(quote.totalTtc, c)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={[styles.section, { marginTop: 18 }]}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.text}>{quote.notes}</Text>
          </View>
        )}

        {/* Conditions */}
        {quote.terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conditions</Text>
            <Text style={styles.text}>{quote.terms}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Document commercial généré par MyBotIA pour VL Medical. Validation requise avant transmission officielle.
        </Text>
      </Page>
    </Document>
  );
}
