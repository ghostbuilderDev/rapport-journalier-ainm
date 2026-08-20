/* Rapport journalier AINM — prototype PWA terrain, sans dépendance externe. */
(() => {
  "use strict";

  const STORAGE_KEY = "ainm-rj-pwa-v1";
  const snapshotKey = "ainm-rj-pwa-last-snapshot";
  const adminSessionKey = "ainm-rj-pwa-admin-unlocked";
  const reportSequenceKey = "ainm-rj-pwa-report-serial-v2";
  const reportDeviceKey = "ainm-rj-pwa-report-device-v2";
  const reportHistoryKey = "ainm-rj-pwa-report-history-v2";
  const REPORT_HISTORY_LIMIT = 30;
  const MAX_PHOTOS = 6;
  const billingEvidence = window.RJ_BILLING_EVIDENCE || { series300Profiles: {}, manualRecords: [], billedTimeArticleBases: [] };
  const basePriceCatalog = Array.isArray(window.RJ_PRICE_CATALOG) ? window.RJ_PRICE_CATALOG : [];
  const priceCatalog = [...basePriceCatalog, ...(Array.isArray(billingEvidence.manualRecords) ? billingEvidence.manualRecords : [])];
  const terrainCatalog = Array.isArray(window.RJ_TERRAIN_CATALOG) ? window.RJ_TERRAIN_CATALOG : [];
  const templateById = new Map(terrainCatalog.map((item) => [item.id, item]));

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const dateToday = () => new Date().toISOString().slice(0, 10);
  const number = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const displayNumber = (value, digits = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(number(value));
  const euros = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(number(value));
  const roundMoney = (value) => Math.round((number(value) + 1e-9) * 100) / 100;
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const normalise = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'–—/.,;:()\[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const COMPANY_OPTIONS = [
    "BOUYGUES ENERGIES & SERVICES / TSO SIGNALISATION", "SNCF", "ATIF", "SYSTRA", "ETF", "LSDR", "ETF SERVICE", "TSO", "HP ELEC", "TSO Signalisation", "Bouygues", "TSO (LTV)", "Autre",
  ];
  const PERSONNEL_ROLES = {
    "SNCF": ["RLT", "RLTx", "CCH", "CRLT", "RPTx", "RSO", "ASP", "Agent LAM", "Agent PN", "KV Caténaire", "KV SE", "KV Signalisation", "KV Voie", "RS", "RS9", "S11", "RPT", "CATS", "Mainteneur", "MOETx", "AMOETx", "CSPS", "Agent caténaire", "Agent signalisation", "Agent voie", "Autre"],
    "Entreprise travaux": ["Conducteur travaux", "Chef de chantier", "Chef d’équipe", "Monteur signalisation", "Électricien", "Opérateur travaux", "Pelleur", "Conducteur d’engin", "Chef de manœuvre", "Élingueur", "Agent lorry", "Soudeur", "SST", "Autre"],
    "Prestataire sécurité": ["Agent prestataire S9", "Agent protection physique", "Annonceur", "Sentinelle", "Agent sécurité", "Pelleur", "Percheur", "SST", "Autre"],
  };
  const EQUIPMENT_TYPES = {
    "Rail-route / LAM": ["Pelle rail-route", "Pelle rail-route + remorque", "LAM (Lorry Automoteur)", "Nacelle rail-route", "4 axes", "Lorry", "Lorry à main", "TTx", "Élan", "Autre rail-route"],
    "Routier / chenillard": ["Mini-pelle", "Pelle mécanique supérieure à 2,5 t", "Pelle chenillée", "Bull", "Chargeuse", "Camion", "Camion grue", "Autre engin routier / chenillard"],
    "Manutention / levage": ["Nacelle", "Chariot télescopique", "Manitou", "Grue", "Remorque", "Chariot élévateur", "Autre matériel de levage"],
    "Autre matériel": ["Groupe électrogène", "Compresseur", "Outillage spécialisé", "Autre"],
  };
  const QUICK_TEMPLATE_IDS = new Set([
    "pose-caniveau-pm-mm", "pose-caniveau-gm-tgm", "deroulage-240", "deroulage-95",
    "pose-intervalle-decharge", "depose-intervalle-decharge", "pose-ci-equilibrage", "depose-ci-equilibrage",
  ]);

  const selectOptions = (options, selected, placeholder = "À renseigner") => `<option value="">${escapeHtml(placeholder)}</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
  const editorValue = (id) => String($(`#${id}`)?.value ?? "").trim();
  const companyName = (row) => row?.company === "Autre" ? (row.companyOther || "Autre entreprise") : (row?.company || "Entreprise à préciser");
  const roleName = (row) => row?.role === "Autre" ? (row.roleOther || "Fonction à préciser") : (row?.role || "Fonction à préciser");
  const enterpriseName = () => state.meta.enterprise === "Autre" ? (state.meta.enterpriseOther || "Autre entreprise") : state.meta.enterprise;
  const isOtherEquipmentType = (type) => String(type || "").startsWith("Autre");
  const equipmentName = (row) => isOtherEquipmentType(row?.type || row?.name) ? (row.typeOther || row.type || row.name) : (row?.type || row?.name || "Engin à préciser");

  function deviceCode() {
    try {
      let code = localStorage.getItem(reportDeviceKey);
      if (!code) {
        const raw = globalThis.crypto?.randomUUID?.() || uid();
        code = raw.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
        localStorage.setItem(reportDeviceKey, code);
      }
      return code;
    } catch (_) {
      return "LOCAL";
    }
  }

  function reserveReportSerial(serial) {
    const safeSerial = Math.max(0, Math.floor(number(serial)));
    if (!safeSerial) return;
    try {
      const next = Math.max(1, Math.floor(number(localStorage.getItem(reportSequenceKey))) || 1);
      if (next <= safeSerial) localStorage.setItem(reportSequenceKey, String(safeSerial + 1));
    } catch (_) { /* Stockage local indisponible : le suffixe appareil reste distinctif. */ }
  }

  function allocateReportIdentity() {
    let serial = 1;
    try {
      serial = Math.max(1, Math.floor(number(localStorage.getItem(reportSequenceKey))) || 1);
      localStorage.setItem(reportSequenceKey, String(serial + 1));
    } catch (_) { /* Voir commentaire dans reserveReportSerial. */ }
    const code = deviceCode();
    return {
      serial,
      uid: `${code}-${String(serial).padStart(6, "0")}-${uid()}`,
      reportNo: `AINM-RJ-${String(serial).padStart(6, "0")}-${code}`,
    };
  }

  function readReportHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(reportHistoryKey));
      return Array.isArray(history) ? history : [];
    } catch (_) {
      return [];
    }
  }

  function writeReportHistory(history) {
    try { localStorage.setItem(reportHistoryKey, JSON.stringify(history.slice(0, REPORT_HISTORY_LIMIT))); } catch (_) { /* Historique facultatif. */ }
  }

  function archiveCurrentReport() {
    if (!state?.reportUid || !state?.meta?.reportNo) return;
    const record = {
      reportUid: state.reportUid,
      reportSerial: state.reportSerial,
      savedAt: new Date().toISOString(),
      meta: clone(state.meta),
      personnel: clone(state.personnel || []),
      equipment: clone(state.equipment || []),
      sncfMeans: clone(state.sncfMeans || []),
    };
    const history = readReportHistory().filter((item) => item.reportUid !== record.reportUid);
    history.unshift(record);
    writeReportHistory(history);
  }
  // L'espace interne n'est affiché que si un code a été créé sur cet appareil
  // et si la session actuelle a été déverrouillée.
  const isAdminView = () => adminUnlocked && isAdminConfigured();
  const isAdminConfigured = () => Boolean(state.settings?.admin?.pinHash);
  const hashAdminPin = (pin) => {
    let hash = 2166136261;
    for (const character of `AINM-RJ-ADMIN|${pin}`) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `v1-${(hash >>> 0).toString(36)}`;
  };

  const initialState = () => {
    const date = dateToday();
    const identity = allocateReportIdentity();
    return {
      schema: 1,
      appVersion: 5,
      updatedAt: new Date().toISOString(),
      reportSerial: identity.serial,
      reportUid: identity.uid,
      meta: {
        operation: "RCT AINM — Tronçon Moret–Montargis",
        reportNo: identity.reportNo,
        orderNo: "",
        enterprise: "BOUYGUES ENERGIES & SERVICES / TSO SIGNALISATION",
        enterpriseOther: "",
        date,
        shiftType: "nuit",
        shiftStart: "22:00",
        shiftEnd: "06:00",
        workDuration: "",
        weather: "",
        temperature: "",
        reporter: "",
        moeRepresentative: "",
        companyRepresentative: "",
        publicHoliday: false,
        cancelled: false,
        cancelReason: "",
      },
      tasks: [],
      personnel: [],
      equipment: [],
      possessions: [],
      anomalies: [],
      documents: [],
      sncfMeans: [],
      photos: [],
      afterWorkSignature: { name: "", role: "", signedAt: "", dataUrl: "" },
      settings: { mappings: {}, admin: { pinHash: "", configuredAt: "", includeCommonCosts: false } },
    };
  };

  const load = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed?.schema === 1) return parsed;
    } catch (_) { /* Les données seront remplacées par un brouillon neuf. */ }
    return initialState();
  };

  let state = load();
  const ensureSettings = () => {
    state.settings ||= {};
    state.settings.mappings ||= {};
    state.settings.admin ||= { pinHash: "", configuredAt: "", includeCommonCosts: false };
    if (typeof state.settings.admin.includeCommonCosts !== "boolean") state.settings.admin.includeCommonCosts = false;
  };
  ensureSettings();
  const ensureState = () => {
    state.meta ||= {};
    ["tasks", "personnel", "equipment", "possessions", "anomalies", "documents", "sncfMeans", "photos"].forEach((key) => { if (!Array.isArray(state[key])) state[key] = []; });
    state.afterWorkSignature ||= { name: "", role: "", signedAt: "", dataUrl: "" };
    if (!state.reportSerial || !state.reportUid) {
      const identity = allocateReportIdentity();
      state.reportSerial = identity.serial;
      state.reportUid = identity.uid;
      state.meta.previousReportNo ||= state.meta.reportNo || "";
      state.meta.reportNo = identity.reportNo;
    }
    reserveReportSerial(state.reportSerial);
  };
  ensureState();
  let taskDraft = null;
  let rowDraft = null;
  let catalogSearch = "";
  let catalogCategory = "Toutes";
  let selectedPhotoPhase = "avant";
  let signatureCanvasReady = false;
  let adminLoginOpen = false;
  let adminUnlocked = (() => {
    try { return sessionStorage.getItem(adminSessionKey) === "1"; } catch (_) { return false; }
  })();

  const getPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
  const setPath = (object, path, value) => {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((value, key) => value[key], object);
    target[last] = value;
  };

  function save(label = "Brouillon local") {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      alert("L’espace local du téléphone est presque plein. Exportez le rapport ou supprimez des photos avant de continuer.");
      return false;
    }
    const target = $("#saveState");
    if (target) {
      target.textContent = label;
      window.setTimeout(() => { target.textContent = "Brouillon local"; }, 1200);
    }
    return true;
  }

  function formatDate(value) {
    if (!value) return "—";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function getShiftContext() {
    const duration = number(state.meta.workDuration);
    const date = state.meta.date ? new Date(`${state.meta.date}T12:00:00`) : null;
    const weekend = Boolean(date && [0, 6].includes(date.getDay()));
    const isWeekend = weekend || Boolean(state.meta.publicHoliday);
    if (isWeekend) return { key: "W", label: "Week-end / jour férié", status: "ok" };
    // N2 sert de référence provisoire. Le montant reste calculable si un
    // brouillon historique ne contient pas encore sa durée ;
    // l'administrateur voit alors l'indication de contrôle au lieu d'une ligne
    // sans prix.
    if (!duration) return state.meta.shiftType === "nuit"
      ? { key: "N2", label: "Nuit N2 par défaut — durée à contrôler", pricingReason: "Durée effective à confirmer", status: "warning", provisional: true }
      : { key: "J", label: "Jour par défaut — durée à contrôler", pricingReason: "Durée effective à confirmer", status: "warning", provisional: true };
    if (state.meta.shiftType === "jour") {
      if (duration > 4) return { key: "J", label: "Intervention de jour (> 4 h)", status: "ok" };
      return { key: "J", label: "Intervention de jour (≤ 4 h) — à contrôler", pricingReason: "Jour ≤ 4 h : contrôle administratif recommandé", status: "warning", provisional: true };
    }
    if (duration > 2 && duration <= 3) return { key: "N1", label: "Intervention de nuit N1 (> 2 h à 3 h)", status: "ok" };
    if (duration > 3 && duration <= 5) return { key: "N2", label: "Intervention de nuit N2 (> 3 h à 5 h)", status: "ok" };
    if (duration > 5) return { key: "N3", label: "Intervention de nuit N3 (> 5 h)", status: "ok" };
    return { key: "N1", label: "Intervention de nuit (≤ 2 h) — à contrôler", pricingReason: "Nuit ≤ 2 h : contrôle administratif recommandé", status: "warning", provisional: true };
  }

  function candidatesFor(template) {
    const route = template?.priceRoute || {};
    if (Array.isArray(route.candidates) && route.candidates.length) {
      return route.candidates
        .map((article) => priceCatalog.find((record) => record.article === article))
        .filter(Boolean);
    }
    const search = route.search;
    if (!search) return [];
    const words = normalise(search).split(" ").filter((word) => word.length > 2 && !["pose", "pour", "avec", "dans", "une", "des", "les"].includes(word));
    return priceCatalog
      .map((record) => {
        const haystack = normalise(`${record.description} ${record.article}`);
        const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
        return { record, score };
      })
      .filter(({ score }) => score >= Math.max(1, Math.min(2, words.length)))
      .sort((a, b) => b.score - a.score || a.record.article.localeCompare(b.record.article, "fr"))
      .slice(0, 16)
      .map(({ record }) => record);
  }

  function timeCandidatesFor(template) {
    const route = template?.priceRoute || {};
    const bases = Array.isArray(route.candidates) ? route.candidates : [];
    return bases.map((articleBase) => {
      const variants = priceCatalog.filter((record) => record.articleBase === articleBase);
      return variants.find((record) => record.timeVariant === "J") || variants[0] || null;
    }).filter(Boolean);
  }

  function findPrice(article) {
    return priceCatalog.find((record) => record.article === article) || null;
  }

  function mappedArticleFor(template) {
    const route = template?.priceRoute || {};
    return state.settings?.mappings?.[template?.id]
      || billingEvidence.defaultMappings?.[template?.id]
      || route.defaultArticle
      || "";
  }

  function isNightWeek() {
    const date = state.meta.date ? new Date(`${state.meta.date}T12:00:00`) : null;
    return state.meta.shiftType === "nuit" && !state.meta.publicHoliday && !(date && [0, 6].includes(date.getDay()));
  }

  function getStandardShiftKey() {
    const date = state.meta.date ? new Date(`${state.meta.date}T12:00:00`) : null;
    if (state.meta.publicHoliday || (date && [0, 6].includes(date.getDay()))) return "W";
    return state.meta.shiftType === "nuit" ? "N" : "J";
  }

  function priceForRecord(record, task = {}) {
    if (record.pricingFamily !== "serie-300") {
      return { status: "priced", unitPrice: number(record.contractualUnitPriceHT), source: "BPU" };
    }
    const profile = billingEvidence.series300Profiles?.[record.article];
    const overrideCr = number(task.billingCr);
    const cr = overrideCr || number(profile?.defaultCr);
    if (!cr) return { status: "review", reason: "Coefficient CR absent du référentiel administrateur" };
    const majoration = number(record.coefficient);
    const unitPrice = roundMoney(number(record.unitPriceHT) * (1 + majoration) * cr);
    const notice = !overrideCr && !isNightWeek()
      ? "CR par défaut du référentiel : contrôler cette séance hors nuit de semaine."
      : (profile?.marketDefault ? "CR par défaut appliqué : contrôle hebdomadaire recommandé." : "");
    return { status: "priced", unitPrice, cr, source: billingEvidence.sourceLabel || "Décompte facturé", notice };
  }

  function documentedUnitPrice(record) {
    if (!record) return null;
    if (record.pricingFamily !== "serie-300") return number(record.contractualUnitPriceHT);
    const profile = billingEvidence.series300Profiles?.[record.article];
    if (!profile?.defaultCr) return null;
    return roundMoney(number(record.unitPriceHT) * (1 + number(record.coefficient)) * number(profile.defaultCr));
  }

  function resolveRecord(record, quantity, task) {
    const price = priceForRecord(record, task);
    if (price.status !== "priced") return { status: "review", record, quantity, reason: price.reason };
    return {
      status: "priced", record, quantity, unitPrice: price.unitPrice, cr: price.cr || null, priceSource: price.source, notice: price.notice || "",
      amount: roundMoney(quantity * price.unitPrice),
    };
  }

  function resolveTask(task) {
    const template = templateById.get(task.templateId);
    if (!template) return { status: "review", reason: "Prestation hors catalogue à rattacher", quantity: number(task.quantity) };

    const route = template.priceRoute || { type: "manual" };
    let quantity = number(task.quantity);
    if (template.metric === "openClose") {
      const opening = number(task.opening);
      const closing = number(task.closing);
      quantity = Math.min(opening, closing);
      if (!opening || !closing || opening !== closing) {
        return {
          status: "review",
          reason: opening && closing ? "Longueurs d’ouverture et de fermeture différentes" : "Ouverture et fermeture à renseigner",
          quantity,
        };
      }
    }
    if (quantity <= 0) return { status: "review", reason: "Quantité à renseigner", quantity };

    if (route.type === "time") {
      const context = getShiftContext();
      if (!context.key) return { status: "review", reason: context.label, quantity };
      const record = priceCatalog.find((item) => item.articleBase === route.articleBase && item.timeVariant === context.key);
      if (!record) return { status: "review", reason: "Prix de bordereau introuvable", quantity };
      return resolveRecord(record, quantity, task);
    }

    if (route.type === "shift") {
      const record = findPrice(`${route.articleBase} ${getStandardShiftKey()}`);
      if (!record) return { status: "review", reason: "Variante jour / nuit / week-end à confirmer", quantity };
      return resolveRecord(record, quantity, task);
    }

    if (route.type === "direct") {
      const record = findPrice(route.article);
      if (!record) return { status: "review", reason: "Prix de bordereau introuvable", quantity };
      return resolveRecord(record, quantity, task);
    }

    if (route.type === "mapped") {
      const selectedArticle = mappedArticleFor(template);
      const record = selectedArticle ? findPrice(selectedArticle) : null;
      if (!record) {
        const count = candidatesFor(template).length;
        return { status: "review", reason: count ? "Référence marché introuvable" : "Aucun article trouvé automatiquement", quantity };
      }
      return resolveRecord(record, quantity, task);
    }

    if (route.type === "time-mapped") {
      const context = getShiftContext();
      const articleBase = mappedArticleFor(template);
      if (!articleBase) return { status: "review", reason: "Famille de prix introuvable", quantity };
      const record = priceCatalog.find((item) => item.articleBase === articleBase && item.timeVariant === context.key);
      if (!record) return { status: "review", reason: "Variante horaire introuvable", quantity };
      return resolveRecord(record, quantity, task);
    }

    return { status: "review", reason: route.reason || "Prestation à rattacher au bordereau", quantity };
  }

  function valuationBreakdown() {
    const valuations = state.tasks.map((task) => ({ task, template: templateById.get(task.templateId), result: resolveTask(task) }));
    const priced = valuations.filter(({ result }) => result.status === "priced");
    const productionTotal = roundMoney(priced.reduce((sum, { result }) => sum + result.amount, 0));
    const includeCommonCosts = Boolean(state.settings?.admin?.includeCommonCosts);
    const civilEngineeringTotal = roundMoney(priced
      .filter(({ result }) => String(result.record?.articleBase || result.record?.article || "").startsWith("PB2-"))
      .reduce((sum, { result }) => sum + result.amount, 0));
    const signallingTotal = roundMoney(priced
      .filter(({ result }) => result.record?.pricingFamily === "serie-300")
      .reduce((sum, { result }) => sum + result.amount, 0));
    const commonCosts = includeCommonCosts ? [
      {
        article: "PB1-1-1", label: "Études, méthodes et contrôles GC", base: civilEngineeringTotal, rate: 0.07,
        amount: roundMoney(civilEngineeringTotal * 0.07),
      },
      {
        article: "PB1-1-2", label: "Études, méthodes et contrôles signalisation", base: signallingTotal, rate: 0.07,
        amount: roundMoney(signallingTotal * 0.07),
      },
      {
        article: "PB1-2-1", label: "Installations de chantier", base: roundMoney(civilEngineeringTotal + signallingTotal), rate: 0.05,
        amount: roundMoney((civilEngineeringTotal + signallingTotal) * 0.05),
      },
    ].filter((row) => row.base > 0) : [];
    const total = roundMoney(productionTotal + commonCosts.reduce((sum, row) => sum + row.amount, 0));
    return { valuations, priced, productionTotal, civilEngineeringTotal, signallingTotal, commonCosts, total };
  }

  function renderInputs() {
    $$("[data-path]").forEach((element) => {
      const value = getPath(state, element.dataset.path);
      if (element.type === "checkbox") element.checked = Boolean(value);
      else element.value = value ?? "";
    });
    if ($("#reportNoInput")) $("#reportNoInput").value = state.meta.reportNo || "";
    $("#cancelReasonField").classList.toggle("hidden", !state.meta.cancelled);
    $("#enterpriseOtherField")?.classList.toggle("hidden", state.meta.enterprise !== "Autre");
  }

  function renderPricingContext() {
    const context = getShiftContext();
    const banner = $("#pricingContext");
    if (!isAdminView()) {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");
    banner.classList.toggle("warning", context.status !== "ok");
    banner.innerHTML = `<strong>Régime de règlement identifié :</strong> ${escapeHtml(context.label)}. ${context.provisional ? `${escapeHtml(context.pricingReason || "Contrôle administratif recommandé")}.` : "Les prestations éligibles à plage horaire sont prêtes au contrôle."}`;
  }

  function renderHeader() {
    const breakdown = valuationBreakdown();
    const toReview = breakdown.valuations.filter(({ result }) => result.status !== "priced").length;
    $("#taskCount").textContent = state.tasks.length;
    $("#secondaryKpiLabel").textContent = isAdminView() ? "Estimation HT" : "Mode";
    $("#secondaryKpiValue").textContent = isAdminView() ? (breakdown.total ? euros(breakdown.total) : "—") : "Terrain";
    $("#heroSubtitle").textContent = state.meta.cancelled
      ? "Chantier annulé — éditer la cause et la trace de la séance."
      : isAdminView()
        ? `${state.meta.operation || "Opération à renseigner"} · ${toReview ? `${toReview} ligne(s) à contrôler` : "contrôle financier prêt"}`
        : `${state.meta.operation || "Opération à renseigner"} · ${state.tasks.length ? `${state.tasks.length} prestation(s) saisie(s)` : "saisie terrain à démarrer"}`;

    const contextDone = Boolean(state.meta.operation && state.meta.reportNo && state.meta.date && state.meta.workDuration);
    const contextChip = $("#contextStatus");
    contextChip.className = `status-chip ${contextDone ? "success" : "warning"}`;
    contextChip.textContent = contextDone ? "Complet" : "À compléter";
  }

  function renderQuickCatalog() {
    const quick = terrainCatalog.filter((item) => !item.legacy && QUICK_TEMPLATE_IDS.has(item.id));
    $("#quickCatalog").innerHTML = quick.map((item) => `
      <button class="quick-card" type="button" data-template="${escapeHtml(item.id)}">
        <span class="quick-category">${escapeHtml(item.category)}</span>${escapeHtml(item.label)}
      </button>`).join("");
  }

  function taskStatusMarkup(result) {
    if (!isAdminView()) return `<span class="status-chip neutral">Saisi</span>`;
    if (result.status === "priced") return `<span class="status-chip success">Valorisé</span>`;
    return `<span class="status-chip warning">À compléter</span>`;
  }

  function taskText(task, template) {
    if (template?.metric === "openClose") return `Ouverture ${displayNumber(task.opening)} ml · Fermeture ${displayNumber(task.closing)} ml`;
    return `${displayNumber(task.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}`;
  }

  function renderTasks() {
    const list = $("#taskList");
    const empty = $("#emptyTasks");
    empty.classList.toggle("hidden", state.tasks.length > 0);
    list.innerHTML = state.tasks.map((task) => {
      const template = templateById.get(task.templateId);
      const result = resolveTask(task);
      const place = [task.voie && `Voie ${task.voie}`, task.pkStart && `PK ${task.pkStart}`, task.pkEnd && `→ ${task.pkEnd}`].filter(Boolean).join(" · ");
      const pricing = isAdminView()
        ? (result.status === "priced" ? `${euros(result.amount)} HT estimés${result.notice ? " · contrôle recommandé" : ""}` : result.reason)
        : "Prestation enregistrée";
      return `
        <article class="task-card">
          <div class="task-main">
            <div class="task-topline">
              <h3 class="task-title">${escapeHtml(task.label || template?.reportLabel || "Prestation")}</h3>
              ${taskStatusMarkup(result)}
            </div>
            <p class="task-meta"><span class="task-quantity">${taskText(task, template)}</span>${place ? `<span>${escapeHtml(place)}</span>` : ""}<span>${escapeHtml(pricing)}</span></p>
            ${task.note ? `<p class="task-meta"><span>Observation : ${escapeHtml(task.note)}</span></p>` : ""}
          </div>
          <div class="task-actions">
            <button class="mini-button" type="button" data-edit-task="${task.id}">Modifier</button>
            <button class="mini-button danger" type="button" data-delete-task="${task.id}">Supprimer</button>
          </div>
        </article>`;
    }).join("");
  }

  function toggleOtherCompany() {
    $("#row_companyOtherField")?.classList.toggle("hidden", editorValue("row_company") !== "Autre");
  }

  function toggleOtherRole() {
    $("#row_roleOtherField")?.classList.toggle("hidden", editorValue("row_role") !== "Autre");
  }

  function refreshPersonnelRoles(selected = null) {
    const select = $("#row_role");
    if (!select) return;
    const current = selected ?? select.value;
    const roles = PERSONNEL_ROLES[editorValue("row_team")] || [];
    select.innerHTML = selectOptions(roles, current, "Choisir une fonction");
    toggleOtherRole();
  }

  function renderPersonnelEditor(row) {
    const team = row.team || "Entreprise travaux";
    const company = row.company || (state.meta.enterprise === "Autre" ? "" : state.meta.enterprise);
    const companyOther = row.companyOther || "";
    return `<div class="resource-editor">
      <div class="resource-banner personnel-banner"><span class="resource-symbol">P</span><div><strong>Intervenant ou équipe</strong><p>Choisir la famille, l’entreprise et la fonction : le rapport reste lisible pour tous les acteurs.</p></div></div>
      <div class="task-extra-grid">
        <label class="field"><span>Famille d’intervenant</span><select id="row_team">${selectOptions(["Entreprise travaux", "SNCF", "Prestataire sécurité"], team, "Choisir une famille")}</select></label>
        <label class="field"><span>Entreprise / acteur</span><select id="row_company">${selectOptions(COMPANY_OPTIONS, company, "Choisir une entreprise")}</select></label>
      </div>
      <label id="row_companyOtherField" class="field ${company === "Autre" ? "" : "hidden"}"><span>Autre entreprise</span><input id="row_companyOther" value="${escapeHtml(companyOther)}" placeholder="Nom de l’entreprise" autocomplete="organization" /></label>
      <div class="task-extra-grid">
        <label class="field"><span>Fonction</span><select id="row_role">${selectOptions(PERSONNEL_ROLES[team] || [], row.role || "", "Choisir une fonction")}</select></label>
        <label class="field"><span>Nombre de personnes</span><input id="row_count" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(row.count ?? "")}" placeholder="Ex. 2" /></label>
      </div>
      <label id="row_roleOtherField" class="field ${row.role === "Autre" ? "" : "hidden"}"><span>Autre fonction</span><input id="row_roleOther" value="${escapeHtml(row.roleOther ?? "")}" placeholder="Préciser la fonction" /></label>
      <details class="optional-details"><summary>Compléments d’équipe</summary><div class="task-extra-grid"><label class="field"><span>Heures par personne</span><input id="row_hours" type="number" min="0" max="24" step="0.25" inputmode="decimal" value="${escapeHtml(row.hours ?? state.meta.workDuration ?? "")}" placeholder="Reprend la durée de séance si renseignée" /></label><label class="field"><span>Chef d’équipe / précision</span><input id="row_lead" value="${escapeHtml(row.lead ?? "")}" placeholder="Nom, équipe ou précision" /></label></div><label class="field"><span>Observation</span><textarea id="row_observation" rows="3" placeholder="Particularité, coactivité, absence, renfort…">${escapeHtml(row.observation ?? "")}</textarea></label></details>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer l’intervenant</button></div>
    </div>`;
  }

  function bindPersonnelEditor() {
    $("#row_team")?.addEventListener("change", () => refreshPersonnelRoles());
    $("#row_company")?.addEventListener("change", toggleOtherCompany);
    $("#row_role")?.addEventListener("change", toggleOtherRole);
  }

  function readPersonnelEditor() {
    return {
      team: editorValue("row_team"), company: editorValue("row_company"), companyOther: editorValue("row_companyOther"),
      role: editorValue("row_role"), roleOther: editorValue("row_roleOther"), count: editorValue("row_count"), hours: editorValue("row_hours"), lead: editorValue("row_lead"), observation: editorValue("row_observation"),
    };
  }

  function inferredEquipmentFamily(row) {
    if (row.family) return row.family;
    const existingType = row.type || row.name || "";
    return Object.entries(EQUIPMENT_TYPES).find(([, types]) => types.includes(existingType))?.[0] || "";
  }

  function refreshEquipmentTypes(selected = null) {
    const select = $("#row_type");
    if (!select) return;
    const current = selected ?? select.value;
    const family = editorValue("row_family");
    select.innerHTML = selectOptions(EQUIPMENT_TYPES[family] || [], current, "Choisir un type d’engin");
    $("#row_railRoadDetails")?.classList.toggle("hidden", family !== "Rail-route / LAM");
    $("#row_typeOtherField")?.classList.toggle("hidden", !isOtherEquipmentType(select.value));
  }

  function renderEquipmentEditor(row) {
    const family = inferredEquipmentFamily(row);
    const company = row.company || (state.meta.enterprise === "Autre" ? "" : state.meta.enterprise);
    const type = row.type || row.name || "";
    return `<div class="resource-editor">
      <div class="resource-banner equipment-banner"><span class="resource-symbol">E</span><div><strong>Engin ou mobile travaux</strong><p>La saisie distingue les engins rail-route / LAM des engins routiers, chenillards et matériels de levage.</p></div></div>
      <div class="task-extra-grid">
        <label class="field"><span>Famille d’engin</span><select id="row_family">${selectOptions(Object.keys(EQUIPMENT_TYPES), family, "Choisir une famille")}</select></label>
        <label class="field"><span>Type d’engin</span><select id="row_type">${selectOptions(EQUIPMENT_TYPES[family] || [], type, "Choisir un type d’engin")}</select></label>
        <label class="field"><span>Entreprise</span><select id="row_company">${selectOptions(COMPANY_OPTIONS, company, "Choisir une entreprise")}</select></label>
        <label class="field"><span>Nombre</span><input id="row_count" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(row.count ?? "")}" placeholder="Ex. 1" /></label>
      </div>
      <label id="row_companyOtherField" class="field ${company === "Autre" ? "" : "hidden"}"><span>Autre entreprise</span><input id="row_companyOther" value="${escapeHtml(row.companyOther ?? "")}" placeholder="Nom de l’entreprise" autocomplete="organization" /></label>
      <label id="row_typeOtherField" class="field ${isOtherEquipmentType(type) ? "" : "hidden"}"><span>Préciser le type d’engin</span><input id="row_typeOther" value="${escapeHtml(row.typeOther ?? "")}" placeholder="Ex. portique, wagon outillé…" /></label>
      <details class="optional-details"><summary>Identification, zone et sécurité</summary><div class="task-extra-grid"><label class="field"><span>Identification</span><input id="row_identification" value="${escapeHtml(row.identification ?? "")}" placeholder="Ex. Pelle RR ETF 01 / immatriculation" /></label><label class="field"><span>Voie / zone d’intervention</span><input id="row_zone" value="${escapeHtml(row.zone ?? "")}" placeholder="Ex. V1, plateforme, accès nord" /></label><label class="field"><span>PK / secteur</span><input id="row_pk" value="${escapeHtml(row.pk ?? "")}" placeholder="Ex. PK 79,240" /></label><label id="row_railRoadDetails" class="field ${family === "Rail-route / LAM" ? "" : "hidden"}"><span>Mise en voie</span><select id="row_miseEnVoie">${selectOptions(["Plateforme aménagée", "Sans plateforme aménagée", "Déjà en voie", "Non concerné"], row.miseEnVoie || "", "Choisir le mode")}</select></label></div><label class="field"><span>Observation / mesure de sécurité</span><textarea id="row_observation" rows="3" placeholder="Remorque, stabilisateurs, limite de circulation, coactivité, consigne…">${escapeHtml(row.observation ?? "")}</textarea></label></details>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer l’engin</button></div>
    </div>`;
  }

  function bindEquipmentEditor() {
    $("#row_family")?.addEventListener("change", () => refreshEquipmentTypes());
    $("#row_company")?.addEventListener("change", toggleOtherCompany);
    $("#row_type")?.addEventListener("change", () => $("#row_typeOtherField")?.classList.toggle("hidden", !isOtherEquipmentType(editorValue("row_type"))));
  }

  function readEquipmentEditor() {
    const type = editorValue("row_type");
    return {
      family: editorValue("row_family"), type, typeOther: editorValue("row_typeOther"), name: type, company: editorValue("row_company"), companyOther: editorValue("row_companyOther"),
      count: editorValue("row_count"), identification: editorValue("row_identification"), zone: editorValue("row_zone"), pk: editorValue("row_pk"),
      miseEnVoie: editorValue("row_miseEnVoie"), observation: editorValue("row_observation"),
    };
  }

  function possessionTimesAreShared(row) {
    if (row.useSameTimes === false) return false;
    const starts = [row.plannedStart, row.agreedStart, row.actualStart].filter(Boolean);
    const ends = [row.plannedEnd, row.agreedEnd, row.actualEnd].filter(Boolean);
    return !starts.length || (new Set(starts).size === 1 && new Set(ends).size === 1);
  }

  function renderPossessionEditor(row) {
    const shared = possessionTimesAreShared(row);
    const start = row.actualStart || row.agreedStart || row.plannedStart || state.meta.shiftStart || "";
    const end = row.actualEnd || row.agreedEnd || row.plannedEnd || state.meta.shiftEnd || "";
    return `<div class="resource-editor">
      <div class="resource-banner"><span class="resource-symbol">T</span><div><strong>Possession / consignation</strong><p>En saisie habituelle, indiquer seulement la voie et les horaires réels. Les autres horaires peuvent être repris automatiquement.</p></div></div>
      <div class="task-extra-grid"><label class="field"><span>Voie</span><input id="row_voie" value="${escapeHtml(row.voie ?? "")}" placeholder="Ex. V1" /></label><label class="field"><span>Début réel</span><input id="row_actualStart" type="time" value="${escapeHtml(start)}" /></label><label class="field"><span>Fin réelle</span><input id="row_actualEnd" type="time" value="${escapeHtml(end)}" /></label></div>
      <label class="check-row"><input id="row_useSameTimes" type="checkbox" ${shared ? "checked" : ""} /> Prévue, accordée et réelle identiques</label>
      <details id="rowPossessionAdvanced" class="optional-details ${shared ? "hidden" : ""}" ${shared ? "" : "open"}><summary>Préciser les horaires prévus / accordés</summary><div class="task-extra-grid"><label class="field"><span>Prévue — début</span><input id="row_plannedStart" type="time" value="${escapeHtml(row.plannedStart ?? start)}" /></label><label class="field"><span>Prévue — fin</span><input id="row_plannedEnd" type="time" value="${escapeHtml(row.plannedEnd ?? end)}" /></label><label class="field"><span>Accordée — début</span><input id="row_agreedStart" type="time" value="${escapeHtml(row.agreedStart ?? start)}" /></label><label class="field"><span>Accordée — fin</span><input id="row_agreedEnd" type="time" value="${escapeHtml(row.agreedEnd ?? end)}" /></label></div></details>
      <label class="field"><span>Observation</span><textarea id="row_observation" rows="3" placeholder="ARF, AAN, motif de décalage…">${escapeHtml(row.observation ?? "")}</textarea></label>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer la possession</button></div>
    </div>`;
  }

  function bindPossessionEditor() {
    $("#row_useSameTimes")?.addEventListener("change", (event) => {
      const details = $("#rowPossessionAdvanced");
      if (!details) return;
      details.classList.toggle("hidden", event.target.checked);
      if (!event.target.checked) details.open = true;
    });
  }

  function readPossessionEditor() {
    const shared = Boolean($("#row_useSameTimes")?.checked);
    const actualStart = editorValue("row_actualStart");
    const actualEnd = editorValue("row_actualEnd");
    return {
      voie: editorValue("row_voie"), actualStart, actualEnd, useSameTimes: shared,
      plannedStart: shared ? actualStart : editorValue("row_plannedStart"),
      plannedEnd: shared ? actualEnd : editorValue("row_plannedEnd"),
      agreedStart: shared ? actualStart : editorValue("row_agreedStart"),
      agreedEnd: shared ? actualEnd : editorValue("row_agreedEnd"),
      observation: editorValue("row_observation"),
    };
  }

  const rowConfig = {
    personnel: {
      title: "Personnel et intervenants", editor: renderPersonnelEditor, bind: bindPersonnelEditor, read: readPersonnelEditor,
      display: (row) => `<h3><span class="resource-mini personnel-mini">P</span>${escapeHtml(roleName(row))} · ${displayNumber(row.count, 0)} pers.</h3><p><span class="resource-chip">${escapeHtml(row.team || "Intervenant")}</span><span>${escapeHtml(companyName(row))}</span>${row.hours ? `<span>${displayNumber(row.hours)} h/pers.</span>` : ""}${row.lead ? `<span>${escapeHtml(row.lead)}</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
    equipment: {
      title: "Engin ou mobile travaux", editor: renderEquipmentEditor, bind: bindEquipmentEditor, read: readEquipmentEditor,
      display: (row) => `<h3><span class="resource-mini equipment-mini">E</span>${escapeHtml(equipmentName(row))}${row.count ? ` · ${displayNumber(row.count, 0)}` : ""}</h3><p><span class="resource-chip">${escapeHtml(row.family || "Matériel")}</span><span>${escapeHtml(companyName(row))}</span>${row.identification ? `<span>${escapeHtml(row.identification)}</span>` : ""}${row.zone ? `<span>${escapeHtml([row.zone, row.pk].filter(Boolean).join(" · "))}</span>` : row.pk ? `<span>${escapeHtml(row.pk)}</span>` : ""}${row.miseEnVoie ? `<span>${escapeHtml(row.miseEnVoie)}</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
    possession: {
      title: "Possession / consignation", editor: renderPossessionEditor, bind: bindPossessionEditor, read: readPossessionEditor,
      display: (row) => `<h3>Voie ${escapeHtml(row.voie || "à préciser")} · Réel ${escapeHtml(row.actualStart || "—")} → ${escapeHtml(row.actualEnd || "—")}</h3><p>Prévu ${escapeHtml(row.plannedStart || "—")} → ${escapeHtml(row.plannedEnd || "—")} · Accordé ${escapeHtml(row.agreedStart || "—")} → ${escapeHtml(row.agreedEnd || "—")}${row.observation ? ` · ${escapeHtml(row.observation)}` : ""}</p>`,
    },
    anomaly: {
      title: "Anomalie",
      fields: [
        ["type", "Type", "select", ["Technique", "Sécurité", "Environnement", "Organisation"]],
        ["severity", "Niveau", "select", ["Information", "À surveiller", "Bloquant"]],
        ["detail", "Fait constaté", "textarea", "Décrire factuellement l’anomalie"],
        ["action", "Mesure prise / suite", "textarea", "Action immédiate, responsable, prochaine étape"],
      ],
      display: (row) => `<h3>${escapeHtml(row.type || "Anomalie")} · ${escapeHtml(row.severity || "À préciser")}</h3><p>${escapeHtml(row.detail || "Sans détail")}${row.action ? ` · Suite : ${escapeHtml(row.action)}` : ""}</p>`,
    },
    document: {
      title: "Rapport fourni",
      fields: [
        ["name", "Document / fiche", "text", "Ex. Fiche de libération"],
        ["reference", "Référence", "text", "N° ou lien"],
        ["observation", "Observation", "textarea", "Contenu ou réserve éventuelle"],
      ],
      display: (row) => `<h3>${escapeHtml(row.name || "Document à préciser")}${row.reference ? ` · ${escapeHtml(row.reference)}` : ""}</h3><p>${escapeHtml(row.observation || "")}</p>`,
    },
    sncfMeans: {
      title: "Moyen SNCF",
      fields: [
        ["role", "Moyen / fonction", "select", ["RPTx", "CCH", "Adjoint SO / S11", "Agent d’activité", "KB caténaire", "Surveillant caténaire", "Surveillant RSE", "KBSE", "Agent RSE", "Agent caténaire", "Agent voie", "Agent SE", "Annonceur / ASP", "RPAC", "Agent PL", "Agent caténaire consignation", "Agent SE mesures S6", "Agent lorry", "Autre"]],
        ["count", "Nombre", "number", ""],
        ["observation", "Observation", "textarea", "Nom, mission, commentaire"],
      ],
      display: (row) => `<h3>${escapeHtml(row.role || "Moyen à préciser")}${row.count ? ` · ${displayNumber(row.count, 0)}` : ""}</h3><p>${escapeHtml(row.observation || "")}</p>`,
    },
  };

  function renderDataList(key) {
    const target = $(`#${key}List`);
    const config = rowConfig[key];
    const rows = state[key] || [];
    target.innerHTML = rows.length ? rows.map((row) => `
      <article class="data-row"><div>${config.display(row)}</div><div>
        <button class="mini-button" type="button" data-edit-row="${key}:${row.id}">Modifier</button>
        <button class="mini-button danger" type="button" data-delete-row="${key}:${row.id}">Supprimer</button>
      </div></article>`).join("") : `<p class="empty-inline">Aucune donnée saisie.</p>`;
  }

  function renderPhotos() {
    const target = $("#photoList");
    if (!target) return;
    const photos = state.photos || [];
    if (!photos.length) {
      target.innerHTML = `<p class="empty-inline">Aucune photo ajoutée. Utiliser « Avant » ou « Après » pour ouvrir l’appareil photo.</p>`;
      return;
    }
    target.innerHTML = ["avant", "apres"].map((phase) => {
      const rows = photos.filter((photo) => photo.phase === phase);
      if (!rows.length) return "";
      const label = phase === "avant" ? "Avant nuit" : "Après nuit";
      return `<section class="photo-group"><h3>${label}</h3><div class="photo-grid">${rows.map((photo) => `<figure class="photo-card"><img src="${photo.dataUrl}" alt="${escapeHtml(`${label} — ${photo.caption || "photo terrain"}`)}" /><figcaption><strong>${formatDateTime(photo.capturedAt)}</strong><input data-photo-caption="${escapeHtml(photo.id)}" value="${escapeHtml(photo.caption || "")}" placeholder="Légende / localisation" /><button type="button" class="mini-button danger" data-delete-photo="${escapeHtml(photo.id)}">Supprimer</button></figcaption></figure>`).join("")}</div></section>`;
    }).join("");
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("lecture"));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  async function compactPhoto(file) {
    if (!file?.type?.startsWith("image/")) throw new Error("format");
    const source = await readImage(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = source;
    });
    const maxSize = 960;
    const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.64);
  }

  async function addPhotos(files) {
    const selected = [...(files || [])].slice(0, Math.max(0, MAX_PHOTOS - state.photos.length));
    if (!selected.length) {
      alert(`Maximum de ${MAX_PHOTOS} photos par rapport atteint.`);
      return;
    }
    const added = [];
    for (const file of selected) {
      try {
        added.push({ id: uid(), phase: selectedPhotoPhase, capturedAt: new Date().toISOString(), caption: "", dataUrl: await compactPhoto(file) });
      } catch (_) {
        alert(`La photo « ${file.name || "sans nom"} » n’a pas pu être ajoutée.`);
      }
    }
    if (!added.length) return;
    state.photos.push(...added);
    if (!save(`${added.length} photo(s) ajoutée(s)`)) {
      state.photos.splice(-added.length, added.length);
      return;
    }
    renderPhotos();
    renderPrintReport();
  }

  function drawSignatureData(dataUrl = "") {
    const canvas = $("#afterWorkSignatureCanvas");
    if (!canvas || !signatureCanvasReady) return;
    const context = canvas.getContext("2d");
    const ratio = Number(canvas.dataset.ratio || 1);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.save();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.restore();
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => {
      context.save();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.drawImage(image, 0, 0, width, height);
      context.restore();
    };
    image.src = dataUrl;
  }

  function renderAfterWorkSignature() {
    const signature = state.afterWorkSignature || {};
    const name = $("#afterWorkSignerName");
    const role = $("#afterWorkSignerRole");
    if (name && document.activeElement !== name) name.value = signature.name || "";
    if (role && document.activeElement !== role) role.value = signature.role || "";
    const status = $("#afterWorkSignatureStatus");
    if (status) status.textContent = signature.signedAt
      ? `Signée le ${formatDateTime(signature.signedAt)}${signature.name ? ` par ${signature.name}` : ""}.`
      : "Signer au doigt dans la zone ci-dessus.";
    if (signatureCanvasReady) drawSignatureData(signature.dataUrl);
  }

  function setupSignatureCanvas() {
    const canvas = $("#afterWorkSignatureCanvas");
    if (!canvas || signatureCanvasReady) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(300, Math.floor(rect.width || 300) * ratio);
      canvas.height = 148 * ratio;
      canvas.dataset.ratio = String(ratio);
      drawSignatureData(state.afterWorkSignature?.dataUrl || "");
    };
    let drawing = false;
    let lastPoint = null;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const context = () => {
      const drawingContext = canvas.getContext("2d");
      const ratio = Number(canvas.dataset.ratio || 1);
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawingContext.strokeStyle = "#17272c";
      drawingContext.lineWidth = 2.2;
      drawingContext.lineCap = "round";
      drawingContext.lineJoin = "round";
      return drawingContext;
    };
    canvas.addEventListener("pointerdown", (event) => {
      drawing = true;
      lastPoint = point(event);
      canvas.setPointerCapture?.(event.pointerId);
      const drawingContext = context();
      drawingContext.beginPath();
      drawingContext.moveTo(lastPoint.x, lastPoint.y);
      drawingContext.arc(lastPoint.x, lastPoint.y, 0.8, 0, Math.PI * 2);
      drawingContext.fillStyle = "#17272c";
      drawingContext.fill();
      event.preventDefault();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      const next = point(event);
      const drawingContext = context();
      drawingContext.beginPath();
      drawingContext.moveTo(lastPoint.x, lastPoint.y);
      drawingContext.lineTo(next.x, next.y);
      drawingContext.stroke();
      lastPoint = next;
      event.preventDefault();
    });
    const finish = () => {
      if (!drawing) return;
      drawing = false;
      state.afterWorkSignature.dataUrl = canvas.toDataURL("image/png");
      state.afterWorkSignature.signedAt = new Date().toISOString();
      save("Visa après travaux signé");
      renderAfterWorkSignature();
      renderPrintReport();
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    signatureCanvasReady = true;
    resize();
    window.addEventListener("resize", resize);
  }

  function validation() {
    const checks = [];
    const metaMissing = [state.meta.operation, state.meta.reportNo, state.meta.date].some((value) => !value);
    checks.push({ ok: !metaMissing, message: metaMissing ? "Contexte incomplet : opération, numéro et date sont nécessaires." : "Contexte de séance renseigné." });
    if (state.meta.cancelled) {
      checks.push({ ok: Boolean(state.meta.cancelReason), message: state.meta.cancelReason ? "Motif d’annulation renseigné." : "Ajouter le motif d’annulation." });
    } else {
      checks.push({ ok: state.tasks.length > 0, message: state.tasks.length ? "Au moins une prestation est saisie." : "Ajouter les prestations réellement réalisées." });
      if (isAdminView()) {
        const openTasks = state.tasks.filter((task) => resolveTask(task).status !== "priced");
        checks.push({ ok: openTasks.length === 0, message: openTasks.length ? `${openTasks.length} ligne(s) hors catalogue ou incomplètes restent à contrôler.` : "Toutes les prestations saisies sont rattachées au référentiel administrateur." });
      }
    }
    return checks;
  }

  function renderReview() {
    const checks = validation();
    const okay = checks.every((check) => check.ok);
    $("#reviewChecks").innerHTML = checks.map((check) => `<div class="review-check ${check.ok ? "ok" : "issue"}"><strong>${check.ok ? "✓" : "!"}</strong><span>${escapeHtml(check.message)}</span></div>`).join("");
    const status = $("#reviewStatus");
    status.className = `status-chip ${okay ? "success" : "warning"}`;
    status.textContent = okay ? "Prêt à éditer" : "Brouillon";
    renderAdminPanel();
  }

  function renderValuationPreview() {
    const breakdown = valuationBreakdown();
    const { valuations, commonCosts, total } = breakdown;
    const commonRows = commonCosts.map((row) => `
      <tr class="valuation-common"><td>${escapeHtml(row.label)}<br><small>Base de calcul : ${euros(row.base)}</small></td>
      <td>${escapeHtml(row.article)}</td><td class="numeric">Base ${euros(row.base)}</td><td>${displayNumber(row.rate * 100)} %</td><td class="numeric">—</td><td class="numeric">${euros(row.amount)}</td></tr>`).join("");
    const commonNote = commonCosts.length
      ? "Les dispositions communes sont incluses à titre indicatif sur la base des prestations du rapport. Elles restent à rapprocher de la situation de travaux hebdomadaire."
      : "Les dispositions communes (PB1-1-1, PB1-1-2 et PB1-2-1) restent désactivées tant que l’administrateur ne les active pas pour le contrôle hebdomadaire.";
    $("#valuationPreview").innerHTML = valuations.length ? `
      <table class="valuation-table"><thead><tr><th>Prestation</th><th>Réf. PB</th><th class="numeric">Qté</th><th>CR</th><th class="numeric">PU HT</th><th class="numeric">Montant HT</th></tr></thead>
      <tbody>${valuations.map(({ task, template, result }) => `
        <tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}${result.status !== "priced" ? `<br><small>${escapeHtml(result.reason)}</small>` : ""}</td>
        <td>${result.record ? escapeHtml(result.record.article) : "Hors catalogue"}</td>
        <td class="numeric">${displayNumber(result.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}</td>
        <td>${renderRateEditor(task, result)}</td>
        <td class="numeric">${result.status === "priced" ? euros(result.unitPrice) : "—"}</td>
        <td class="numeric">${result.status === "priced" ? euros(result.amount) : "—"}</td></tr>`).join("")}
        ${commonRows}
        <tr class="valuation-total"><td colspan="5">Total valorisé indicatif HT</td><td class="numeric">${euros(total)}</td></tr></tbody></table>
      <p class="muted" style="margin-top:9px;font-size:.79rem">Référentiel complété avec le décompte n°04 PCLE. Pour la série 300, le PU est contrôlé selon la formule documentée dans le décompte ; une valeur CR exceptionnelle peut être ajustée ici par l’administrateur. ${commonNote}</p>` : `<p class="empty-inline">La valorisation apparaîtra dès la première prestation.</p>`;
  }

  function renderRateEditor(task, result) {
    if (result.record?.pricingFamily !== "serie-300") return "—";
    const profile = billingEvidence.series300Profiles?.[result.record.article] || {};
    const options = [...new Set([...(profile.observedCrs || []), 1.75, 1.9])].sort((a, b) => a - b);
    const selected = number(task.billingCr);
    const defaultLabel = profile.defaultCr ? `Automatique (${displayNumber(profile.defaultCr)})` : "À confirmer";
    return `<select class="rate-select" data-task-rate="${escapeHtml(task.id)}"><option value="" ${selected ? "" : "selected"}>${escapeHtml(defaultLabel)}</option>${options.map((rate) => `<option value="${rate}" ${selected === rate ? "selected" : ""}>CR ${displayNumber(rate)}</option>`).join("")}</select>`;
  }

  function renderAdminPanel() {
    const configured = isAdminConfigured();
    const unlocked = isAdminView();
    $("#adminLockedPane").classList.toggle("hidden", unlocked || adminLoginOpen);
    $("#adminLoginPane").classList.toggle("hidden", unlocked || !adminLoginOpen);
    $("#adminWorkspace").classList.toggle("hidden", !unlocked);
    $$(".admin-finance").forEach((element) => element.classList.toggle("hidden", !unlocked));
    $("#printButton").textContent = unlocked ? "Imprimer rapport + annexe interne" : "Imprimer le rapport PDF";
    if (adminLoginOpen && !unlocked) {
      $("#adminLoginTitle").textContent = configured ? "Déverrouiller l’espace administrateur" : "Initialiser l’espace administrateur";
      $("#adminLoginHint").textContent = configured
        ? "Saisir le code administrateur de cet appareil."
        : "Première utilisation sur cet appareil : choisissez un code à 6 chiffres, réservé à l’administrateur principal.";
      $("#adminPinLabel").textContent = configured ? "Code à 6 chiffres" : "Créer le code à 6 chiffres";
      $("#confirmAdminButton").textContent = configured ? "Déverrouiller" : "Initialiser et ouvrir";
      return;
    }
    if (!unlocked) return;
    const breakdown = valuationBreakdown();
    const open = breakdown.valuations.length - breakdown.priced.length;
    $("#adminEvidenceNote").textContent = `${billingEvidence.sourceLabel || "Référentiel de décompte"} : ${billingEvidence.billedTimeArticleBases?.length || 0} postes PB2, ${billingEvidence.billedSeries300Articles?.length || 0} articles Série 300 et les postes PB1 observés sont intégrés.`;
    $("#includeCommonCostsCheckbox").checked = Boolean(state.settings.admin.includeCommonCosts);
    $("#adminValuationStats").innerHTML = `<span class="admin-stat"><strong>${breakdown.priced.length}</strong> ligne(s) valorisée(s)</span><span class="admin-stat"><strong>${open}</strong> à contrôler</span><span class="admin-stat"><strong>${euros(breakdown.total)}</strong> HT indicatif</span>`;
    renderValuationPreview();
  }

  function openAdminAccess() {
    adminLoginOpen = true;
    renderAdminPanel();
    window.setTimeout(() => $("#adminPinInput")?.focus(), 0);
  }

  function closeAdminAccess() {
    adminLoginOpen = false;
    $("#adminPinInput").value = "";
    renderAdminPanel();
  }

  function confirmAdminAccess() {
    const pin = $("#adminPinInput").value.trim();
    if (!/^\d{6}$/.test(pin)) { alert("Le code administrateur doit contenir exactement 6 chiffres."); return; }
    if (isAdminConfigured() && hashAdminPin(pin) !== state.settings.admin.pinHash) { alert("Code administrateur incorrect."); return; }
    if (!isAdminConfigured()) {
      state.settings.admin = { pinHash: hashAdminPin(pin), configuredAt: new Date().toISOString(), includeCommonCosts: false };
    }
    adminUnlocked = true;
    try { sessionStorage.setItem(adminSessionKey, "1"); } catch (_) { /* Session locale indisponible. */ }
    adminLoginOpen = false;
    $("#adminPinInput").value = "";
    save("Mode administrateur ouvert");
    refresh();
  }

  function lockAdminAccess() {
    adminUnlocked = false;
    adminLoginOpen = false;
    try { sessionStorage.removeItem(adminSessionKey); } catch (_) { /* Session locale indisponible. */ }
    save("Mode terrain verrouillé");
    refresh();
  }

  function refresh({ inputs = false } = {}) {
    if (inputs) renderInputs();
    renderPricingContext();
    renderHeader();
    renderQuickCatalog();
    renderTasks();
    ["personnel", "equipment", "possession", "anomaly", "document", "sncfMeans"].forEach(renderDataList);
    renderPhotos();
    renderAfterWorkSignature();
    renderReview();
    renderPrintReport();
  }

  function openTaskCatalog(editId = null) {
    taskDraft = editId ? clone(state.tasks.find((task) => task.id === editId)) : null;
    if (!editId) { catalogSearch = ""; catalogCategory = "Toutes"; }
    $("#taskDialogTitle").textContent = editId ? "Modifier une prestation" : "Ajouter une prestation";
    $("#taskCatalogPane").classList.toggle("hidden", Boolean(taskDraft));
    $("#taskEditorPane").classList.toggle("hidden", !taskDraft);
    if (taskDraft) renderTaskEditor(templateById.get(taskDraft.templateId), taskDraft);
    else renderTaskCatalog();
    $("#taskDialog").showModal();
  }

  function renderTaskCatalog() {
    const available = terrainCatalog.filter((template) => !template.legacy);
    const categories = ["Toutes", ...new Set(available.map((template) => template.category))];
    const query = normalise(catalogSearch);
    const filtered = available.filter((template) => {
      const inCategory = catalogCategory === "Toutes" || template.category === catalogCategory;
      const haystack = normalise(`${template.label} ${template.reportLabel} ${template.hint}`);
      return inCategory && (!query || haystack.includes(query));
    });
    const groups = filtered.reduce((acc, template) => {
      (acc[template.category] ||= []).push(template);
      return acc;
    }, {});
    const options = Object.entries(groups).map(([category, templates]) => `
      <section class="catalog-group"><h3>${escapeHtml(category)}</h3><div class="catalog-options">${templates.map((template) => `
        <button class="catalog-option" data-select-template="${escapeHtml(template.id)}" type="button"><strong>${escapeHtml(template.label)}</strong><span>${escapeHtml(template.hint)}</span></button>`).join("")}</div></section>`).join("");
    $("#taskCatalogPane").innerHTML = `<div class="catalog-toolbar"><label class="catalog-search"><span>Rechercher</span><input id="catalogSearch" value="${escapeHtml(catalogSearch)}" placeholder="Ex. câble, chambre, CI, RVL…" autofocus /></label><div class="catalog-filters">${categories.map((category) => `<button type="button" class="catalog-filter ${category === catalogCategory ? "active" : ""}" data-catalog-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div></div><div class="catalog-groups">${options || `<div class="empty-state"><p>Aucune prestation ne correspond à cette recherche.</p></div>`}</div>`;
  }

  function renderTaskEditor(template, existing = null) {
    if (!template) return;
    const task = existing || {
      id: uid(), templateId: template.id, label: template.reportLabel, unit: template.unit, quantity: "", voie: "", pkStart: "", pkEnd: "", note: "", opening: "", closing: "",
    };
    taskDraft = task;
    const isCustom = template.id === "saisie-libre";
    const customFields = template.metric === "openClose" ? `
      <label class="field"><span>Longueur ouverte (ml)</span><input id="taskOpening" type="number" min="0" step="0.1" inputmode="decimal" value="${escapeHtml(task.opening)}"></label>
      <label class="field"><span>Longueur refermée (ml)</span><input id="taskClosing" type="number" min="0" step="0.1" inputmode="decimal" value="${escapeHtml(task.closing)}"></label>` : `
      <label class="field"><span>${escapeHtml(template.quantityLabel)}</span><input id="taskQuantity" type="number" min="0" step="0.1" inputmode="decimal" value="${escapeHtml(task.quantity)}" autofocus></label>`;
    const route = template.priceRoute?.type;
    const routeConfig = template.priceRoute || {};
    const note = isAdminView()
      ? (["mapped", "time-mapped"].includes(route)
        ? (routeConfig.mappingNote || "Le rattachement par défaut est déjà appliqué ; l’encadrant peut le modifier dans les réglages d’exception.")
        : route === "manual"
          ? (routeConfig.reason || "La production sera présente dans le rapport ; le rattachement au prix devra être fait par l’encadrant.")
          : "Le rattachement au référentiel sera contrôlé dans l’espace administrateur.")
      : "La prestation est enregistrée au rapport avec son libellé terrain. Le contrôle administratif est réalisé séparément.";
    $("#taskCatalogPane").classList.add("hidden");
    const pane = $("#taskEditorPane");
    pane.classList.remove("hidden");
    pane.innerHTML = `
      <div class="task-editor">
        <div class="task-identity"><strong>${escapeHtml(template.label)}</strong><p>${escapeHtml(template.hint)}</p></div>
        ${isCustom ? `<label class="field"><span>Libellé terrain</span><input id="taskLabel" value="${escapeHtml(task.label === template.reportLabel ? "" : task.label)}" placeholder="Décrire simplement la prestation"></label>` : ""}
        <div class="task-extra-grid">${customFields}</div>
        <details class="optional-details"><summary>Ajouter une localisation / observation</summary><div class="task-extra-grid"><label class="field"><span>Voie</span><input id="taskVoie" value="${escapeHtml(task.voie)}" placeholder="Ex. V1"></label><label class="field"><span>PK début</span><input id="taskPkStart" value="${escapeHtml(task.pkStart)}" placeholder="Ex. 80+050"></label><label class="field"><span>PK fin</span><input id="taskPkEnd" value="${escapeHtml(task.pkEnd)}" placeholder="Ex. 80+200"></label></div><label class="field"><span>Observation / précision</span><textarea id="taskNote" rows="3" placeholder="Localisation, type précis, difficulté, matériel…">${escapeHtml(task.note)}</textarea></label></details>
        <p class="dialog-note">${escapeHtml(note)}</p>
        <div class="dialog-actions"><button id="backToTaskCatalog" type="button" class="secondary-button">Retour</button><button id="saveTaskButton" type="button" class="primary-button">Enregistrer la prestation</button></div>
      </div>`;
  }

  function saveTask() {
    if (!taskDraft) return;
    const template = templateById.get(taskDraft.templateId);
    taskDraft.label = template.id === "saisie-libre" ? ($("#taskLabel").value.trim() || template.reportLabel) : template.reportLabel;
    taskDraft.unit = template.unit;
    taskDraft.quantity = template.metric === "openClose" ? "" : $("#taskQuantity").value;
    taskDraft.opening = template.metric === "openClose" ? $("#taskOpening").value : "";
    taskDraft.closing = template.metric === "openClose" ? $("#taskClosing").value : "";
    taskDraft.voie = $("#taskVoie").value.trim();
    taskDraft.pkStart = $("#taskPkStart").value.trim();
    taskDraft.pkEnd = $("#taskPkEnd").value.trim();
    taskDraft.note = $("#taskNote").value.trim();
    const existingIndex = state.tasks.findIndex((task) => task.id === taskDraft.id);
    if (existingIndex >= 0) state.tasks.splice(existingIndex, 1, taskDraft);
    else state.tasks.push(taskDraft);
    save("Prestation enregistrée");
    $("#taskDialog").close();
    taskDraft = null;
    refresh();
  }

  function openRowDialog(key, row = null) {
    const config = rowConfig[key];
    rowDraft = { key, row: row ? clone(row) : { id: uid() } };
    $("#rowDialogTitle").textContent = row ? `Modifier · ${config.title}` : `Ajouter · ${config.title}`;
    if (config.editor) {
      $("#rowEditorPane").innerHTML = config.editor(rowDraft.row);
      config.bind?.();
    } else {
      $("#rowEditorPane").innerHTML = `<div class="task-editor">${config.fields.map(([name, label, type, placeholder]) => {
        const value = rowDraft.row[name] ?? "";
        if (type === "textarea") return `<label class="field"><span>${escapeHtml(label)}</span><textarea id="row_${name}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label>`;
        if (type === "select") return `<label class="field"><span>${escapeHtml(label)}</span><select id="row_${name}"><option value="">À renseigner</option>${placeholder.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
        return `<label class="field"><span>${escapeHtml(label)}</span><input id="row_${name}" type="${type}" ${type === "number" ? "step=0.1 inputmode=decimal" : ""} value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></label>`;
      }).join("")}<div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer</button></div></div>`;
    }
    $("#rowDialog").showModal();
  }

  function saveRow() {
    if (!rowDraft) return;
    const config = rowConfig[rowDraft.key];
    if (config.read) Object.assign(rowDraft.row, config.read());
    else config.fields.forEach(([name]) => { rowDraft.row[name] = $(`#row_${name}`).value.trim(); });
    const list = state[rowDraft.key];
    const index = list.findIndex((item) => item.id === rowDraft.row.id);
    if (index >= 0) list.splice(index, 1, rowDraft.row);
    else list.push(rowDraft.row);
    save("Élément enregistré");
    $("#rowDialog").close();
    rowDraft = null;
    refresh();
  }

  function renderMappingDialog() {
    const mappedTemplates = terrainCatalog.filter((template) => !template.legacy && ["mapped", "time-mapped"].includes(template.priceRoute?.type));
    $("#mappingPane").innerHTML = mappedTemplates.map((template) => {
      const route = template.priceRoute || {};
      const isTimeMapped = route.type === "time-mapped";
      const selected = mappedArticleFor(template);
      const candidates = isTimeMapped ? timeCandidatesFor(template) : candidatesFor(template);
      const placeholder = isTimeMapped ? "Famille automatique" : "Référence automatique";
      const options = candidates.map((record) => {
        const value = isTimeMapped ? record.articleBase : record.article;
        const unitPrice = documentedUnitPrice(record);
        const amount = unitPrice === null ? "CR à confirmer" : `${euros(unitPrice)}${record.pricingFamily === "serie-300" ? " (nuit sem.)" : ""}`;
        const label = isTimeMapped
          ? `${record.articleBase} — ${record.description.slice(0, 105)} · variante jour ${amount}`
          : `${record.article} — ${record.description.slice(0, 105)} · ${amount}`;
        return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
      }).join("");
      const select = candidates.length ? `<select id="mapping_${template.id}"><option value="">${placeholder}</option>${options}</select>` : `<span class="muted">Aucun candidat trouvé dans le bordereau.</span>`;
      const note = route.mappingNote ? `<p class="muted">${escapeHtml(route.mappingNote)}</p>` : "";
      return `<article class="mapping-item"><h3>${escapeHtml(template.label)}</h3><p>${escapeHtml(template.hint)}</p>${note}<div class="mapping-actions">${select}${candidates.length ? `<button class="secondary-button" type="button" data-save-mapping="${template.id}">Enregistrer l’exception</button>` : ""}</div></article>`;
    }).join("");
  }

  function renderTableRows(rows, builder, columnCount) {
    return rows.length ? rows.map(builder).join("") : `<tr><td colspan="${columnCount}" class="print-empty">Aucune donnée saisie.</td></tr>`;
  }

  function renderPrintReport() {
    const includeValuation = isAdminView();
    const breakdown = valuationBreakdown();
    const resolved = breakdown.valuations;
    const total = breakdown.total;
    const reportTitle = state.meta.cancelled ? "RAPPORT JOURNALIER — CHANTIER ANNULÉ" : "RAPPORT JOURNALIER";
    const durationText = state.meta.workDuration ? `${displayNumber(state.meta.workDuration)} h` : "—";
    const taskRows = renderTableRows(resolved, ({ task, template, result }) => `
      <tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}${task.note ? `<br><small>${escapeHtml(task.note)}</small>` : ""}</td>
      <td class="numeric">${template?.metric === "openClose" ? `Ouv. ${displayNumber(task.opening)}<br>Ferm. ${displayNumber(task.closing)}` : `${displayNumber(task.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}`}</td>
      <td>${escapeHtml(task.voie || "—")}</td><td>${escapeHtml([task.pkStart, task.pkEnd].filter(Boolean).join(" → ") || "—")}</td>
      <td>Saisie terrain</td></tr>`, 5);
    const personnelRows = renderTableRows(state.personnel, (row) => `<tr><td>${escapeHtml(roleName(row))}</td><td>${escapeHtml([row.team, companyName(row)].filter(Boolean).join(" · "))}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td class="numeric">${row.hours ? displayNumber(row.hours) : "—"}</td><td>${escapeHtml([row.lead, row.observation].filter(Boolean).join(" · ") || "—")}</td></tr>`, 5);
    const equipmentRows = renderTableRows(state.equipment, (row) => `<tr><td>${escapeHtml(equipmentName(row))}</td><td>${escapeHtml(companyName(row))}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td>${escapeHtml([row.zone, row.pk, row.miseEnVoie].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml([row.identification, row.observation].filter(Boolean).join(" · ") || "—")}</td></tr>`, 5);
    const possessionRows = renderTableRows(state.possessions, (row) => `<tr><td>${escapeHtml(row.voie || "—")}</td><td>${escapeHtml(`${row.plannedStart || "—"} → ${row.plannedEnd || "—"}`)}</td><td>${escapeHtml(`${row.agreedStart || "—"} → ${row.agreedEnd || "—"}`)}</td><td>${escapeHtml(`${row.actualStart || "—"} → ${row.actualEnd || "—"}`)}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 5);
    const anomalyRows = renderTableRows(state.anomalies, (row) => `<tr><td>${escapeHtml(row.type || "—")}</td><td>${escapeHtml(row.severity || "—")}</td><td>${escapeHtml(row.detail || "—")}</td><td>${escapeHtml(row.action || "—")}</td></tr>`, 4);
    const documentsRows = renderTableRows(state.documents, (row) => `<tr><td>${escapeHtml(row.name || "—")}</td><td>${escapeHtml(row.reference || "—")}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 3);
    const sncfRows = renderTableRows(state.sncfMeans, (row) => `<tr><td>${escapeHtml(row.role || "—")}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 3);
    const valuationRows = [
      ...resolved.map(({ task, template, result }) => `<tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}</td><td>${result.record ? escapeHtml(result.record.article) : "Hors catalogue"}</td><td class="numeric">${displayNumber(result.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}</td><td class="numeric">${result.status === "priced" ? euros(result.unitPrice) : "—"}</td><td class="numeric">${result.status === "priced" ? euros(result.amount) : "—"}</td></tr>`),
      ...breakdown.commonCosts.map((row) => `<tr><td>${escapeHtml(row.label)}<br><small>Base de calcul : ${euros(row.base)}</small></td><td>${escapeHtml(row.article)}</td><td class="numeric">Base ${euros(row.base)}</td><td class="numeric">${displayNumber(row.rate * 100)} %</td><td class="numeric">${euros(row.amount)}</td></tr>`),
    ].join("") || `<tr><td colspan="5" class="print-empty">Aucune donnée saisie.</td></tr>`;

    const photoSection = ["avant", "apres"].map((phase) => {
      const rows = state.photos.filter((photo) => photo.phase === phase);
      if (!rows.length) return "";
      const label = phase === "avant" ? "Avant nuit" : "Après nuit";
      return `<section class="print-section"><h2>Photos ${label}</h2><div class="print-photo-grid">${rows.map((photo) => `<figure class="print-photo"><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(label)}"><figcaption><strong>${formatDateTime(photo.capturedAt)}</strong>${photo.caption ? `<br>${escapeHtml(photo.caption)}` : ""}</figcaption></figure>`).join("")}</div></section>`;
    }).join("");
    const signature = state.afterWorkSignature || {};
    const signatureMarkup = signature.dataUrl
      ? `<img class="print-signature-image" src="${escapeHtml(signature.dataUrl)}" alt="Signature après travaux">`
      : `<span>Signature à renseigner</span>`;

    $("#printReport").innerHTML = `
      <article class="print-page">
        <header class="print-header"><div><span class="print-brand">AINM</span><h1 class="print-title">${reportTitle}</h1></div>
          <div class="print-meta">AINM · Travaux signalisation<br>Référentiel rapport journalier<br>Édité le ${formatDate(dateToday())}</div></header>
        <section class="print-section"><h2>Identification</h2><div class="print-info-grid">
          <div><strong>Opération / chantier</strong>${escapeHtml(state.meta.operation || "—")}</div><div><strong>N° rapport</strong>${escapeHtml(state.meta.reportNo || "—")}</div><div><strong>N° commande</strong>${escapeHtml(state.meta.orderNo || "—")}</div>
          <div><strong>Entreprise</strong>${escapeHtml(enterpriseName() || "—")}</div><div><strong>Date / nature</strong>${formatDate(state.meta.date)} · ${escapeHtml(state.meta.shiftType || "—")}</div><div><strong>Intervention réelle</strong>${escapeHtml(`${state.meta.shiftStart || "—"} → ${state.meta.shiftEnd || "—"}`)} · ${durationText}</div>
          <div><strong>Météo / température</strong>${escapeHtml(state.meta.weather || "—")} · ${escapeHtml(state.meta.temperature || "—")} °C</div><div><strong>Rédacteur</strong>${escapeHtml(state.meta.reporter || "—")}</div><div><strong>Régime de séance</strong>${escapeHtml(getShiftContext().label)}</div>
        </div></section>
        ${state.meta.cancelled ? `<section class="print-section"><h2>Annulation du chantier</h2><div class="print-note">${escapeHtml(state.meta.cancelReason || "Motif non renseigné")}</div></section>` : `
        <section class="print-section"><h2>Travaux exécutés</h2><table class="print-table"><thead><tr><th>Prestation terrain</th><th class="numeric">Quantité</th><th>Voie</th><th>PK</th><th>Statut</th></tr></thead><tbody>${taskRows}</tbody></table></section>
        <section class="print-section"><h2>Personnel et intervenants</h2><table class="print-table"><thead><tr><th>Fonction / grade</th><th>Famille / entreprise</th><th class="numeric">Nb</th><th class="numeric">Heures/pers.</th><th>Observation</th></tr></thead><tbody>${personnelRows}</tbody></table></section>
        <section class="print-section"><h2>Engins et mobiles travaux</h2><table class="print-table"><thead><tr><th>Engin / matériel</th><th>Entreprise</th><th class="numeric">Nb</th><th>Zone / voie</th><th>Identification / observation</th></tr></thead><tbody>${equipmentRows}</tbody></table></section>`}
        <section class="print-section"><h2>Périodes d’interception – Consignations</h2><table class="print-table"><thead><tr><th>Voie</th><th>Prévues</th><th>Accordées</th><th>Réelles</th><th>Observations</th></tr></thead><tbody>${possessionRows}</tbody></table></section>
        <section class="print-section"><h2>Anomalies constatées</h2><table class="print-table"><thead><tr><th>Type</th><th>Niveau</th><th>Fait constaté</th><th>Mesure prise / suite</th></tr></thead><tbody>${anomalyRows}</tbody></table></section>
        <section class="print-section"><h2>Rapports fournis par l’entreprise</h2><table class="print-table"><thead><tr><th>Document</th><th>Référence</th><th>Observation</th></tr></thead><tbody>${documentsRows}</tbody></table></section>
        <section class="print-section"><h2>Moyens SNCF entrepreneur</h2><table class="print-table"><thead><tr><th>Fonction</th><th class="numeric">Nb</th><th>Observation</th></tr></thead><tbody>${sncfRows}</tbody></table></section>
        ${photoSection}
        <section class="print-signatures"><div class="signature-box"><strong>Lieu / date</strong>${escapeHtml(formatDate(state.meta.date))}</div><div class="signature-box"><strong>Visa représentant MOETx SNCF</strong>${escapeHtml(state.meta.moeRepresentative || "Nom / prénom à renseigner")}</div><div class="signature-box"><strong>Visa représentant entreprise extérieure</strong>${escapeHtml(state.meta.companyRepresentative || "Nom / prénom à renseigner")}</div><div class="signature-box signature-after-work"><strong>Visa après travaux</strong>${escapeHtml([signature.name, signature.role].filter(Boolean).join(" · ") || "Nom / fonction à renseigner")}${signature.signedAt ? `<small>Signée le ${escapeHtml(formatDateTime(signature.signedAt))}</small>` : ""}${signatureMarkup}</div></section>
        <p class="print-footer">Rapport opérationnel généré depuis l’application rapport journalier AINM.</p>
      </article>
      ${includeValuation ? `<article class="print-page print-internal">
        <header class="print-header"><div><span class="print-brand">AINM</span><h1 class="print-title">ANNEXE DE VALORISATION INTERNE</h1></div><div class="print-meta">${escapeHtml(state.meta.reportNo || "—")}<br>Montants indicatifs HT</div></header>
        <section class="print-section"><h2>Rapprochement production / bordereau</h2><table class="print-table"><thead><tr><th>Prestation terrain</th><th>Référence PB</th><th class="numeric">Quantité / base</th><th class="numeric">PU / taux</th><th class="numeric">Montant HT</th></tr></thead><tbody>${valuationRows}<tr><td colspan="4"><strong>Total valorisé indicatif HT</strong></td><td class="numeric"><strong>${euros(total)}</strong></td></tr></tbody></table></section>
        <section class="print-section"><h2>Contrôle</h2><div class="print-note">Les prestations hors catalogue ou incomplètes restent visibles dans le rapport terrain et nécessitent un contrôle administratif. Les dispositions communes, lorsqu’elles sont activées, sont calculées à titre indicatif à partir des postes du présent rapport. Cette annexe ne remplace pas la validation de la situation de travaux.</div></section>
      </article>` : ""}`;
  }

  function exportState(share = false) {
    const filename = `rapport-journalier-${(state.meta.reportNo || "brouillon").replace(/[^a-zA-Z0-9_-]+/g, "-")}.json`;
    const exportable = clone(state);
    if (!isAdminView()) {
      delete exportable.settings;
      exportable.tasks = exportable.tasks.map(({ billingCr, ...task }) => task);
    }
    const file = new File([JSON.stringify(exportable, null, 2)], filename, { type: "application/json" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      navigator.share({ title: "Rapport journalier", text: state.meta.operation || "Rapport journalier", files: [file] }).catch(() => {});
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function startNewReport(source = state, { reuseResources = false } = {}) {
    const sourceCopy = clone(source);
    archiveCurrentReport();
    const currentSettings = clone(state.settings || {});
    state = initialState();
    Object.assign(state.meta, {
      operation: sourceCopy.meta?.operation || state.meta.operation,
      orderNo: sourceCopy.meta?.orderNo || "",
      enterprise: sourceCopy.meta?.enterprise || state.meta.enterprise,
      enterpriseOther: sourceCopy.meta?.enterpriseOther || "",
      reporter: sourceCopy.meta?.reporter || "",
      moeRepresentative: sourceCopy.meta?.moeRepresentative || "",
      companyRepresentative: sourceCopy.meta?.companyRepresentative || "",
      shiftType: sourceCopy.meta?.shiftType || "nuit",
      shiftStart: sourceCopy.meta?.shiftStart || "22:00",
      shiftEnd: sourceCopy.meta?.shiftEnd || "06:00",
      workDuration: sourceCopy.meta?.workDuration || "",
      weather: "",
      temperature: "",
      publicHoliday: false,
      cancelled: false,
      cancelReason: "",
    });
    if (reuseResources) {
      state.personnel = clone(sourceCopy.personnel || []);
      state.equipment = clone(sourceCopy.equipment || []);
      state.sncfMeans = clone(sourceCopy.sncfMeans || []);
    }
    state.settings = currentSettings;
    ensureSettings();
    ensureState();
  }

  function duplicateLastNight() {
    const history = readReportHistory();
    const source = history.find((report) => report.meta?.shiftType === "nuit")
      || (state.meta.shiftType === "nuit" && (state.personnel.length || state.equipment.length) ? state : null);
    if (!source) {
      alert("Aucune nuit précédente avec personnel ou engin n’est disponible sur cet appareil. Créez le premier rapport puis utilisez Nouveau rapport à la fin de la séance.");
      return;
    }
    const label = `${formatDate(source.meta?.date)} · ${source.meta?.reportNo || "rapport précédent"}`;
    if (!confirm(`Créer un nouveau rapport en reprenant le personnel, les engins et les moyens SNCF de ${label} ? Les travaux, photos, anomalies, consignations et signatures ne seront pas recopiés.`)) return;
    startNewReport(source, { reuseResources: true });
    save("Dernière nuit reprise");
    refresh({ inputs: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setupEvents() {
    $$("[data-path]").forEach((element) => {
      const handler = () => {
        const value = element.type === "checkbox" ? element.checked : element.value;
        setPath(state, element.dataset.path, value);
        if (element.id === "enterpriseInput") $("#enterpriseOtherField")?.classList.toggle("hidden", value !== "Autre");
        save();
        refresh({ inputs: false });
      };
      element.addEventListener(element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input", handler);
    });

    $$("[data-scroll-target]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.scrollTarget}`).scrollIntoView({ behavior: "smooth", block: "start" })));
    $$("[data-duration-preset]").forEach((button) => button.addEventListener("click", () => {
      state.meta.workDuration = button.dataset.durationPreset;
      save("Durée de travaux renseignée");
      refresh({ inputs: true });
    }));
    $("#duplicateLastNightButton").addEventListener("click", duplicateLastNight);
    $("#openTaskCatalog").addEventListener("click", () => openTaskCatalog());
    $("#taskDialog").addEventListener("click", (event) => {
      const filter = event.target.closest("[data-catalog-category]");
      if (filter) { catalogCategory = filter.dataset.catalogCategory; renderTaskCatalog(); return; }
      const select = event.target.closest("[data-select-template]");
      if (select) renderTaskEditor(templateById.get(select.dataset.selectTemplate));
      if (event.target.closest("#backToTaskCatalog")) { taskDraft = null; $("#taskEditorPane").classList.add("hidden"); $("#taskCatalogPane").classList.remove("hidden"); renderTaskCatalog(); }
      if (event.target.closest("#saveTaskButton")) saveTask();
    });
    $("#taskDialog").addEventListener("input", (event) => {
      if (event.target.id !== "catalogSearch") return;
      catalogSearch = event.target.value;
      renderTaskCatalog();
      window.setTimeout(() => { const input = $("#catalogSearch"); input?.focus(); input?.setSelectionRange(catalogSearch.length, catalogSearch.length); }, 0);
    });
    $("#quickCatalog").addEventListener("click", (event) => {
      const button = event.target.closest("[data-template]");
      if (!button) return;
      taskDraft = null;
      $("#taskDialogTitle").textContent = "Ajouter une prestation";
      renderTaskEditor(templateById.get(button.dataset.template));
      $("#taskDialog").showModal();
    });
    $("#emptyTasks").addEventListener("click", (event) => { if (event.target.closest("[data-action='catalog']")) openTaskCatalog(); });
    $("#taskList").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-task]");
      const remove = event.target.closest("[data-delete-task]");
      if (edit) openTaskCatalog(edit.dataset.editTask);
      if (remove && confirm("Supprimer cette prestation ?")) { state.tasks = state.tasks.filter((task) => task.id !== remove.dataset.deleteTask); save("Prestation supprimée"); refresh(); }
    });

    $$('[data-add-row]').forEach((button) => button.addEventListener("click", () => openRowDialog(button.dataset.addRow)));
    $("#rowDialog").addEventListener("click", (event) => { if (event.target.closest("#saveRowButton")) saveRow(); });
    $$(".data-list").forEach((list) => list.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-row]");
      const remove = event.target.closest("[data-delete-row]");
      if (edit) {
        const [key, id] = edit.dataset.editRow.split(":");
        const row = state[key]?.find((item) => item.id === id);
        if (row) openRowDialog(key, row);
        return;
      }
      if (!remove || !confirm("Supprimer cette ligne ?")) return;
      const [key, id] = remove.dataset.deleteRow.split(":");
      state[key] = state[key].filter((row) => row.id !== id);
      save("Ligne supprimée");
      refresh();
    }));

    $("#photoSection").addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-photo-phase]");
      if (!button) return;
      selectedPhotoPhase = button.dataset.addPhotoPhase;
      $("#photoInput").click();
    });
    $("#photoInput").addEventListener("change", async (event) => {
      await addPhotos(event.target.files);
      event.target.value = "";
    });
    $("#photoList").addEventListener("click", (event) => {
      const remove = event.target.closest("[data-delete-photo]");
      if (!remove || !confirm("Supprimer cette photo ?")) return;
      state.photos = state.photos.filter((photo) => photo.id !== remove.dataset.deletePhoto);
      save("Photo supprimée");
      renderPhotos();
      renderPrintReport();
    });
    $("#photoList").addEventListener("change", (event) => {
      const input = event.target.closest("[data-photo-caption]");
      if (!input) return;
      const photo = state.photos.find((item) => item.id === input.dataset.photoCaption);
      if (!photo) return;
      photo.caption = input.value.trim();
      save("Légende photo enregistrée");
      renderPrintReport();
    });
    $("#afterWorkSignerName").addEventListener("input", (event) => {
      state.afterWorkSignature.name = event.target.value;
      save();
      renderAfterWorkSignature();
      renderPrintReport();
    });
    $("#afterWorkSignerRole").addEventListener("input", (event) => {
      state.afterWorkSignature.role = event.target.value;
      save();
      renderAfterWorkSignature();
      renderPrintReport();
    });
    $("#clearAfterWorkSignatureButton").addEventListener("click", () => {
      if (!state.afterWorkSignature.dataUrl || confirm("Effacer la signature après travaux ?")) {
        state.afterWorkSignature.dataUrl = "";
        state.afterWorkSignature.signedAt = "";
        save("Signature effacée");
        renderAfterWorkSignature();
        renderPrintReport();
      }
    });

    $("#printButton").addEventListener("click", () => { renderPrintReport(); window.print(); });
    $("#exportButton").addEventListener("click", () => exportState(false));
    $("#shareButton").addEventListener("click", () => exportState(true));
    $("#openAdminButton").addEventListener("click", openAdminAccess);
    $("#cancelAdminButton").addEventListener("click", closeAdminAccess);
    $("#confirmAdminButton").addEventListener("click", confirmAdminAccess);
    $("#adminPinInput").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); confirmAdminAccess(); } });
    $("#lockAdminButton").addEventListener("click", lockAdminAccess);
    $("#adminPrintButton").addEventListener("click", () => { renderPrintReport(); window.print(); });
    $("#adminConfigurePricesButton").addEventListener("click", () => { renderMappingDialog(); $("#mappingDialog").showModal(); });
    $("#includeCommonCostsCheckbox").addEventListener("change", (event) => {
      if (!isAdminView()) return;
      state.settings.admin.includeCommonCosts = event.target.checked;
      save("Dispositions communes mises à jour");
      refresh();
    });
    $("#valuationPreview").addEventListener("change", (event) => {
      const select = event.target.closest("[data-task-rate]");
      if (!select || !isAdminView()) return;
      const task = state.tasks.find((item) => item.id === select.dataset.taskRate);
      if (!task) return;
      task.billingCr = select.value;
      save("CR de règlement mis à jour");
      refresh();
    });
    $("#newReportButton").addEventListener("click", () => {
      if (!confirm("Créer un nouveau rapport ? Le rapport actuel sera conservé localement pour pouvoir reprendre ses équipes et engins.")) return;
      startNewReport(state);
      save("Nouveau rapport créé");
      refresh({ inputs: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("#moreButton").addEventListener("click", () => $("#moreDialog").showModal());
    $("#duplicateLastNightMenuButton").addEventListener("click", () => { $("#moreDialog").close(); duplicateLastNight(); });
    $("#configurePricesButton").addEventListener("click", () => {
      if (!isAdminView()) return;
      $("#moreDialog").close();
      renderMappingDialog();
      $("#mappingDialog").showModal();
    });
    $("#mappingDialog").addEventListener("click", (event) => {
      const button = event.target.closest("[data-save-mapping]");
      if (!button) return;
      const templateId = button.dataset.saveMapping;
      const select = $(`#mapping_${templateId}`);
      if (select.value) state.settings.mappings[templateId] = select.value;
      else delete state.settings.mappings[templateId];
      save("Réglage d’exception enregistré");
      renderMappingDialog();
      refresh();
    });
    $("#saveSnapshotButton").addEventListener("click", () => { localStorage.setItem(snapshotKey, JSON.stringify(state)); $("#moreDialog").close(); save("Instantané sauvegardé"); });
    $("#importButton").addEventListener("click", () => { $("#moreDialog").close(); $("#importInput").click(); });
    $("#importInput").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (parsed?.schema !== 1) throw new Error("format");
        const currentSettings = clone(state.settings || {});
        const importedSettings = parsed.settings || {};
        state = parsed;
        state.settings = {
          ...currentSettings,
          ...importedSettings,
          mappings: { ...(currentSettings.mappings || {}), ...(importedSettings.mappings || {}) },
          admin: currentSettings.admin || { pinHash: "", configuredAt: "" },
        };
        ensureSettings();
        ensureState();
        adminUnlocked = false;
        adminLoginOpen = false;
        try { sessionStorage.removeItem(adminSessionKey); } catch (_) { /* Session locale indisponible. */ }
        save("Saisie importée");
        refresh({ inputs: true });
      } catch (_) { alert("Ce fichier n’est pas une exportation compatible de rapport journalier."); }
      event.target.value = "";
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  function boot() {
    // Persiste aussi la migration des rapports créés par les versions précédentes
    // afin qu'un rechargement ne réattribue jamais un numéro.
    save();
    renderInputs();
    setupEvents();
    setupSignatureCanvas();
    refresh();
    registerServiceWorker();
  }

  boot();
})();
