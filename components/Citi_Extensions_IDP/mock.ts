import type { DocumentSpec } from "./idpTypes";

// ─── Document URL ─────────────────────────────────────────────────────────────

/** Publicly accessible PDF for Storybook document-viewer smoke-test. */
export const mockDocumentUrl =
  "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF2.pdf";
export const mockDocumentMimeType = "application/pdf";

// ─── IDP Spec ─────────────────────────────────────────────────────────────────
//
// Source-of-truth document spec returned by the IDP service.
//
// Shape
//   sections    — flat field groups; `order` controls position relative to
//                 repeatables in the rendered review panel.
//   repeatables — table-style repeatable groups; also carry an `order`.
//
// Both group-level and field-level `order` values are consumed by
// sortByOrder() / buildRenderQueue() (defined in idpTypes.ts).

export const idpSpec: DocumentSpec = {
  documentId: "onboarding-bo-review",
  documentName: "1.0.0",
  documentType: "client.onboarding.corporate",

  // ── Sections ──────────────────────────────────────────────────────────────
  // order 1 → Case Summary
  // order 3 → Engagement Details     (interleaved after the repeatable at order 2)
  // order 4 → Compliance Notes
  //
  // The repeatable (Beneficial Owners) sits at order 2, between sections 1 and 3,
  // to prove buildRenderQueue() + sortByOrder() correctly interleave them.

  sections: [
    // ── Section 1: Case Summary (order 1) ─────────────────────────────────
    // Covers: textbox (read-only), email (editable), phone (editable)
    {
      sectionKey: "caseSummary",
      label: "Case Summary",
      order: 1,
      fields: [
        {
          fieldKey: "clientName",
          codexName: "client_name",
          reportingKey: "party.client.fullName",
          label: "Client Name",
          valueType: "string",
          required: true,
          editable: true, // read-only → plain Text span
          displayType: "textbox",
          format: "plainText",
          placeholder: "",
          helpText: "Legal entity name as registered.",
          order: 3,
        },
        {
          fieldKey: "clientEmail",
          codexName: "client_email",
          reportingKey: "party.client.email",
          label: "Contact Email",
          valueType: "string",
          required: true,
          editable: false, // editable → Cosmos Input[type=email]
          displayType: "email",
          format: "email",
          placeholder: "name@example.com",
          helpText: "Primary contact email for this case.",
          order: 11,
        },
        {
          fieldKey: "clientPhone",
          codexName: "client_phone",
          reportingKey: "party.client.phone",
          label: "Contact Phone",
          valueType: "string",
          required: false,
          editable: true, // editable → Cosmos PhoneInput
          displayType: "phone",
          format: "phone",
          placeholder: "+1 000 000 0000",
          helpText: "Include country code.",
          order: 2,
        },
      ],
    },

    // ── Section 2: Engagement Details (order 3) ───────────────────────────
    // Covers: date, datetime, dropdown, number, currency
    {
      sectionKey: "engagementDetails",
      label: "Engagement Details",
      order: 3,
      fields: [
        {
          fieldKey: "onboardingDate",
          codexName: "onboarding_date",
          reportingKey: "engagement.onboardingDate",
          label: "Onboarding Date",
          valueType: "date",
          required: true,
          editable: true, // editable → Cosmos DateInput
          displayType: "date",
          format: "date",
          placeholder: "",
          helpText: "Date the onboarding process was initiated.",
          order: 1,
        },
        {
          fieldKey: "reviewDeadline",
          codexName: "review_deadline",
          reportingKey: "engagement.reviewDeadline",
          label: "Review Deadline",
          valueType: "datetime",
          required: true,
          editable: true, // editable → Cosmos DateInput (full ISO)
          displayType: "datetime",
          format: "datetime",
          placeholder: "",
          helpText: "Deadline including time zone for final review submission.",
          order: 2,
        },
        {
          fieldKey: "clientSegment",
          codexName: "client_segment",
          reportingKey: "engagement.clientSegment",
          label: "Client Segment",
          valueType: "string",
          required: true,
          editable: true, // editable → Cosmos Select
          displayType: "dropdown",
          format: "plainText",
          placeholder: "Select a segment…",
          helpText: "Determines applicable regulatory regime.",
          order: 3,
        },
        {
          fieldKey: "numberOfEntities",
          codexName: "num_entities",
          reportingKey: "engagement.numberOfEntities",
          label: "Number of Entities",
          valueType: "number",
          required: false,
          editable: true, // editable → Cosmos Input[type=number]
          displayType: "number",
          format: "integer",
          placeholder: "0",
          helpText: "Total legal entities under this onboarding.",
          order: 4,
        },
        {
          fieldKey: "estimatedAum",
          codexName: "estimated_aum",
          reportingKey: "engagement.estimatedAum",
          label: "Estimated AUM (USD)",
          valueType: "number",
          required: false,
          editable: true, // editable → Cosmos CurrencyInput
          displayType: "currency",
          format: "currency",
          placeholder: "",
          helpText: "Assets under management in USD at time of onboarding.",
          order: 5,
        },
      ],
    },

    // ── Section 3: Compliance Notes (order 4) ─────────────────────────────
    // Covers: textarea, checkbox, url
    {
      sectionKey: "complianceNotes",
      label: "Compliance Notes",
      order: 4,
      fields: [
        {
          fieldKey: "riskNarrative",
          codexName: "risk_narrative",
          reportingKey: "compliance.riskNarrative",
          label: "Risk Narrative",
          valueType: "string",
          required: false,
          editable: true, // editable → Cosmos TextArea
          displayType: "textarea",
          format: "plainText",
          placeholder: "Describe any identified risk factors…",
          helpText: "Free-text risk summary for the compliance file.",
          order: 1,
        },
        {
          fieldKey: "pepFlag",
          codexName: "pep_flag",
          reportingKey: "compliance.pepFlag",
          label: "PEP Indicator",
          valueType: "boolean",
          required: true,
          editable: true, // editable → Cosmos Checkbox
          displayType: "checkbox",
          format: "boolean",
          placeholder: "",
          helpText:
            "Check if any associated party is a Politically Exposed Person.",
          order: 2,
        },
        {
          fieldKey: "regulatoryUrl",
          codexName: "regulatory_url",
          reportingKey: "compliance.regulatoryUrl",
          label: "Regulatory Reference URL",
          valueType: "string",
          required: false,
          editable: true, // editable → Cosmos Input[type=url]
          displayType: "url",
          format: "url",
          placeholder: "https://",
          helpText: "Link to the applicable regulation or guidance note.",
          order: 3,
        },
      ],
    },
  ],

  // ── Repeatables ───────────────────────────────────────────────────────────
  // Beneficial Owners sits at order 2 — between Case Summary (1) and
  // Engagement Details (3) — to exercise cross-group sort ordering.

  repeatables: [
    {
      repeatableKey: "beneficialOwners",
      reportingKey: "party.beneficialOwner",
      label: "Beneficial Owners",
      order: 2,
      fields: [
        {
          fieldKey: "uboName",
          codexName: "ubo_name",
          reportingKey: "party.beneficialOwner.fullName",
          label: "Full Legal Name",
          valueType: "string",
          required: true,
          editable: true, // textbox → Cosmos Input
          displayType: "textbox",
          format: "plainText",
          placeholder: "Enter full legal name",
          helpText: "Use the name as it appears on official documents.",
          order: 1,
        },
        {
          fieldKey: "uboDob",
          codexName: "ubo_dob",
          reportingKey: "party.beneficialOwner.dateOfBirth",
          label: "Date of Birth",
          valueType: "date",
          required: true,
          editable: true, // date → Cosmos DateInput
          displayType: "date",
          format: "date",
          placeholder: "",
          helpText: "",
          order: 2,
        },
        {
          fieldKey: "uboEmail",
          codexName: "ubo_email",
          reportingKey: "party.beneficialOwner.email",
          label: "Email Address",
          valueType: "string",
          required: false,
          editable: true, // email → Cosmos Input[type=email]
          displayType: "email",
          format: "email",
          placeholder: "owner@example.com",
          helpText: "",
          order: 3,
        },
        {
          fieldKey: "uboOwnershipPct",
          codexName: "ubo_ownership_pct",
          reportingKey: "party.beneficialOwner.ownershipPercentage",
          label: "Ownership %",
          valueType: "number",
          required: true,
          editable: true, // number → Cosmos Input[type=number]
          displayType: "number",
          format: "decimal",
          placeholder: "0.00",
          helpText: "Percentage of beneficial ownership (0–100).",
          order: 4,
        },
      ],
    },
  ],
};

// ─── Resolved value fixtures ──────────────────────────────────────────────────
//
// Simulates the case-data values Pega resolves at runtime for each field.
// Key = IdpFieldSpec.fieldKey.  All 14 fields across 3 sections + 1 repeatable
// are represented so every displayType can be visually verified in Storybook.

export const mockResolvedValues: Record<string, string> = {
  // ── Case Summary (section, order 1) ──────────────────────────────────────
  clientName: "Citi Trade Corp.", // textbox  (read-only)
  clientEmail: "contact@cititrade.com", // email    (editable)
  clientPhone: "+12125551234", // phone    (editable)

  // ── Engagement Details (section, order 3) ────────────────────────────────
  onboardingDate: "2026-01-15", // date
  reviewDeadline: "2026-03-31T17:00:00", // datetime
  clientSegment: "Institutional", // dropdown (value shown read-only; options from datasource)
  numberOfEntities: "4", // number
  estimatedAum: "250000000", // currency

  // ── Compliance Notes (section, order 4) ──────────────────────────────────
  riskNarrative: "No elevated risk factors identified at this stage.", // textarea
  pepFlag: "false", // checkbox
  regulatoryUrl: "https://www.sec.gov/rules/final/2023/ia-6383.pdf", // url
};
