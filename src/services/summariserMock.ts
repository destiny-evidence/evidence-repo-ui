import type { SummariseResponse } from "./summariser";

/**
 * Placeholder summary returned while the summariser service is unavailable.
 * Shaped like a real `SummariseResponse` so the UI renders authentically; the
 * narrative sentences carry the 1-based claim indices that become footnotes.
 */
export const MOCK_SUMMARY: SummariseResponse = {
  kind: "summary",
  terms: [{ name: "Afghanistan" }, { name: "Cost-effectiveness" }],
  extraction_errors: [],
  skipped_references: [
    { reference_id: "0196b1a0-0000-7000-8000-000000000099", reason: "no_full_text" },
  ],
  papers: [
    {
      paper: "anwari-2019",
      authors: ["Anwari Palwasha"],
      affiliations: [],
      year: 2019,
      doi: "10.1016/vaccine.2019.4153",
    },
    {
      paper: "canfell-2020",
      authors: ["Canfell Karen"],
      affiliations: [],
      year: 2020,
      doi: "10.1016/lancet.2020.0591",
    },
    {
      paper: "abbas-2024",
      authors: ["Abbas Kaja"],
      affiliations: [],
      year: 2024,
      doi: "10.1016/langlo.2024.1342",
    },
    {
      paper: "abbas-2018",
      authors: ["Abbas Kaja"],
      affiliations: [],
      year: 2018,
      doi: "10.1002/ijc.2018.1290",
    },
    {
      paper: "brisson-2021",
      authors: ["Brisson Marc"],
      affiliations: [],
      year: 2021,
      doi: "10.1016/lanpub.2021.0398",
    },
  ],
  summary: {
    contradictions: [
      {
        contradiction:
          "Studies disagree on whether multi-cohort catch-up vaccination stays cost-effective once delivery costs scale.",
        quotes: [
          {
            quote:
              "Extending vaccination to multiple older cohorts remained cost-effective even under conservative coverage and cost assumptions (regression coefficient β = 0.83).",
            paper: "abbas-2018",
            page: "S17",
            terms: [2],
          },
          {
            quote:
              "Beyond the primary 9–14 cohort the incremental cost per DALY averted rose sharply (Δ ICER → above 1× GDP), exceeding the threshold in lower-coverage scenarios.",
            paper: "brisson-2021",
            page: "iv",
            terms: [2],
          },
        ],
      },
    ],
    claims: [
      {
        claim:
          "Bivalent HPV vaccination is highly cost-effective at all assessed coverage levels.",
        quotes: [
          {
            quote:
              "Bivalent HPV vaccination delivered through the national immunisation programme was highly cost-effective at all coverage levels assessed (ICER ≤ 0.5× GDP per capita).",
            paper: "anwari-2019",
            terms: [1, 2],
          },
        ],
      },
      {
        claim:
          "Incremental cost per DALY averted stays below one times GDP per capita in every scenario.",
        quotes: [
          {
            quote:
              "Across every modelled scenario the incremental cost per DALY averted remained below one times GDP per capita (mean ICER US$142 ± 18 per DALY).",
            paper: "canfell-2020",
            terms: [2],
          },
        ],
      },
      {
        claim:
          "Equity and health gains are greatest in the lowest income cohorts.",
        quotes: [
          {
            quote:
              "Equity impact was greatest among the lowest income quintiles, where baseline cervical-cancer burden was highest (χ² = 14.2, p ≤ 0.001).",
            paper: "abbas-2024",
            terms: [1],
          },
        ],
      },
      {
        claim:
          "A single 9–14 cohort averts most lifetime cases; catch-up adds more at modest cost.",
        quotes: [
          {
            quote:
              "Vaccinating a single cohort of 9–14-year-old girls averted the majority of projected lifetime cervical-cancer cases; multi-cohort catch-up added further cases averted at modest additional cost (antigen dose 20 μg; efficacy ≈ 95%).",
            paper: "abbas-2018",
            terms: [1, 2],
          },
        ],
      },
      {
        claim:
          "Estimates derive from modelling calibrated to local prevalence, not empirical trials.",
        quotes: [
          {
            quote:
              "Estimates derive from a transmission-dynamic model calibrated to local HPV prevalence (basic reproduction number ≈ 1.2, α = 0.05) rather than from empirical trial data.",
            paper: "brisson-2021",
            terms: [2],
          },
        ],
      },
    ],
    narrative: [
      {
        header: "Cost-effectiveness in Afghanistan",
        sentences: [
          {
            text: "Across the results at this intersection, bivalent HPV vaccination in Afghanistan is consistently found to be highly cost-effective at national coverage levels (≥ 90% uptake).",
            claims: [1],
          },
          {
            text: "Modelled programmes remain below the WHO cost-effectiveness threshold of one times GDP per capita (≤ 1× GDP) across every scenario tested.",
            claims: [2],
          },
          {
            text: "The largest health and equity gains accrue to lower-income cohorts, where baseline cervical-cancer burden is highest.",
            claims: [3],
          },
          {
            text: "Vaccinating a single cohort of 9–14-year-old girls is projected to avert the majority of lifetime cervical-cancer cases, with multi-cohort catch-up adding further benefit at modest incremental cost.",
            claims: [4],
          },
          {
            text: "The evidence is consistent in direction but is drawn almost entirely from mathematical modelling calibrated to regional HPV prevalence rather than from in-country trials, so absolute figures should be read as projections rather than observed outcomes.",
            claims: [5],
          },
        ],
      },
    ],
  },
};
