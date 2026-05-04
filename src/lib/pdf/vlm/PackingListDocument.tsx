// Bloc 7G — Template Packing List VL Medical (react-pdf).
// Branding : MyBotIA · VL Medical / Distribution médicale · Import-export.
// Document opérationnel uniquement, pas de prix/marges.

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { PackingListData } from "./packing-list-data";

const COLORS = {
  primary: "#0F172A",   // slate-900
  accent: "#D97706",    // amber-600 (rappel branding VLM ambré)
  border: "#CBD5E1",
  muted: "#64748B",
  zebra: "#F8FAFC",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: COLORS.primary, fontFamily: "Helvetica" },
  // Header
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
  docTitle: { fontSize: 14, fontWeight: 700, color: COLORS.primary, marginBottom: 4 },
  // Sections
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.accent,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 8, marginBottom: 4 },
  fieldLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  fieldValue: { fontSize: 10, color: COLORS.primary, marginTop: 1 },
  fieldEmpty: { fontStyle: "italic", color: COLORS.muted },
  // Tables
  table: {
    borderTop: `1pt solid ${COLORS.border}`,
    borderLeft: `1pt solid ${COLORS.border}`,
    borderRight: `1pt solid ${COLORS.border}`,
  },
  tableRow: { flexDirection: "row", borderBottom: `1pt solid ${COLORS.border}` },
  tableHead: { backgroundColor: COLORS.zebra },
  tableCell: { padding: 4, fontSize: 8 },
  tableCellHead: {
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    color: COLORS.muted,
    letterSpacing: 0.4,
  },
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

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {value ? (
        <Text style={styles.fieldValue}>{value}</Text>
      ) : (
        <Text style={[styles.fieldValue, styles.fieldEmpty]}>Non renseigné</Text>
      )}
    </View>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // Accept YYYY-MM-DD or full ISO
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

interface Props {
  data: PackingListData;
}

export function PackingListDocument({ data }: Props) {
  const { deal, delivery, stockItems, regulatory, generatedAt } = data;

  return (
    <Document
      title={`Packing List ${deal.ref || deal.title}`}
      author="MyBotIA · VL Medical"
      subject="Packing list — Distribution médicale"
      creator="MyBotIA"
      producer="MyBotIA"
    >
      <Page size="A4" style={styles.page}>
        {/* Header / Branding */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>MyBotIA · VL Medical</Text>
            <Text style={styles.brandSub}>Distribution médicale · Import-export</Text>
            <Text style={styles.brandTag}>Document opérationnel</Text>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docTitle}>Packing List</Text>
            <Text>Réf : {deal.ref || "—"}</Text>
            <Text>Généré le : {fmtDate(generatedAt)}</Text>
          </View>
        </View>

        {/* Section Deal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deal container</Text>
          <View style={styles.fieldGrid}>
            <FieldRow label="Référence" value={deal.ref} />
            <FieldRow label="Titre" value={deal.title} />
            <FieldRow label="Fournisseur" value={deal.supplierName} />
            <FieldRow label="Type container" value={deal.containerType} />
            <FieldRow label="Pays origine" value={deal.originCountry} />
            <FieldRow label="Pays destination" value={deal.destinationCountry} />
            <FieldRow label="Statut" value={deal.status} />
            <FieldRow label="Créé le" value={fmtDate(deal.createdAt)} />
          </View>
        </View>

        {/* Section Livraison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Livraison liée</Text>
          {delivery ? (
            <View style={styles.fieldGrid}>
              <FieldRow label="Référence livraison" value={delivery.ref} />
              <FieldRow label="Titre" value={delivery.title} />
              <FieldRow label="Transporteur" value={delivery.carrier} />
              <FieldRow label="Tracking" value={delivery.trackingNumber} />
              <FieldRow label="Départ" value={delivery.shipFrom} />
              <FieldRow label="Arrivée" value={delivery.shipTo} />
              <FieldRow label="Date prévue" value={fmtDate(delivery.expectedDate)} />
              <FieldRow label="Statut" value={delivery.status} />
            </View>
          ) : (
            <Text style={styles.fieldEmpty}>Aucune livraison liée à ce deal.</Text>
          )}
        </View>

        {/* Section Stock médical */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock médical</Text>
          {stockItems.length === 0 ? (
            <Text style={styles.fieldEmpty}>Aucun item de stock VL Medical actif.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "26%" }]}>Item</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "12%" }]}>Lot</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "11%" }]}>Péremption</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "10%" }]}>Qté</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "13%" }]}>Catégorie</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "12%" }]}>CE</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "8%" }]}>Stérile</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "8%" }]}>Origine</Text>
              </View>
              {stockItems.map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.zebra } : {}]}
                >
                  <View style={[styles.tableCell, { width: "26%" }]}>
                    <Text>{s.label}</Text>
                    {s.sku && <Text style={{ fontSize: 7, color: COLORS.muted }}>{s.sku}</Text>}
                  </View>
                  <Text style={[styles.tableCell, { width: "12%" }]}>{s.lotNumber || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "11%" }]}>{fmtDate(s.expiryDate) || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "10%" }]}>
                    {s.quantity}{s.unit ? ` ${s.unit}` : ""}
                  </Text>
                  <Text style={[styles.tableCell, { width: "13%" }]}>{s.medicalCategory || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "12%" }]}>{s.ceMarking || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "8%" }]}>
                    {s.sterile === null ? "—" : s.sterile ? "oui" : "non"}
                  </Text>
                  <Text style={[styles.tableCell, { width: "8%" }]}>{s.originCountry || "—"}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section Conformité */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conformité réglementaire</Text>
          {regulatory.length === 0 ? (
            <Text style={styles.fieldEmpty}>Aucun dossier réglementaire associé.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "20%" }]}>Classe DM</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "20%" }]}>Statut</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "30%" }]}>N° ANSM</Text>
                <Text style={[styles.tableCell, styles.tableCellHead, { width: "30%" }]}>N° certificat CE</Text>
              </View>
              {regulatory.map((r, i) => (
                <View
                  key={i}
                  style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.zebra } : {}]}
                >
                  <Text style={[styles.tableCell, { width: "20%" }]}>{r.deviceClass || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "20%" }]}>{r.regulatoryStatus}</Text>
                  <Text style={[styles.tableCell, { width: "30%" }]}>{r.ansmFileNumber || "—"}</Text>
                  <Text style={[styles.tableCell, { width: "30%" }]}>{r.ceCertificateNumber || "—"}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer fixe en bas de page */}
        <Text style={styles.footer} fixed>
          Document opérationnel généré par MyBotIA pour VL Medical. À vérifier avant transmission officielle.
        </Text>
      </Page>
    </Document>
  );
}
