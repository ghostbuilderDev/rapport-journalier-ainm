/*
 * Référentiel de règlement observé dans le décompte n°04 PCLE du 12/08/2026.
 * Il complète le détail estimatif : les agents ne voient jamais ces données.
 * Formule Série 300 documentée : PU BPU × (1 + Maj./Min.) × CR.
 */
window.RJ_BILLING_EVIDENCE = {
  sourceLabel: "Décompte n°04 PCLE - commande 00410-0000002283 - 12/08/2026",
  sourceDate: "2026-08-12",
  sourcePeriod: "nuit semaine",
  series300Formula: "PU BPU × (1 + Maj./Min.) × CR",
  series300Profiles: {
    "24001.01": { defaultCr: 1.9, observedCrs: [1.9, 1.75] },
    "24001.02": { defaultCr: 1.9, observedCrs: [1.9] },
    "24050.01": { defaultCr: 1.9, observedCrs: [1.9] },
    "24050.02": { defaultCr: 1.9, observedCrs: [1.9] },
    "24051.01": { defaultCr: 1.9, observedCrs: [1.9] },
    "24051.02": { defaultCr: 1.9, observedCrs: [1.9, 1.75] },
    "24310.01": { defaultCr: 1.75, observedCrs: [1.75] },
    "24310.02": { defaultCr: 1.75, observedCrs: [1.75] },
    "24311.01": { defaultCr: 1.75, observedCrs: [1.75, 1.9] },
    "24311.02": { defaultCr: 1.75, observedCrs: [1.75, 1.9] },
    "24320.01": { defaultCr: 1.9, observedCrs: [1.9] },
    "24340.01": { defaultCr: 1.75, observedCrs: [1.75] },
    "24341.01": { defaultCr: 1.75, observedCrs: [1.75] },
    "29057.01": { defaultCr: 1.75, observedCrs: [1.75] },
    "29062.01": { defaultCr: 1.9, observedCrs: [1.9] },
    "29063.01": { defaultCr: 1.9, observedCrs: [1.9] },
    "29071.01": { defaultCr: 1.75, observedCrs: [1.75] },
    "36050": { defaultCr: 1.9, observedCrs: [1.9] },
  },
  manualRecords: [
    {
      source: "Décompte n°04 PCLE - 12/08/2026",
      sheet: "Décompte facturé",
      sourceRow: null,
      article: "36050",
      articleBase: "36050",
      description: "Pose et dépose d'une clôture limitative grillagée souple en polyéthylène (h=1 m) et de piquets, avec déplacement selon l'avancement.",
      unit: "ml",
      pricingFamily: "serie-300",
      timeVariant: null,
      timeRule: "nuit semaine - CR 1,9 observé dans le décompte",
      unitPriceHT: 4.7,
      coefficient: 0.65,
      contractualUnitPriceHT: 14.73,
    },
  ],
  billedTimeArticleBases: [
    "PB2-8-1", "PB2-16-1", "PB2-16-2", "PB2-18-1", "PB2-19-1", "PB2-19-2",
    "PB2-23-1", "PB2-23-5", "PB2-23-6", "PB2-24-3", "PB2-27-1", "PB2-30-1",
    "PB2-30-4", "PB2-30-5", "PB2-30-6", "PB2-34-1", "PB2-34-2", "PB2-35-1",
    "PB2-35-2", "PB2-41-1", "PB2-47-1", "PB2-47-2", "PB2-49-1", "PB2-51-1",
    "PB2-52-1", "PB2-52-2", "PB2-53-1", "PB2-53-2", "PB2-61-1", "PB2-62-2",
    "PB2-64-4", "PB2-70-1",
  ],
  billedAdminArticleBases: ["PB1-1-1", "PB1-1-2", "PB1-2-1", "PB1-3-1", "PB1-3-2", "PB1-3-3", "PB1-3-4", "PB1-6-1"],
};
