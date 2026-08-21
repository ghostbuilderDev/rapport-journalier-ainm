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
  const MAX_PHOTOS = 12;
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
  const canonicalSncfRole = (role) => {
    const value = normalise(role);
    if (value === "kb catenaire") return "KV caténaire";
    if (value === "kbse") return "KVSE";
    if (value === "agent rse") return "Agent RSO";
    if (value === "surveillant rse") return "Surveillant travaux SE";
    if (value === "adjoint so s11" || value === "adjoint s0" || value === "adjoint so") return "Adjoint S11";
    return role;
  };

  const COMPANY_OPTIONS = [
    "BOUYGUES ENERGIES & SERVICES / TSO SIGNALISATION", "SNCF", "ATIF", "SYSTRA", "ETF", "ETF Services", "ETF SERVICE", "Sentinelles du Rail", "LSDR", "TSO", "TSO Signalisation", "TSO (LTV)", "Bouygues", "HP ELEC", "GEQ", "CEM", "Autre",
  ];
  const PERSONNEL_ROLES = {
    "SNCF": ["RPTx", "CCH", "Adjoint S11", "Adjoint S6", "RSO", "Agent d’activité", "Agent prestataire", "KV caténaire", "KVSE", "Surveillant caténaire", "Surveillant travaux SE", "Surveillant voie", "Agent signalisation", "Agent voie", "Agent RSO", "ASP / annonceur", "MOETx", "AMOETx", "CSPS", "Autre"],
    "Entreprise travaux": ["Conducteur travaux", "Chef de chantier", "Chef d’équipe", "Opérateur travaux", "Intérimaire", "Monteur signalisation", "Électricien", "Pelleur", "Conducteur d’engin", "Chef de manœuvre", "Élingueur", "Agent lorry", "Soudeur", "SST", "Autre"],
    "Prestataire sécurité": ["Agent prestataire", "Sentinelle", "Annonceur", "Agent sécurité", "Agent protection physique", "Pelleur", "Percheur", "SST", "Autre"],
  };
  const EQUIPMENT_TYPES = {
    "Rail-route / LAM": ["Pelle rail-route", "Pelle rail-route + remorque", "LAM (Lorry Automoteur)", "Nacelle rail-route", "4 axes", "Lorry", "Lorry à main", "TTx", "Élan", "Autre rail-route"],
    "Routier / chenillard": ["Mini-pelle", "Pelle mécanique supérieure à 2,5 t", "Pelle chenillée", "Bull", "Chargeuse", "Camion", "Camion grue", "Autre engin routier / chenillard"],
    "Manutention / levage": ["Nacelle", "Chariot télescopique", "Manitou", "Grue", "Remorque", "Chariot élévateur", "Autre matériel de levage"],
    "Autre matériel": ["Groupe électrogène", "Compresseur", "Outillage spécialisé", "Autre"],
  };
  const PERSONNEL_PRESETS = [
    ["Entreprise travaux", "Conducteur travaux"], ["Entreprise travaux", "Chef de chantier"], ["Entreprise travaux", "Chef d’équipe"], ["Entreprise travaux", "Opérateur travaux"], ["Entreprise travaux", "Intérimaire"],
    ["Prestataire sécurité", "Agent prestataire"], ["Prestataire sécurité", "Sentinelle"],
  ];
  const EQUIPMENT_PRESETS = [
    ["Rail-route / LAM", "Pelle rail-route"], ["Rail-route / LAM", "LAM (Lorry Automoteur)"], ["Rail-route / LAM", "Nacelle rail-route"], ["Rail-route / LAM", "Lorry"],
    ["Routier / chenillard", "Mini-pelle"], ["Routier / chenillard", "Pelle chenillée"], ["Manutention / levage", "Camion grue"], ["Autre matériel", "Groupe électrogène"],
  ];
  const MATERIAL_TYPES = ["Câble", "Fourreau", "Caniveau", "Béton / mortier", "Fixation / connectique", "Armoire / coffret", "Équipement signalisation", "Matériel déposé", "Consommable", "Autre"];
  const MATERIAL_UNITS = ["u", "ml", "m²", "m³", "kg", "t", "L", "bobine", "lot"];
  const SELFCHECK_TYPES = ["Contrôle visuel", "Contrôle de serrage", "Contrôle câblage", "Contrôle continuité / isolement", "Contrôle dimensionnel", "Contrôle sécurité", "Essai fonctionnel", "Autre"];
  const PHOTO_CONTEXT_OPTIONS = ["Avancement", "Anomalie", "Autocontrôle", "Sécurité", "Matériel", "Avant travaux", "Après travaux", "Autre"];
  const SNCF_MEANS_OPTIONS = ["RPTx", "CCH", "Adjoint S11", "Adjoint S6", "Agent d’activité", "Agent prestataire", "KV caténaire", "KVSE", "Surveillant caténaire", "Surveillant travaux SE", "Surveillant voie", "Agent RSO", "Agent signalisation", "Agent voie", "Agent SE", "Annonceur / ASP", "Agent lorry", "Autre"];
  const SNCF_MEANS_PRESETS = ["RPTx", "Adjoint S11", "Adjoint S6", "KV caténaire", "KVSE", "Surveillant travaux SE", "Surveillant voie", "Agent RSO"];
  const QUICK_COMPANY_ROLES = ["Conducteur travaux", "Chef de chantier", "Chef d’équipe", "Opérateur travaux", "Intérimaire"];
  const QUICK_SAFETY_ROLES = ["Agent prestataire", "Sentinelle", "Annonceur", "Agent sécurité"];
  const QUICK_TEMPLATE_IDS = new Set([
    "pose-caniveau-pm-mm", "pose-caniveau-gm-tgm", "deroulage-240", "deroulage-95",
    "pose-intervalle-decharge", "depose-intervalle-decharge", "pose-ci-equilibrage", "depose-ci-equilibrage",
  ]);

  const selectOptions = (options, selected, placeholder = "À renseigner") => `<option value="">${escapeHtml(placeholder)}</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
  const editorValue = (id) => String($(`#${id}`)?.value ?? "").trim();
  const companyName = (row) => row?.company === "Autre" ? (row.companyOther || "Autre entreprise") : (row?.company || "Entreprise à préciser");
  const roleName = (row) => row?.role === "Autre" ? (row.roleOther || "Fonction à préciser") : (row?.role || "Fonction à préciser");
  const participatingCompanyNames = () => [...new Set((state.meta?.participatingCompanies || []).map((value) => String(value || "").trim()).filter(Boolean))];
  const enterpriseName = () => participatingCompanyNames()[0] || (state.meta.enterprise === "Autre" ? (state.meta.enterpriseOther || "Autre entreprise") : state.meta.enterprise);
  const companiesForSelect = () => [...new Set([...participatingCompanyNames(), ...COMPANY_OPTIONS])];
  const companySelectOptions = (selected, placeholder = "Choisir une entreprise") => selectOptions(companiesForSelect(), selected, placeholder);
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
      appVersion: 8,
      updatedAt: new Date().toISOString(),
      reportSerial: identity.serial,
      reportUid: identity.uid,
      meta: {
        operation: "RCT",
        reportNo: identity.reportNo,
        orderNo: "",
        enterprise: "BOUYGUES ENERGIES & SERVICES / TSO SIGNALISATION",
        enterpriseOther: "",
        participatingCompanies: ["BOUYGUES ENERGIES & SERVICES / TSO SIGNALISATION"],
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
        objective: "",
        location: "",
        executionNotes: "",
        nextWorks: "",
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
      materials: [],
      selfChecks: [],
      photos: [],
      afterWorkSignature: { name: "", role: "", signedAt: "", dataUrl: "" },
      companySignatures: [],
      collaboration: { revision: 1, currentEditor: "", currentRole: "", receivedAt: "", handoffs: [] },
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
    ["tasks", "personnel", "equipment", "possessions", "anomalies", "documents", "sncfMeans", "materials", "selfChecks", "photos"].forEach((key) => { if (!Array.isArray(state[key])) state[key] = []; });
    state.afterWorkSignature ||= { name: "", role: "", signedAt: "", dataUrl: "" };
    if (!Array.isArray(state.companySignatures)) state.companySignatures = [];
    state.collaboration ||= { revision: 1, currentEditor: "", currentRole: "", receivedAt: "", handoffs: [] };
    if (!Array.isArray(state.collaboration.handoffs)) state.collaboration.handoffs = [];
    state.collaboration.revision = Math.max(1, Math.floor(number(state.collaboration.revision)) || 1);
    ["location", "executionNotes", "nextWorks"].forEach((key) => { if (typeof state.meta[key] !== "string") state.meta[key] = ""; });
    if (!Array.isArray(state.meta.participatingCompanies)) {
      const legacyEnterprise = state.meta.enterprise === "Autre" ? state.meta.enterpriseOther : state.meta.enterprise;
      state.meta.participatingCompanies = legacyEnterprise ? [legacyEnterprise] : [];
    }
    state.meta.participatingCompanies = [...new Set(state.meta.participatingCompanies.map((value) => String(value || "").trim()).filter(Boolean))];
    if (!state.meta.participatingCompanies.length && state.meta.enterprise) state.meta.participatingCompanies.push(state.meta.enterprise);
    state.meta.enterprise = state.meta.participatingCompanies[0] || state.meta.enterprise || "";
    state.appVersion = Math.max(8, Number(state.appVersion) || 0);
    ["personnel", "sncfMeans"].forEach((key) => {
      state[key].forEach((row) => { row.role = canonicalSncfRole(row.role); });
    });
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
  let companySignatureCanvasReady = false;
  let companySignatureResizeBound = false;
  let companyVisaDraft = null;
  let adminLoginOpen = false;
  let adminUnlocked = (() => {
    try { return sessionStorage.getItem(adminSessionKey) === "1"; } catch (_) { return false; }
  })();
  let toastTimer = null;
  let pendingConfirmation = null;

  function showToast(message, tone = "") {
    const toast = $("#appToast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `app-toast visible ${tone}`.trim();
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.className = "app-toast"; }, 4200);
  }

  function askConfirm({ title = "Confirmer l’action", message, confirmLabel = "Confirmer", danger = false }) {
    const dialog = $("#confirmDialog");
    if (!dialog) return Promise.resolve(false);
    if (pendingConfirmation) pendingConfirmation(false);
    $("#confirmDialogTitle").textContent = title;
    $("#confirmDialogMessage").textContent = message;
    const accept = $("#confirmDialogAccept");
    accept.textContent = confirmLabel;
    accept.classList.toggle("danger", danger);
    return new Promise((resolve) => {
      const settle = (accepted) => {
        if (!pendingConfirmation) return;
        pendingConfirmation = null;
        resolve(accepted);
      };
      const onClose = () => settle(dialog.returnValue === "confirm");
      dialog.addEventListener("close", onClose, { once: true });
      pendingConfirmation = settle;
      dialog.showModal();
    });
  }

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
      showToast("L’espace local du téléphone est presque plein. Exportez le rapport ou supprimez des photos avant de continuer.", "warning");
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
    renderParticipantCompanies();
  }

  function syncPrimaryEnterprise() {
    state.meta.participatingCompanies = participatingCompanyNames();
    state.meta.enterprise = state.meta.participatingCompanies[0] || "";
  }

  function renderParticipantCompanies() {
    const target = $("#participantCompanyPicker");
    if (!target) return;
    const selected = new Set(participatingCompanyNames());
    const listed = COMPANY_OPTIONS.filter((company) => company !== "Autre");
    const known = listed.map((company) => `<button type="button" class="company-choice ${selected.has(company) ? "selected" : ""}" data-participant-company="${escapeHtml(company)}" aria-pressed="${selected.has(company)}">${selected.has(company) ? "✓ " : ""}${escapeHtml(company)}</button>`).join("");
    const custom = [...selected].filter((company) => !COMPANY_OPTIONS.includes(company)).map((company) => `<button type="button" class="company-choice selected custom-company" data-participant-company="${escapeHtml(company)}" aria-pressed="true">✓ ${escapeHtml(company)}</button>`).join("");
    target.innerHTML = known + custom;
  }

  function toggleParticipantCompany(company) {
    const selected = participatingCompanyNames();
    const index = selected.indexOf(company);
    if (index >= 0) {
      if (selected.length === 1) {
        showToast("Conserver au moins une entreprise intervenante.", "warning");
        return;
      }
      selected.splice(index, 1);
    } else selected.push(company);
    state.meta.participatingCompanies = selected;
    syncPrimaryEnterprise();
    save("Entreprises intervenantes mises à jour");
    refresh({ inputs: true });
  }

  function renderPricingContext() {
    const context = getShiftContext();
    const banner = $("#pricingContext");
    if (!isAdminView() || handoff) {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");
    banner.classList.toggle("warning", context.status !== "ok");
    banner.innerHTML = `<strong>Régime de règlement identifié :</strong> ${escapeHtml(context.label)}. ${context.provisional ? `${escapeHtml(context.pricingReason || "Contrôle administratif recommandé")}.` : "Les prestations éligibles à plage horaire sont prêtes au contrôle."}`;
  }

  function renderHeader() {
    const contextDone = Boolean(state.meta.operation && state.meta.reportNo && state.meta.date && participatingCompanyNames().length);
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

  function isSafetyProvider(company) {
    const value = normalise(company);
    return value.includes("etf service") || value.includes("sentinelles du rail") || value.includes("lsdr");
  }

  function roleCounter(rows, role, company = "", team = "") {
    return rows.filter((row) => row.role === role && (!company || companyName(row) === company) && (!team || row.team === team))
      .reduce((total, row) => total + number(row.count), 0);
  }

  function adjustRoleCounter(key, criteria, defaults, delta) {
    const list = state[key];
    const row = list.find((item) => Object.entries(criteria).every(([field, value]) => item[field] === value));
    if (!row && delta < 0) return;
    if (!row) list.push({ id: uid(), ...defaults, count: delta });
    else {
      const next = Math.max(0, number(row.count) + delta);
      if (!next) state[key] = list.filter((item) => item.id !== row.id);
      else row.count = next;
    }
    save("Effectif mis à jour");
    refresh();
  }

  function renderQuickPersonnelRoster() {
    const target = $("#quickPersonnelRoster");
    if (!target) return;
    const companies = participatingCompanyNames();
    if (!companies.length) {
      target.innerHTML = `<p class="empty-inline">Sélectionner d’abord les entreprises intervenantes.</p>`;
      return;
    }
    target.innerHTML = companies.map((company) => {
      const safety = isSafetyProvider(company);
      const team = safety ? "Prestataire sécurité" : "Entreprise travaux";
      const roles = safety ? QUICK_SAFETY_ROLES : QUICK_COMPANY_ROLES;
      return `<section class="roster-company"><header><strong>${escapeHtml(company)}</strong><span>${safety ? "Prestataire sécurité" : "Entreprise travaux"}</span></header><div class="roster-role-grid">${roles.map((role) => {
        const count = roleCounter(state.personnel, role, company, team);
        return `<div class="roster-role"><span>${escapeHtml(role)}</span><div class="counter-control"><button type="button" aria-label="Retirer ${escapeHtml(role)}" data-quick-personnel-company="${escapeHtml(company)}" data-quick-personnel-role="${escapeHtml(role)}" data-quick-personnel-team="${escapeHtml(team)}" data-counter-delta="-1">−</button><strong>${displayNumber(count, 0)}</strong><button type="button" aria-label="Ajouter ${escapeHtml(role)}" data-quick-personnel-company="${escapeHtml(company)}" data-quick-personnel-role="${escapeHtml(role)}" data-quick-personnel-team="${escapeHtml(team)}" data-counter-delta="1">+</button></div></div>`;
      }).join("")}</div></section>`;
    }).join("");
  }

  function renderQuickSncfRoster() {
    const target = $("#quickSncfRoster");
    if (!target) return;
    target.innerHTML = `<section class="roster-company"><header><strong>Personnel SNCF</strong><span>Effectif de la séance</span></header><div class="roster-role-grid">${SNCF_MEANS_PRESETS.map((role) => {
      const count = state.sncfMeans.filter((row) => canonicalSncfRole(row.role) === role).reduce((total, row) => total + number(row.count), 0);
      return `<div class="roster-role"><span>${escapeHtml(role)}</span><div class="counter-control"><button type="button" aria-label="Retirer ${escapeHtml(role)}" data-quick-sncf-role="${escapeHtml(role)}" data-counter-delta="-1">−</button><strong>${displayNumber(count, 0)}</strong><button type="button" aria-label="Ajouter ${escapeHtml(role)}" data-quick-sncf-role="${escapeHtml(role)}" data-counter-delta="1">+</button></div></div>`;
    }).join("")}</div></section>`;
  }

  function countStepper(id, value = "") {
    const numeric = Math.max(1, Math.floor(number(value)) || 1);
    return `<div class="counter-control counter-input"><button type="button" data-counter-target="${id}" data-counter-delta="-1" aria-label="Retirer une personne">−</button><input id="${id}" type="number" min="1" step="1" inputmode="numeric" value="${numeric}" /><button type="button" data-counter-target="${id}" data-counter-delta="1" aria-label="Ajouter une personne">+</button></div>`;
  }

  function renderPersonnelEditor(row) {
    const team = row.team || "Entreprise travaux";
    const company = row.company || enterpriseName() || "";
    const companyOther = row.companyOther || "";
    return `<div class="resource-editor">
      <h3 class="resource-editor-title">Entreprise intervenante</h3>
      <section class="resource-shortcuts" aria-label="Raccourcis personnel"><span>Fonctions courantes</span><div>${PERSONNEL_PRESETS.map(([presetTeam, presetRole], index) => `<button type="button" class="resource-preset ${team === presetTeam && row.role === presetRole ? "active" : ""}" data-personnel-preset="${index}">${escapeHtml(presetRole)}</button>`).join("")}</div></section>
      <div class="resource-primary-grid">
        <label class="field"><span>Type d’entreprise</span><select id="row_team">${selectOptions(["Entreprise travaux", "Prestataire sécurité", "SNCF"], team, "Choisir un type")}</select></label>
        <label class="field"><span>Entreprise</span><select id="row_company">${companySelectOptions(company)}</select></label>
        <label class="field"><span>Fonction</span><select id="row_role">${selectOptions(PERSONNEL_ROLES[team] || [], row.role || "", "Choisir une fonction")}</select></label>
        <label class="field field-count"><span>Effectif</span>${countStepper("row_count", row.count)}</label>
      </div>
      <label id="row_companyOtherField" class="field ${company === "Autre" ? "" : "hidden"}"><span>Autre entreprise</span><input id="row_companyOther" value="${escapeHtml(companyOther)}" placeholder="Nom de l’entreprise" autocomplete="organization" /></label>
      <label id="row_roleOtherField" class="field ${row.role === "Autre" ? "" : "hidden"}"><span>Autre fonction</span><input id="row_roleOther" value="${escapeHtml(row.roleOther ?? "")}" placeholder="Préciser la fonction" /></label>
      <details class="optional-details"><summary>Complément équipe</summary><label class="field"><span>Chef d’équipe / précision</span><input id="row_lead" value="${escapeHtml(row.lead ?? "")}" placeholder="Nom ou précision utile" /></label><label class="field"><span>Observation</span><textarea id="row_observation" rows="3" placeholder="Particularité, coactivité, absence ou renfort…">${escapeHtml(row.observation ?? "")}</textarea></label></details>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer l’effectif</button></div>
    </div>`;
  }

  function bindPersonnelEditor() {
    $("#row_team")?.addEventListener("change", () => refreshPersonnelRoles());
    $("#row_company")?.addEventListener("change", toggleOtherCompany);
    $("#row_role")?.addEventListener("change", toggleOtherRole);
    const pane = $("#rowEditorPane");
    if (pane?.dataset.personnelShortcutsBound) return;
    pane?.addEventListener("click", (event) => {
      const shortcut = event.target.closest("[data-personnel-preset]");
      if (!shortcut) return;
      const [team, role] = PERSONNEL_PRESETS[Number(shortcut.dataset.personnelPreset)] || [];
      if (!team || !role) return;
      $("#row_team").value = team;
      refreshPersonnelRoles(role);
      $("#row_role").value = role;
      $$("[data-personnel-preset]").forEach((button) => button.classList.toggle("active", button === shortcut));
    });
    if (pane) pane.dataset.personnelShortcutsBound = "1";
  }

  function readPersonnelEditor() {
    return {
      team: editorValue("row_team"), company: editorValue("row_company"), companyOther: editorValue("row_companyOther"),
      role: editorValue("row_role"), roleOther: editorValue("row_roleOther"), count: editorValue("row_count"), hours: "", lead: editorValue("row_lead"), observation: editorValue("row_observation"),
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
    const company = row.company || enterpriseName() || "";
    const type = row.type || row.name || "";
    return `<div class="resource-editor">
      <h3 class="resource-editor-title">Engin ou mobile travaux</h3>
      <section class="resource-shortcuts equipment-shortcuts" aria-label="Raccourcis engins"><span>Engins fréquents</span><div>${EQUIPMENT_PRESETS.map(([presetFamily, presetType], index) => `<button type="button" class="resource-preset ${family === presetFamily && type === presetType ? "active" : ""}" data-equipment-preset="${index}">${escapeHtml(presetType.replace(" (Lorry Automoteur)", ""))}</button>`).join("")}</div></section>
      <div class="resource-primary-grid">
        <label class="field"><span>Famille</span><select id="row_family">${selectOptions(Object.keys(EQUIPMENT_TYPES), family, "Choisir une famille")}</select></label>
        <label class="field"><span>Type d’engin</span><select id="row_type">${selectOptions(EQUIPMENT_TYPES[family] || [], type, "Choisir un type d’engin")}</select></label>
        <label class="field"><span>Entreprise</span><select id="row_company">${companySelectOptions(company)}</select></label>
        <label class="field field-count"><span>Nombre</span>${countStepper("row_count", row.count)}</label>
        <label class="field field-wide"><span>Voie / zone de travail</span><input id="row_zone" value="${escapeHtml(row.zone ?? "")}" placeholder="Ex. V1, plateforme ou accès nord" /></label>
      </div>
      <label id="row_companyOtherField" class="field ${company === "Autre" ? "" : "hidden"}"><span>Autre entreprise</span><input id="row_companyOther" value="${escapeHtml(row.companyOther ?? "")}" placeholder="Nom de l’entreprise" autocomplete="organization" /></label>
      <label id="row_typeOtherField" class="field ${isOtherEquipmentType(type) ? "" : "hidden"}"><span>Préciser le type d’engin</span><input id="row_typeOther" value="${escapeHtml(row.typeOther ?? "")}" placeholder="Ex. portique, wagon outillé…" /></label>
      <details class="optional-details"><summary>Identification et sécurité</summary><div class="task-extra-grid"><label class="field"><span>Identification</span><input id="row_identification" value="${escapeHtml(row.identification ?? "")}" placeholder="Ex. Pelle RR ETF 01 / immatriculation" /></label><label class="field"><span>PK / secteur</span><input id="row_pk" value="${escapeHtml(row.pk ?? "")}" placeholder="Ex. PK 79,240" /></label><label id="row_railRoadDetails" class="field ${family === "Rail-route / LAM" ? "" : "hidden"}"><span>Mise en voie</span><select id="row_miseEnVoie">${selectOptions(["Plateforme aménagée", "Sans plateforme aménagée", "Déjà en voie", "Non concerné"], row.miseEnVoie || "", "Choisir le mode")}</select></label></div><label class="field"><span>Observation / mesure de sécurité</span><textarea id="row_observation" rows="3" placeholder="Remorque, stabilisateurs, limite de circulation, coactivité, consigne…">${escapeHtml(row.observation ?? "")}</textarea></label></details>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer l’engin</button></div>
    </div>`;
  }

  function bindEquipmentEditor() {
    $("#row_family")?.addEventListener("change", () => refreshEquipmentTypes());
    $("#row_company")?.addEventListener("change", toggleOtherCompany);
    $("#row_type")?.addEventListener("change", () => $("#row_typeOtherField")?.classList.toggle("hidden", !isOtherEquipmentType(editorValue("row_type"))));
    const pane = $("#rowEditorPane");
    if (pane?.dataset.equipmentShortcutsBound) return;
    pane?.addEventListener("click", (event) => {
      const shortcut = event.target.closest("[data-equipment-preset]");
      if (!shortcut) return;
      const [family, type] = EQUIPMENT_PRESETS[Number(shortcut.dataset.equipmentPreset)] || [];
      if (!family || !type) return;
      $("#row_family").value = family;
      refreshEquipmentTypes(type);
      $("#row_type").value = type;
      $$("[data-equipment-preset]").forEach((button) => button.classList.toggle("active", button === shortcut));
    });
    if (pane) pane.dataset.equipmentShortcutsBound = "1";
  }

  function readEquipmentEditor() {
    const type = editorValue("row_type");
    return {
      family: editorValue("row_family"), type, typeOther: editorValue("row_typeOther"), name: type, company: editorValue("row_company"), companyOther: editorValue("row_companyOther"),
      count: editorValue("row_count"), identification: editorValue("row_identification"), zone: editorValue("row_zone"), pk: editorValue("row_pk"),
      miseEnVoie: editorValue("row_miseEnVoie"), observation: editorValue("row_observation"),
    };
  }

  function renderPossessionEditor(row) {
    const start = row.actualStart || row.agreedStart || row.plannedStart || state.meta.shiftStart || "";
    const end = row.actualEnd || row.agreedEnd || row.plannedEnd || state.meta.shiftEnd || "";
    const photoPreview = (photo, label) => photo?.dataUrl ? `<img class="inline-photo-preview" src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(label)}" />` : "";
    return `<div class="resource-editor">
      <h3 class="resource-editor-title">Interception ou consignation</h3>
      <div class="resource-primary-grid possession-primary"><label class="field"><span>Type</span><select id="row_kind">${selectOptions(["ITC / interception", "Consignation", "ITC + consignation"], row.kind || "", "Choisir un type")}</select></label><label class="field"><span>Voie</span><input id="row_voie" value="${escapeHtml(row.voie ?? "")}" placeholder="Ex. V1" /></label><label class="field"><span>Zone / secteur</span><input id="row_zone" value="${escapeHtml(row.zone ?? "")}" placeholder="Ex. PK 80+050 à 80+340" /></label><label class="field"><span>Réf. ITC / ARF / AAN</span><input id="row_reference" value="${escapeHtml(row.reference ?? "")}" placeholder="Référence si disponible" /></label></div>
      <section class="time-matrix" aria-label="Tableau des horaires"><div class="time-matrix-head"><span>Étape</span><span>Début</span><span>Fin</span></div><label><strong>Prévue</strong><input id="row_plannedStart" type="time" value="${escapeHtml(row.plannedStart ?? start)}" /><input id="row_plannedEnd" type="time" value="${escapeHtml(row.plannedEnd ?? end)}" /></label><label><strong>Accordée</strong><input id="row_agreedStart" type="time" value="${escapeHtml(row.agreedStart ?? start)}" /><input id="row_agreedEnd" type="time" value="${escapeHtml(row.agreedEnd ?? end)}" /></label><label><strong>ARF / réelle</strong><input id="row_actualStart" type="time" value="${escapeHtml(row.actualStart ?? start)}" /><input id="row_actualEnd" type="time" value="${escapeHtml(row.actualEnd ?? end)}" /></label><label><strong>Intervention</strong><input id="row_interventionStart" type="time" value="${escapeHtml(row.interventionStart ?? "")}" /><input id="row_interventionEnd" type="time" value="${escapeHtml(row.interventionEnd ?? "")}" /></label></section>
      <section class="arf-photo-capture"><div><strong>Photos ARF</strong><p>Joindre le document de début et de fin directement à cette ligne.</p></div><div class="arf-photo-grid"><label class="field"><span>ARF début</span>${photoPreview(row.arfStartPhoto, "Photo ARF début")}<input id="row_arfStartPhoto" type="file" accept="image/*" capture="environment" /></label><label class="field"><span>ARF fin</span>${photoPreview(row.arfEndPhoto, "Photo ARF fin")}<input id="row_arfEndPhoto" type="file" accept="image/*" capture="environment" /></label></div></section>
      <label class="field"><span>Observation</span><textarea id="row_observation" rows="3" placeholder="Motif de décalage, information ARF / AAN, consigne…">${escapeHtml(row.observation ?? "")}</textarea></label>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer les horaires</button></div>
    </div>`;
  }

  function bindPossessionEditor() {}

  function readPossessionEditor() {
    return {
      kind: editorValue("row_kind"), voie: editorValue("row_voie"), actualStart: editorValue("row_actualStart"), actualEnd: editorValue("row_actualEnd"), useSameTimes: false,
      plannedStart: editorValue("row_plannedStart"), plannedEnd: editorValue("row_plannedEnd"),
      agreedStart: editorValue("row_agreedStart"), agreedEnd: editorValue("row_agreedEnd"),
      interventionStart: editorValue("row_interventionStart"), interventionEnd: editorValue("row_interventionEnd"),
      reference: editorValue("row_reference"), zone: editorValue("row_zone"),
      observation: editorValue("row_observation"),
    };
  }

  function renderAnomalyEditor(row) {
    const photoPreview = row.photo?.dataUrl ? `<img class="inline-photo-preview anomaly-photo-preview" src="${escapeHtml(row.photo.dataUrl)}" alt="Photo de l’anomalie" />` : "";
    return `<div class="resource-editor">
      <div class="resource-banner anomaly-banner"><span class="resource-symbol">!</span><div><strong>Événement, anomalie ou réserve</strong><p>Décrire le fait, localiser la zone et indiquer clairement la mesure prise. Les points à lever sont repris dans le dossier d’archivage.</p></div></div>
      <div class="resource-primary-grid">
        <label class="field"><span>Nature</span><select id="row_type">${selectOptions(["Technique", "Sécurité", "Environnement", "Organisation", "Qualité"], row.type || "", "Choisir une nature")}</select></label>
        <label class="field"><span>Niveau</span><select id="row_severity">${selectOptions(["Information", "À surveiller", "Bloquant"], row.severity || "", "Choisir un niveau")}</select></label>
        <label class="field"><span>Statut</span><select id="row_status">${selectOptions(["À suivre", "En cours", "Terminé"], row.status || "", "Choisir un statut")}</select></label>
        <label class="field"><span>Voie / PK / zone</span><input id="row_zone" value="${escapeHtml(row.zone ?? "")}" placeholder="Ex. V1 – PK 80+120" /></label>
      </div>
      <label class="field"><span>Fait constaté</span><textarea id="row_detail" rows="4" placeholder="Décrire factuellement l’anomalie, l’écart ou l’événement.">${escapeHtml(row.detail ?? "")}</textarea></label>
      <label class="field"><span>Mesure prise / suite</span><textarea id="row_action" rows="4" placeholder="Action immédiate, mesure conservatoire ou prochaine étape.">${escapeHtml(row.action ?? "")}</textarea></label>
      <label class="field"><span>Photo associée</span>${photoPreview}<input id="row_anomalyPhoto" type="file" accept="image/*" capture="environment" /></label>
      <details class="optional-details"><summary>Responsable et échéance</summary><div class="task-extra-grid"><label class="field"><span>Responsable</span><input id="row_responsible" value="${escapeHtml(row.responsible ?? "")}" placeholder="Nom ou entreprise responsable" /></label><label class="field"><span>Échéance</span><input id="row_dueDate" type="date" value="${escapeHtml(row.dueDate ?? "")}" /></label></div></details>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer le point de suivi</button></div>
    </div>`;
  }

  function readAnomalyEditor() {
    return {
      type: editorValue("row_type"), severity: editorValue("row_severity"), status: editorValue("row_status"), zone: editorValue("row_zone"),
      detail: editorValue("row_detail"), action: editorValue("row_action"), responsible: editorValue("row_responsible"), dueDate: editorValue("row_dueDate"),
    };
  }

  function renderMaterialEditor(row) {
    return `<div class="resource-editor">
      <div class="resource-banner material-banner"><span class="resource-symbol">M</span><div><strong>Matériau, fourniture ou dépose</strong><p>Une ligne par élément significatif : la consommation et les déposes sont intégrées au rapport d’archivage.</p></div></div>
      <div class="resource-primary-grid"><label class="field"><span>Famille</span><select id="row_type">${selectOptions(MATERIAL_TYPES, row.type || "", "Choisir une famille")}</select></label><label class="field"><span>Libellé / référence</span><input id="row_name" value="${escapeHtml(row.name ?? "")}" placeholder="Ex. Câble 240 mm² aluminium" /></label><label class="field field-count"><span>Quantité</span><input id="row_quantity" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(row.quantity ?? "")}" placeholder="Qté" /></label><label class="field"><span>Unité</span><select id="row_unit">${selectOptions(MATERIAL_UNITS, row.unit || "", "Unité")}</select></label></div>
      <div class="task-extra-grid"><label class="field"><span>Voie / PK / zone</span><input id="row_zone" value="${escapeHtml(row.zone ?? "")}" placeholder="Ex. V2 – PK 80+240" /></label><label class="field"><span>Lot / référence fournisseur</span><input id="row_reference" value="${escapeHtml(row.reference ?? "")}" placeholder="Optionnel" /></label></div>
      <label class="field"><span>Observation</span><textarea id="row_observation" rows="3" placeholder="Utilisation, dépose, stockage, réserve…">${escapeHtml(row.observation ?? "")}</textarea></label>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer le matériau</button></div>
    </div>`;
  }

  function readMaterialEditor() {
    return { type: editorValue("row_type"), name: editorValue("row_name"), quantity: editorValue("row_quantity"), unit: editorValue("row_unit"), zone: editorValue("row_zone"), reference: editorValue("row_reference"), observation: editorValue("row_observation") };
  }

  function renderSelfCheckEditor(row) {
    return `<div class="resource-editor">
      <div class="resource-banner selfcheck-banner"><span class="resource-symbol">✓</span><div><strong>Autocontrôle ou contrôle</strong><p>Tracer le contrôle réalisé, son résultat et la référence éventuelle. Une réserve peut être liée à un point de suivi.</p></div></div>
      <div class="resource-primary-grid"><label class="field"><span>Type de contrôle</span><select id="row_type">${selectOptions(SELFCHECK_TYPES, row.type || "", "Choisir un contrôle")}</select></label><label class="field"><span>Résultat</span><select id="row_status">${selectOptions(["Conforme", "Avec réserve", "Non conforme", "Non réalisé"], row.status || "", "Choisir un résultat")}</select></label><label class="field"><span>Voie / PK / zone</span><input id="row_zone" value="${escapeHtml(row.zone ?? "")}" placeholder="Ex. V1 – PK 80+120" /></label><label class="field"><span>Référence / fiche</span><input id="row_reference" value="${escapeHtml(row.reference ?? "")}" placeholder="N° fiche ou PV" /></label></div>
      <div class="task-extra-grid"><label class="field"><span>Réalisé par</span><input id="row_responsible" value="${escapeHtml(row.responsible ?? "")}" placeholder="Nom / fonction" /></label><label class="field"><span>Heure / date</span><input id="row_checkedAt" value="${escapeHtml(row.checkedAt ?? "")}" placeholder="Ex. 02:15" /></label></div>
      <label class="field"><span>Observation / réserve</span><textarea id="row_observation" rows="3" placeholder="Résultat détaillé, réserve ou action associée.">${escapeHtml(row.observation ?? "")}</textarea></label>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer le contrôle</button></div>
    </div>`;
  }

  function readSelfCheckEditor() {
    return { type: editorValue("row_type"), status: editorValue("row_status"), zone: editorValue("row_zone"), reference: editorValue("row_reference"), responsible: editorValue("row_responsible"), checkedAt: editorValue("row_checkedAt"), observation: editorValue("row_observation") };
  }

  function renderSncfMeansEditor(row) {
    const role = canonicalSncfRole(row.role || "");
    return `<div class="resource-editor">
      <h3 class="resource-editor-title">Personnel SNCF affecté</h3>
      <section class="resource-shortcuts" aria-label="Raccourcis moyens SNCF"><span>Fonctions fréquentes</span><div>${SNCF_MEANS_PRESETS.map((preset, index) => `<button type="button" class="resource-preset ${role === preset ? "active" : ""}" data-sncf-preset="${index}">${escapeHtml(preset)}</button>`).join("")}</div></section>
      <div class="resource-primary-grid sncf-primary"><label class="field"><span>Fonction</span><select id="row_role">${selectOptions(SNCF_MEANS_OPTIONS, role, "Choisir une fonction")}</select></label><label class="field field-count"><span>Effectif</span>${countStepper("row_count", row.count)}</label><label class="field field-wide"><span>Mission / précision</span><input id="row_observation" value="${escapeHtml(row.observation ?? "")}" placeholder="Nom, mission ou commentaire utile" /></label></div>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer l’effectif SNCF</button></div>
    </div>`;
  }

  function bindSncfMeansEditor() {
    const pane = $("#rowEditorPane");
    if (pane?.dataset.sncfShortcutsBound) return;
    pane?.addEventListener("click", (event) => {
      const shortcut = event.target.closest("[data-sncf-preset]");
      if (!shortcut) return;
      const role = SNCF_MEANS_PRESETS[Number(shortcut.dataset.sncfPreset)];
      if (!role) return;
      $("#row_role").value = role;
      $$('[data-sncf-preset]').forEach((button) => button.classList.toggle("active", button === shortcut));
    });
    if (pane) pane.dataset.sncfShortcutsBound = "1";
  }

  function readSncfMeansEditor() {
    return { role: canonicalSncfRole(editorValue("row_role")), count: editorValue("row_count"), observation: editorValue("row_observation") };
  }

  function renderDocumentEditor(row) {
    return `<div class="resource-editor">
      <div class="resource-banner document-banner"><span class="resource-symbol">D</span><div><strong>Document, fiche ou rapport</strong><p>Tracer uniquement la pièce utile à l’archivage et sa référence. Elle apparaîtra dans la section dédiée du PDF.</p></div></div>
      <div class="resource-primary-grid document-primary"><label class="field"><span>Document / fiche</span><input id="row_name" value="${escapeHtml(row.name ?? "")}" placeholder="Ex. Fiche de libération" /></label><label class="field"><span>Référence</span><input id="row_reference" value="${escapeHtml(row.reference ?? "")}" placeholder="N° ou lien" /></label><label class="field field-wide"><span>Observation / réserve</span><input id="row_observation" value="${escapeHtml(row.observation ?? "")}" placeholder="Contenu ou réserve éventuelle" /></label></div>
      <div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer le document</button></div>
    </div>`;
  }

  function readDocumentEditor() {
    return { name: editorValue("row_name"), reference: editorValue("row_reference"), observation: editorValue("row_observation") };
  }

  const rowConfig = {
    personnel: {
      title: "Personnel et intervenants", editor: renderPersonnelEditor, bind: bindPersonnelEditor, read: readPersonnelEditor,
      display: (row) => `<h3>${escapeHtml(roleName(row))} · ${displayNumber(row.count, 0)} pers.</h3><p><span class="resource-chip">${escapeHtml(row.team || "Entreprise intervenante")}</span><span>${escapeHtml(companyName(row))}</span>${row.lead ? `<span>${escapeHtml(row.lead)}</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
    equipment: {
      title: "Engin ou mobile travaux", editor: renderEquipmentEditor, bind: bindEquipmentEditor, read: readEquipmentEditor,
      display: (row) => `<h3>${escapeHtml(equipmentName(row))}${row.count ? ` · ${displayNumber(row.count, 0)}` : ""}</h3><p><span class="resource-chip">${escapeHtml(row.family || "Matériel")}</span><span>${escapeHtml(companyName(row))}</span>${row.zone ? `<span>${escapeHtml([row.zone, row.pk].filter(Boolean).join(" · "))}</span>` : row.pk ? `<span>${escapeHtml(row.pk)}</span>` : ""}${row.identification ? `<span>${escapeHtml(row.identification)}</span>` : ""}${row.miseEnVoie ? `<span>${escapeHtml(row.miseEnVoie)}</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
    possession: {
      title: "Interception / consignation", editor: renderPossessionEditor, bind: bindPossessionEditor, read: readPossessionEditor,
      display: (row) => `<h3>${escapeHtml(row.kind || "Interception / consignation")} · Voie ${escapeHtml(row.voie || "à préciser")}</h3><p>${row.reference ? `<span class="resource-chip">${escapeHtml(row.reference)}</span>` : ""}<span>ARF / réel ${escapeHtml(row.actualStart || "—")} → ${escapeHtml(row.actualEnd || "—")}</span>${row.arfStartPhoto || row.arfEndPhoto ? `<span class="resource-chip">Photos ARF jointes</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
    anomaly: {
      title: "Événement / anomalie", editor: renderAnomalyEditor, read: readAnomalyEditor,
      display: (row) => `<h3>${escapeHtml(row.type || "Anomalie")} · ${escapeHtml(row.severity || "À préciser")}</h3><p>${row.status ? `<span class="resource-chip">${escapeHtml(row.status)}</span>` : ""}${row.zone ? `<span>${escapeHtml(row.zone)}</span>` : ""}${row.photo ? `<span class="resource-chip">Photo jointe</span>` : ""}<span>${escapeHtml(row.detail || "Sans détail")}</span>${row.action ? `<span>Suite : ${escapeHtml(row.action)}</span>` : ""}</p>`,
    },
    document: {
      title: "Rapport fourni", editor: renderDocumentEditor, read: readDocumentEditor,
      display: (row) => `<h3>${escapeHtml(row.name || "Document à préciser")}${row.reference ? ` · ${escapeHtml(row.reference)}` : ""}</h3><p>${escapeHtml(row.observation || "")}</p>`,
    },
    sncfMeans: {
      title: "Moyen SNCF", editor: renderSncfMeansEditor, bind: bindSncfMeansEditor, read: readSncfMeansEditor,
      display: (row) => `<h3>${escapeHtml(row.role || "Moyen à préciser")}${row.count ? ` · ${displayNumber(row.count, 0)}` : ""}</h3><p>${escapeHtml(row.observation || "")}</p>`,
    },
    material: {
      title: "Matériau / consommable", editor: renderMaterialEditor, read: readMaterialEditor,
      display: (row) => `<h3>${escapeHtml(row.name || row.type || "Matériau à préciser")}${row.quantity ? ` · ${displayNumber(row.quantity)} ${escapeHtml(row.unit || "")}` : ""}</h3><p>${row.type ? `<span class="resource-chip">${escapeHtml(row.type)}</span>` : ""}${row.zone ? `<span>${escapeHtml(row.zone)}</span>` : ""}${row.reference ? `<span>${escapeHtml(row.reference)}</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
    selfCheck: {
      title: "Autocontrôle / contrôle", editor: renderSelfCheckEditor, read: readSelfCheckEditor,
      display: (row) => `<h3>${escapeHtml(row.type || "Contrôle à préciser")} · ${escapeHtml(row.status || "Résultat à préciser")}</h3><p>${row.zone ? `<span>${escapeHtml(row.zone)}</span>` : ""}${row.reference ? `<span>${escapeHtml(row.reference)}</span>` : ""}${row.responsible ? `<span>${escapeHtml(row.responsible)}</span>` : ""}${row.observation ? `<span>${escapeHtml(row.observation)}</span>` : ""}</p>`,
    },
  };

  function renderDataList(key) {
    const target = $(`#${key}List`);
    const config = rowConfig[key];
    const rows = state[key] || [];
    if (key === "possession") {
      target.innerHTML = rows.length ? `<div class="possession-table-wrap"><table class="possession-table"><thead><tr><th>Type / voie</th><th>Prévue</th><th>Accordée</th><th>ARF / réelle</th><th>Intervention</th><th>ARF</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.kind || "Interception / consignation")}</strong><br>${escapeHtml([row.voie && `Voie ${row.voie}`, row.zone].filter(Boolean).join(" · ") || "—")}${row.reference ? `<br><small>${escapeHtml(row.reference)}</small>` : ""}</td><td>${escapeHtml(`${row.plannedStart || "—"} → ${row.plannedEnd || "—"}`)}</td><td>${escapeHtml(`${row.agreedStart || "—"} → ${row.agreedEnd || "—"}`)}</td><td>${escapeHtml(`${row.actualStart || "—"} → ${row.actualEnd || "—"}`)}</td><td>${escapeHtml(`${row.interventionStart || "—"} → ${row.interventionEnd || "—"}`)}</td><td>${row.arfStartPhoto ? "Début ✓" : "Début —"}<br>${row.arfEndPhoto ? "Fin ✓" : "Fin —"}</td><td class="table-actions"><button class="mini-button" type="button" data-edit-row="possession:${row.id}">Modifier</button><button class="mini-button danger" type="button" data-delete-row="possession:${row.id}">Supprimer</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="empty-inline">Aucune interception ou consignation saisie.</p>`;
      return;
    }
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
      return `<section class="photo-group"><h3>${label}</h3><div class="photo-grid">${rows.map((photo) => `<figure class="photo-card"><img src="${photo.dataUrl}" alt="${escapeHtml(`${label} — ${photo.caption || "photo terrain"}`)}" /><figcaption><strong>${formatDateTime(photo.capturedAt)}</strong><div class="photo-meta-grid"><label><span>Type</span><select data-photo-field="category" data-photo-id="${escapeHtml(photo.id)}">${selectOptions(PHOTO_CONTEXT_OPTIONS, photo.category || "", "À qualifier")}</select></label><label><span>Voie / PK</span><input data-photo-field="zone" data-photo-id="${escapeHtml(photo.id)}" value="${escapeHtml(photo.zone || "")}" placeholder="Zone" /></label></div><label class="photo-caption-label"><span>Légende</span><input data-photo-field="caption" data-photo-id="${escapeHtml(photo.id)}" value="${escapeHtml(photo.caption || "")}" placeholder="Ce que montre la photo" /></label><button type="button" class="mini-button danger" data-delete-photo="${escapeHtml(photo.id)}">Supprimer</button></figcaption></figure>`).join("")}</div></section>`;
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
      showToast(`Maximum de ${MAX_PHOTOS} photos par rapport atteint.`, "warning");
      return;
    }
    const added = [];
    for (const file of selected) {
      try {
        added.push({ id: uid(), phase: selectedPhotoPhase, capturedAt: new Date().toISOString(), category: selectedPhotoPhase === "avant" ? "Avant travaux" : "Après travaux", zone: "", caption: "", dataUrl: await compactPhoto(file) });
      } catch (_) {
        showToast(`La photo « ${file.name || "sans nom"} » n’a pas pu être ajoutée.`, "warning");
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

  function drawCompanySignatureData() {
    const canvas = $("#companySignatureCanvas");
    if (!canvas || !companySignatureCanvasReady) return;
    const context = canvas.getContext("2d");
    const ratio = Number(canvas.dataset.ratio || 1);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.save();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.restore();
    if (!companyVisaDraft?.dataUrl) return;
    const image = new Image();
    image.onload = () => {
      context.save();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.drawImage(image, 0, 0, width, height);
      context.restore();
    };
    image.src = companyVisaDraft.dataUrl;
  }

  function resizeCompanySignatureCanvas() {
    const canvas = $("#companySignatureCanvas");
    if (!canvas || !companySignatureCanvasReady) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(300, Math.floor(rect.width || 300) * ratio);
    canvas.height = 148 * ratio;
    canvas.dataset.ratio = String(ratio);
    drawCompanySignatureData();
  }

  function setupCompanySignatureCanvas() {
    const canvas = $("#companySignatureCanvas");
    if (!canvas) return;
    if (companySignatureCanvasReady) {
      resizeCompanySignatureCanvas();
      return;
    }
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
      companyVisaDraft.dataUrl = canvas.toDataURL("image/png");
      companyVisaDraft.signedAt = new Date().toISOString();
      const status = $("#companyVisaSignatureStatus");
      if (status) status.textContent = `Signature capturée le ${formatDateTime(companyVisaDraft.signedAt)}.`;
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    companySignatureCanvasReady = true;
    resizeCompanySignatureCanvas();
    if (!companySignatureResizeBound) {
      window.addEventListener("resize", resizeCompanySignatureCanvas);
      companySignatureResizeBound = true;
    }
  }

  function renderCompanyVisas() {
    const target = $("#companyVisaList");
    if (!target) return;
    const companies = participatingCompanyNames();
    const signatures = state.companySignatures || [];
    if (!companies.length) {
      target.innerHTML = `<p class="empty-inline">Sélectionner les entreprises intervenantes avant d’ajouter les visas.</p>`;
      return;
    }
    target.innerHTML = companies.map((company) => {
      const entries = signatures.filter((signature) => signature.company === company);
      const cards = entries.length ? entries.map((signature) => `<article class="company-visa-card"><div><strong>${escapeHtml(signature.name || "Nom à renseigner")}</strong><span>${escapeHtml(signature.role || "Fonction à renseigner")}</span><small>${signature.signedAt ? `Signé le ${escapeHtml(formatDateTime(signature.signedAt))}` : "Visa à compléter"}</small></div>${signature.dataUrl ? `<img src="${escapeHtml(signature.dataUrl)}" alt="Visa de ${escapeHtml(signature.name || company)}" />` : ""}<div class="visa-actions"><button type="button" class="mini-button" data-edit-company-visa="${escapeHtml(signature.id)}">Modifier</button><button type="button" class="mini-button danger" data-delete-company-visa="${escapeHtml(signature.id)}">Supprimer</button></div></article>`).join("") : `<p class="empty-inline">Aucun visa saisi.</p>`;
      return `<section class="company-visa-company"><header><strong>${escapeHtml(company)}</strong><button type="button" class="mini-button" data-add-company-visa="${escapeHtml(company)}">＋ Visa</button></header>${cards}</section>`;
    }).join("");
  }

  function openCompanyVisaDialog(company = "", visa = null) {
    companyVisaDraft = visa ? clone(visa) : { id: uid(), company: company || enterpriseName() || "", name: "", role: "", signedAt: "", dataUrl: "" };
    companySignatureCanvasReady = false;
    $("#companyVisaDialogTitle").textContent = visa ? "Modifier le visa" : "Ajouter un visa";
    $("#companyVisaEditor").innerHTML = `<div class="resource-editor"><div class="resource-primary-grid"><label class="field field-wide"><span>Entreprise intervenante</span><select id="companyVisaCompany">${companySelectOptions(companyVisaDraft.company)}</select></label><label class="field"><span>Nom et prénom</span><input id="companyVisaName" value="${escapeHtml(companyVisaDraft.name || "")}" autocomplete="name" placeholder="Nom du responsable" /></label><label class="field"><span>Fonction</span><input id="companyVisaRole" value="${escapeHtml(companyVisaDraft.role || "")}" placeholder="Chef de chantier, chef d’équipe…" /></label></div><div class="signature-canvas-wrap"><canvas id="companySignatureCanvas" aria-label="Zone de signature du responsable entreprise"></canvas><p id="companyVisaSignatureStatus" class="muted">${companyVisaDraft.signedAt ? `Signée le ${escapeHtml(formatDateTime(companyVisaDraft.signedAt))}.` : "Signer au doigt dans la zone ci-dessus."}</p></div><button id="clearCompanyVisaSignatureButton" class="text-button" type="button">Effacer la signature</button><div class="dialog-actions"><button id="saveCompanyVisaButton" type="button" class="primary-button">Enregistrer le visa</button></div></div>`;
    $("#companyVisaDialog").showModal();
    window.setTimeout(setupCompanySignatureCanvas, 0);
  }

  function saveCompanyVisa() {
    if (!companyVisaDraft) return;
    companyVisaDraft.company = editorValue("companyVisaCompany");
    companyVisaDraft.name = editorValue("companyVisaName");
    companyVisaDraft.role = editorValue("companyVisaRole");
    const index = state.companySignatures.findIndex((signature) => signature.id === companyVisaDraft.id);
    if (index >= 0) state.companySignatures.splice(index, 1, companyVisaDraft);
    else state.companySignatures.push(companyVisaDraft);
    save("Visa entreprise enregistré");
    $("#companyVisaDialog").close();
    companyVisaDraft = null;
    renderCompanyVisas();
    renderPrintReport();
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
    if (!/^\d{6}$/.test(pin)) { showToast("Le code administrateur doit contenir exactement 6 chiffres.", "warning"); return; }
    if (isAdminConfigured() && hashAdminPin(pin) !== state.settings.admin.pinHash) { showToast("Code administrateur incorrect.", "danger"); return; }
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
    ["personnel", "equipment", "possession", "anomaly", "document", "sncfMeans", "material", "selfCheck"].forEach(renderDataList);
    renderQuickPersonnelRoster();
    renderQuickSncfRoster();
    renderPhotos();
    renderAfterWorkSignature();
    renderCompanyVisas();
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

  async function saveRow() {
    if (!rowDraft) return;
    const config = rowConfig[rowDraft.key];
    if (config.read) Object.assign(rowDraft.row, config.read());
    else config.fields.forEach(([name]) => { rowDraft.row[name] = $(`#row_${name}`).value.trim(); });
    const capture = async (inputId, property, label) => {
      const file = $(`#${inputId}`)?.files?.[0];
      if (!file) return;
      try {
        rowDraft.row[property] = { id: uid(), label, capturedAt: new Date().toISOString(), dataUrl: await compactPhoto(file) };
      } catch (_) {
        showToast(`La photo « ${label} » n’a pas pu être enregistrée.`, "warning");
      }
    };
    if (rowDraft.key === "possession") {
      await capture("row_arfStartPhoto", "arfStartPhoto", "ARF début");
      await capture("row_arfEndPhoto", "arfEndPhoto", "ARF fin");
    }
    if (rowDraft.key === "anomaly") await capture("row_anomalyPhoto", "photo", "Anomalie");
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

  // Rendu PDF V5 restauré : format tabulaire opérationnel, sans les maquettes V6/V7.
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
    const personnelRows = renderTableRows(state.personnel, (row) => `<tr><td>${escapeHtml(roleName(row))}</td><td>${escapeHtml([row.team, companyName(row)].filter(Boolean).join(" · "))}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td>${escapeHtml([row.lead, row.observation].filter(Boolean).join(" · ") || "—")}</td></tr>`, 4);
    const equipmentRows = renderTableRows(state.equipment, (row) => `<tr><td>${escapeHtml(equipmentName(row))}</td><td>${escapeHtml(companyName(row))}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td>${escapeHtml([row.zone, row.pk, row.miseEnVoie].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml([row.identification, row.observation].filter(Boolean).join(" · ") || "—")}</td></tr>`, 5);
    const possessionRows = renderTableRows(state.possessions, (row) => `<tr><td>${escapeHtml([row.kind, row.voie && `Voie ${row.voie}`, row.zone].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml(`${row.plannedStart || "—"} → ${row.plannedEnd || "—"}`)}</td><td>${escapeHtml(`${row.agreedStart || "—"} → ${row.agreedEnd || "—"}`)}</td><td>${escapeHtml(`${row.actualStart || "—"} → ${row.actualEnd || "—"}`)}</td><td>${escapeHtml(`${row.interventionStart || "—"} → ${row.interventionEnd || "—"}`)}${row.reference ? `<br><small>${escapeHtml(row.reference)}</small>` : ""}${row.observation ? `<br><small>${escapeHtml(row.observation)}</small>` : ""}</td></tr>`, 5);
    const anomalyRows = renderTableRows(state.anomalies, (row) => `<tr><td>${escapeHtml(row.type || "—")}</td><td>${escapeHtml(row.severity || "—")}</td><td>${escapeHtml(row.detail || "—")}${row.photo ? "<br><small>Photo jointe</small>" : ""}</td><td>${escapeHtml(row.action || "—")}</td></tr>`, 4);
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
    const arfPhotos = state.possessions.flatMap((row) => [
      row.arfStartPhoto?.dataUrl ? { ...row.arfStartPhoto, label: `ARF début · ${[row.voie && `Voie ${row.voie}`, row.reference].filter(Boolean).join(" · ")}` } : null,
      row.arfEndPhoto?.dataUrl ? { ...row.arfEndPhoto, label: `ARF fin · ${[row.voie && `Voie ${row.voie}`, row.reference].filter(Boolean).join(" · ")}` } : null,
    ].filter(Boolean));
    const anomalyPhotos = state.anomalies.filter((row) => row.photo?.dataUrl).map((row) => ({ ...row.photo, label: `Anomalie · ${row.type || "—"}${row.zone ? ` · ${row.zone}` : ""}` }));
    const trackedPhotoSection = [...arfPhotos, ...anomalyPhotos].length ? `<section class="print-section"><h2>Photos ARF et qualité sécurité</h2><div class="print-photo-grid">${[...arfPhotos, ...anomalyPhotos].map((photo) => `<figure class="print-photo"><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.label)}"><figcaption><strong>${escapeHtml(photo.label)}</strong><br>${formatDateTime(photo.capturedAt)}</figcaption></figure>`).join("")}</div></section>` : "";
    const signature = state.afterWorkSignature || {};
    const signatureMarkup = signature.dataUrl
      ? `<img class="print-signature-image" src="${escapeHtml(signature.dataUrl)}" alt="Signature après travaux">`
      : `<span>Signature à renseigner</span>`;
    const companyVisaMarkup = (state.companySignatures || []).map((visa) => `<div class="signature-box signature-after-work"><strong>${escapeHtml(visa.company || "Entreprise intervenante")}</strong>${escapeHtml([visa.name, visa.role].filter(Boolean).join(" · ") || "Nom / fonction à renseigner")}${visa.signedAt ? `<small>Signée le ${escapeHtml(formatDateTime(visa.signedAt))}</small>` : ""}${visa.dataUrl ? `<img class="print-signature-image" src="${escapeHtml(visa.dataUrl)}" alt="Visa ${escapeHtml(visa.company || "entreprise")}">` : "<span>Signature à renseigner</span>"}</div>`).join("");

    $("#printReport").innerHTML = `
      <article class="print-page">
        <header class="print-header"><div class="print-title-lockup"><img class="print-logo" src="assets/ainm-infrapole-paris-sud-est.jpg" alt="AINM Infrapôle Paris Sud Est"><div><span class="print-brand">AINM travaux signalisation</span><h1 class="print-title">${reportTitle}</h1></div></div>
          <div class="print-meta">AINM · Travaux signalisation<br>Référentiel rapport journalier<br>Édité le ${formatDate(dateToday())}</div></header>
        <section class="print-section"><h2>Identification</h2><div class="print-info-grid">
          <div><strong>Opération / chantier</strong>${escapeHtml(state.meta.operation || "—")}</div><div><strong>N° rapport</strong>${escapeHtml(state.meta.reportNo || "—")}</div><div><strong>N° commande</strong>${escapeHtml(state.meta.orderNo || "—")}</div>
          <div><strong>Entreprises intervenantes</strong>${escapeHtml(participatingCompanyNames().join(" · ") || "—")}</div><div><strong>Date / nature</strong>${formatDate(state.meta.date)} · ${escapeHtml(state.meta.shiftType || "—")}</div><div><strong>Intervention réelle</strong>${escapeHtml(`${state.meta.shiftStart || "—"} → ${state.meta.shiftEnd || "—"}`)} · ${durationText}</div>
          <div><strong>Météo / température</strong>${escapeHtml(state.meta.weather || "—")} · ${escapeHtml(state.meta.temperature || "—")} °C</div><div><strong>Rédacteur</strong>${escapeHtml(state.meta.reporter || "—")}</div><div><strong>Régime de séance</strong>${escapeHtml(getShiftContext().label)}</div>
        </div></section>
        ${state.meta.cancelled ? `<section class="print-section"><h2>Annulation du chantier</h2><div class="print-note">${escapeHtml(state.meta.cancelReason || "Motif non renseigné")}</div></section>` : `
        <section class="print-section"><h2>Travaux exécutés</h2><table class="print-table"><thead><tr><th>Prestation terrain</th><th class="numeric">Quantité</th><th>Voie</th><th>PK</th><th>Statut</th></tr></thead><tbody>${taskRows}</tbody></table></section>
        <section class="print-section"><h2>Personnel des entreprises</h2><table class="print-table"><thead><tr><th>Fonction / grade</th><th>Famille / entreprise</th><th class="numeric">Nb</th><th>Complément / observation</th></tr></thead><tbody>${personnelRows}</tbody></table></section>
        <section class="print-section"><h2>Engins et mobiles travaux</h2><table class="print-table"><thead><tr><th>Engin / matériel</th><th>Entreprise</th><th class="numeric">Nb</th><th>Zone / voie</th><th>Identification / observation</th></tr></thead><tbody>${equipmentRows}</tbody></table></section>`}
        <section class="print-section"><h2>Interceptions et consignations</h2><table class="print-table"><thead><tr><th>Type / voie / zone</th><th>Prévues</th><th>Accordées</th><th>ARF / réelles</th><th>Intervention / référence</th></tr></thead><tbody>${possessionRows}</tbody></table></section>
        <section class="print-section"><h2>Anomalies constatées</h2><table class="print-table"><thead><tr><th>Type</th><th>Niveau</th><th>Fait constaté</th><th>Mesure prise / suite</th></tr></thead><tbody>${anomalyRows}</tbody></table></section>
        <section class="print-section"><h2>Rapports fournis par l’entreprise</h2><table class="print-table"><thead><tr><th>Document</th><th>Référence</th><th>Observation</th></tr></thead><tbody>${documentsRows}</tbody></table></section>
        <section class="print-section"><h2>Personnel SNCF affecté</h2><table class="print-table"><thead><tr><th>Fonction</th><th class="numeric">Nb</th><th>Mission / observation</th></tr></thead><tbody>${sncfRows}</tbody></table></section>
        ${photoSection}
        ${trackedPhotoSection}
        <section class="print-signatures"><div class="signature-box"><strong>Lieu / date</strong>${escapeHtml(formatDate(state.meta.date))}</div><div class="signature-box"><strong>Visa représentant MOETx SNCF</strong>${escapeHtml(state.meta.moeRepresentative || "Nom / prénom à renseigner")}</div>${companyVisaMarkup}<div class="signature-box signature-after-work"><strong>Visa après travaux</strong>${escapeHtml([signature.name, signature.role].filter(Boolean).join(" · ") || "Nom / fonction à renseigner")}${signature.signedAt ? `<small>Signée le ${escapeHtml(formatDateTime(signature.signedAt))}</small>` : ""}${signatureMarkup}</div></section>
        <p class="print-footer">Rapport opérationnel généré depuis l’application rapport journalier AINM.</p>
      </article>
      ${includeValuation ? `<article class="print-page print-internal">
        <header class="print-header"><div><span class="print-brand">AINM</span><h1 class="print-title">ANNEXE DE VALORISATION INTERNE</h1></div><div class="print-meta">${escapeHtml(state.meta.reportNo || "—")}<br>Montants indicatifs HT</div></header>
        <section class="print-section"><h2>Rapprochement production / bordereau</h2><table class="print-table"><thead><tr><th>Prestation terrain</th><th>Référence PB</th><th class="numeric">Quantité / base</th><th class="numeric">PU / taux</th><th class="numeric">Montant HT</th></tr></thead><tbody>${valuationRows}<tr><td colspan="4"><strong>Total valorisé indicatif HT</strong></td><td class="numeric"><strong>${euros(total)}</strong></td></tr></tbody></table></section>
        <section class="print-section"><h2>Contrôle</h2><div class="print-note">Les prestations hors catalogue ou incomplètes restent visibles dans le rapport terrain et nécessitent un contrôle administratif. Les dispositions communes, lorsqu’elles sont activées, sont calculées à titre indicatif à partir des postes du présent rapport. Cette annexe ne remplace pas la validation de la situation de travaux.</div></section>
      </article>` : ""}`;
  }

  function chunkReportItems(items, size) {
    const result = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result.length ? result : [[]];
  }

  function reportTextList(items, fallback = "A renseigner", limit = 3) {
    const values = [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
    if (!values.length) return fallback;
    const shown = values.slice(0, limit);
    return `${shown.join(" - ")}${values.length > limit ? ` + ${values.length - limit}` : ""}`;
  }

  function reportTaskQuantity(task, template) {
    if (template?.metric === "openClose") return `Ouv. ${displayNumber(task.opening)} / Ferm. ${displayNumber(task.closing)} ml`;
    const quantity = task.quantity === "" || task.quantity == null ? "-" : displayNumber(task.quantity);
    return `${quantity} ${task.unit || template?.unit || "u"}`;
  }

  function reportTaskLocation(task) {
    const location = [task.voie && `Voie ${task.voie}`, task.pkStart && `PK ${task.pkStart}`, task.pkEnd && `a ${task.pkEnd}`].filter(Boolean);
    return location.length ? location.join(" - ") : "Localisation non renseignée";
  }

  function reportFooter() {
    return `<footer class="rj-report-foot"><span>Rapport journalier AINM - document généré par l'application</span><span>__REPORT_PAGE__</span></footer>`;
  }

  function reportStatusForAnomaly(row) {
    const status = String(row.status || "").trim();
    if (status) return { label: status, tone: /termin/i.test(status) ? "" : /cours/i.test(status) ? "warning" : "danger" };
    if (row.severity === "Bloquant") return { label: "A faire", tone: "danger" };
    if (row.severity === "À surveiller") return { label: "A suivre", tone: "warning" };
    return { label: "A suivre", tone: "warning" };
  }

  function archiveReportPage(title, subtitle, content, modifier = "") {
    return `<article class="rj-report-page rj-archive-page ${modifier}">
      <header class="rj-archive-head"><div class="rj-archive-brand"><img src="assets/ainm-infrapole-paris-sud-est.jpg" alt="AINM Infrapôle Paris Sud Est"><div><span>Rapport journalier · dossier d’archivage</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div></div><div class="rj-archive-reference">${escapeHtml(state.meta.reportNo || "N° à renseigner")}</div></header>
      ${content}
      ${reportFooter()}
    </article>`;
  }

  function archiveTablePage(title, subtitle, headers, rows, pageIndex = 0, extra = "") {
    const head = headers.map((header) => `<th>${header}</th>`).join("");
    const body = rows.length ? rows.join("") : `<tr><td colspan="${headers.length}" class="rj-empty-note">Aucune donnée saisie.</td></tr>`;
    return archiveReportPage(`${title}${pageIndex ? " - suite" : ""}`, subtitle, `<table class="rj-archive-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${extra}`);
  }

  function chunkArchiveText(value, maxLength = 1350) {
    const text = String(value || "").trim();
    if (!text) return [];
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLength) {
      const boundary = Math.max(remaining.lastIndexOf("\n", maxLength), remaining.lastIndexOf(". ", maxLength), remaining.lastIndexOf(" ", maxLength));
      const splitAt = boundary > Math.floor(maxLength * 0.55) ? boundary + (remaining[boundary] === "." ? 1 : 0) : maxLength;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  function renderArchivePages() {
    const pages = [];
    const session = `${state.meta.shiftType === "nuit" ? "Nuit" : "Journée"} · ${state.meta.shiftStart || "—"} → ${state.meta.shiftEnd || "—"}`;
    const status = state.meta.cancelled ? "Chantier annulé" : "Séance réalisée";
    const identityCards = [
      ["Opération / chantier", state.meta.operation || "—"], ["Lieu / secteur", state.meta.location || "—"], ["N° rapport", state.meta.reportNo || "—"], ["N° commande", state.meta.orderNo || "—"],
      ["Entreprise principale", enterpriseName() || "—"], ["Date et séance", `${formatDate(state.meta.date)} · ${session}`], ["Durée effective", state.meta.workDuration ? `${displayNumber(state.meta.workDuration)} h` : "—"], ["Météo / température", [state.meta.weather, state.meta.temperature !== "" ? `${state.meta.temperature} °C` : ""].filter(Boolean).join(" · ") || "—"],
      ["Rédacteur", state.meta.reporter || "—"], ["Représentant MOETx SNCF", state.meta.moeRepresentative || "—"], ["Représentant entreprise", state.meta.companyRepresentative || "—"], ["Statut", status],
    ];
    const notes = [
      ["Objectif / consigne de la séance", state.meta.objective || "Non renseigné."],
      ["Faits marquants / aléas / décisions", state.meta.executionNotes && state.meta.executionNotes.length <= 780 ? state.meta.executionNotes : (state.meta.executionNotes ? "Voir la ou les pages détaillées de suivi." : "Aucun élément complémentaire renseigné.")],
      ["Travaux restant / prochaine séance", state.meta.nextWorks && state.meta.nextWorks.length <= 780 ? state.meta.nextWorks : (state.meta.nextWorks ? "Voir la ou les pages détaillées de suivi." : "Aucun élément complémentaire renseigné.")],
    ];
    pages.push(archiveReportPage("Fiche d’identification de la séance", "Trame d’archivage complète — contexte, participants et consignes", `
      <section class="rj-archive-intro"><div class="rj-archive-logo-line"><img src="assets/ainm-infrapole-paris-sud-est.jpg" alt="AINM"><div><strong>RAPPORT JOURNALIER DE CHANTIER</strong><span>Référence documentaire : ${escapeHtml(state.meta.reportNo || "à renseigner")}</span></div></div><div class="rj-archive-info-grid">${identityCards.map(([label, value]) => `<section><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></section>`).join("")}</div></section>
      <section class="rj-archive-notes">${notes.map(([title, value]) => `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(value)}</p></section>`).join("")}${state.meta.cancelled ? `<section class="rj-archive-alert"><h2>Motif d’annulation</h2><p>${escapeHtml(state.meta.cancelReason || "Non renseigné.")}</p></section>` : ""}</section>`));

    [["Faits marquants, aléas et décisions", state.meta.executionNotes], ["Travaux restant et préparation de la prochaine séance", state.meta.nextWorks]].forEach(([title, text]) => {
      const chunks = chunkArchiveText(text);
      if (chunks.length <= 1 && String(text || "").length <= 780) return;
      chunks.forEach((chunk, index) => pages.push(archiveReportPage(`${title}${index ? " - suite" : ""}`, "Détail intégral saisi dans l’application", `<section class="rj-archive-notes"><section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(chunk)}</p></section></section>`)));
    });

    const addRows = (title, subtitle, headers, rows, size, extra = "") => {
      if (!rows.length) return;
      chunkReportItems(rows, size).forEach((chunk, index) => pages.push(archiveTablePage(title, subtitle, headers, chunk, index, index === 0 ? extra : "")));
    };

    addRows("Personnel et intervenants", "Main-d’œuvre engagée pour la séance", ["Famille / entreprise", "Fonction", "Effectif", "H / pers.", "Chef d’équipe / observation"], state.personnel.map((row) => `<tr><td>${escapeHtml([row.team, companyName(row)].filter(Boolean).join(" · "))}</td><td>${escapeHtml(roleName(row))}</td><td class="rj-archive-number">${escapeHtml(displayNumber(row.count, 0))}</td><td class="rj-archive-number">${row.hours ? escapeHtml(displayNumber(row.hours)) : "—"}</td><td>${escapeHtml([row.lead, row.observation].filter(Boolean).join(" · ") || "—")}</td></tr>`), 8);

    addRows("Engins et matériels entreprise", "Matériels réellement engagés et conditions d’utilisation", ["Engin / famille", "Entreprise", "Nb", "Identification", "Zone / PK", "Observation / sécurité"], state.equipment.map((row) => `<tr><td><strong>${escapeHtml(equipmentName(row))}</strong><br><small>${escapeHtml(row.family || "—")}</small></td><td>${escapeHtml(companyName(row))}</td><td class="rj-archive-number">${escapeHtml(displayNumber(row.count, 0))}</td><td>${escapeHtml(row.identification || "—")}</td><td>${escapeHtml([row.zone, row.pk, row.miseEnVoie].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`), 7);

    addRows("Interceptions, possessions et consignations", "Horaires prévus, accordés, réels et intervention effective", ["Voie / zone", "Prévu", "Accordé", "Réel", "Intervention", "Référence / observation"], state.possessions.map((row) => `<tr><td>${escapeHtml([row.voie && `Voie ${row.voie}`, row.zone].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml(`${row.plannedStart || "—"} → ${row.plannedEnd || "—"}`)}</td><td>${escapeHtml(`${row.agreedStart || "—"} → ${row.agreedEnd || "—"}`)}</td><td>${escapeHtml(`${row.actualStart || "—"} → ${row.actualEnd || "—"}`)}</td><td>${escapeHtml(`${row.interventionStart || "—"} → ${row.interventionEnd || "—"}`)}</td><td>${escapeHtml([row.reference, row.observation].filter(Boolean).join(" · ") || "—")}</td></tr>`), 7);

    addRows("Travaux réellement réalisés", "Détail d’archivage des prestations saisies sur le terrain", ["Prestation", "Quantité", "Voie / PK", "Observation"], state.tasks.map((task) => {
      const template = templateById.get(task.templateId);
      return `<tr><td><strong>${escapeHtml(task.label || template?.reportLabel || "Prestation")}</strong></td><td class="rj-archive-number">${escapeHtml(reportTaskQuantity(task, template))}</td><td>${escapeHtml(reportTaskLocation(task))}</td><td>${escapeHtml(task.note || "—")}</td></tr>`;
    }), 9);

    addRows("Matériaux, consommables et éléments déposés", "Éléments déclarés au cours de la séance", ["Élément", "Qté / unité", "Voie / PK / zone", "Référence", "Observation"], state.materials.map((row) => `<tr><td><strong>${escapeHtml(row.name || row.type || "—")}</strong><br><small>${escapeHtml(row.type || "")}</small></td><td class="rj-archive-number">${row.quantity ? `${escapeHtml(displayNumber(row.quantity))} ${escapeHtml(row.unit || "")}` : "—"}</td><td>${escapeHtml(row.zone || "—")}</td><td>${escapeHtml(row.reference || "—")}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`), 8);

    addRows("Autocontrôles et contrôles", "Contrôles réalisés, résultats et réserves", ["Contrôle", "Résultat", "Zone", "Référence", "Réalisé par / heure", "Observation"], state.selfChecks.map((row) => `<tr><td>${escapeHtml(row.type || "—")}</td><td>${escapeHtml(row.status || "—")}</td><td>${escapeHtml(row.zone || "—")}</td><td>${escapeHtml(row.reference || "—")}</td><td>${escapeHtml([row.responsible, row.checkedAt].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`), 7);

    addRows("Anomalies, événements et points à lever", "Suivi des situations constatées pendant ou après les travaux", ["Nature / niveau / statut", "Zone", "Fait constaté", "Mesure prise / suite", "Responsable / échéance"], state.anomalies.map((row) => `<tr><td><strong>${escapeHtml(row.type || "Anomalie")}</strong><br><small>${escapeHtml([row.severity, reportStatusForAnomaly(row).label].filter(Boolean).join(" · "))}</small></td><td>${escapeHtml(row.zone || "—")}</td><td>${escapeHtml(row.detail || "—")}</td><td>${escapeHtml(row.action || "—")}</td><td>${escapeHtml([row.responsible, row.dueDate ? formatDate(row.dueDate) : ""].filter(Boolean).join(" · ") || "—")}</td></tr>`), 6);

    addRows("Rapports, fiches et pièces jointes", "Documents fournis ou à rapprocher de la séance", ["Document / fiche", "Référence", "Observation"], state.documents.map((row) => `<tr><td>${escapeHtml(row.name || "—")}</td><td>${escapeHtml(row.reference || "—")}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`), 10);

    addRows("Moyens SNCF engagés", "Moyens et fonctions SNCF mobilisés pendant la séance", ["Fonction", "Nombre", "Observation"], state.sncfMeans.map((row) => `<tr><td>${escapeHtml(canonicalSncfRole(row.role) || "—")}</td><td class="rj-archive-number">${escapeHtml(displayNumber(row.count, 0))}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`), 10);

    const signature = state.afterWorkSignature || {};
    pages.push(archiveReportPage("Visas et signatures", "Validation de fin de séance et visas des acteurs", `<section class="rj-archive-signatures"><section><strong>Rédacteur / surveillant</strong><span>${escapeHtml(state.meta.reporter || "Nom à renseigner")}</span><div class="rj-archive-signature-line"></div></section><section><strong>Représentant MOETx SNCF</strong><span>${escapeHtml(state.meta.moeRepresentative || "Nom à renseigner")}</span><div class="rj-archive-signature-line"></div></section><section><strong>Représentant entreprise</strong><span>${escapeHtml(state.meta.companyRepresentative || "Nom à renseigner")}</span><div class="rj-archive-signature-line"></div></section><section><strong>Visa après travaux</strong><span>${escapeHtml([signature.name, signature.role].filter(Boolean).join(" · ") || "Nom / fonction à renseigner")}${signature.signedAt ? `<small>Signée le ${escapeHtml(formatDateTime(signature.signedAt))}</small>` : ""}${signature.dataUrl ? `<img src="${escapeHtml(signature.dataUrl)}" alt="Signature après travaux">` : `<div class="rj-archive-signature-line"></div>`}</section></section><p class="rj-archive-legal">Rapport n° ${escapeHtml(state.meta.reportNo || "—")} · Les visas matérialisent la prise de connaissance des informations consignées.</p>`));
    return pages;
  }

  function renderV7PrintReportDeprecated() {
    const includeValuation = isAdminView();
    const breakdown = valuationBreakdown();
    const resolved = breakdown.valuations;
    const tasks = chunkReportItems(resolved, 9);
    const allPhotos = state.photos || [];
    const coverPhoto = allPhotos.find((photo) => photo.phase === "apres") || allPhotos.find((photo) => photo.phase === "avant") || allPhotos[0];
    const observationPhotos = allPhotos.slice(0, 2);
    const appendixPhotos = [
      ...allPhotos.filter((photo) => photo.phase === "avant"),
      ...allPhotos.filter((photo) => photo.phase !== "avant"),
    ];
    const photosPages = chunkReportItems(appendixPhotos, 4);
    const totalPeople = state.personnel.reduce((sum, row) => sum + number(row.count), 0);
    const totalEquipment = state.equipment.reduce((sum, row) => sum + number(row.count), 0);
    const companies = [enterpriseName(), ...state.personnel.map(companyName), ...state.equipment.map(companyName)];
    const locations = [
      ...state.tasks.map(reportTaskLocation),
      ...state.possessions.map((row) => row.voie ? `Voie ${row.voie}` : ""),
    ];
    const session = `${state.meta.shiftType === "nuit" ? "Nuit" : "Journée"} - ${state.meta.shiftStart || "--:--"} - ${state.meta.shiftEnd || "--:--"}`;
    const workSummary = state.tasks.length
      ? reportTextList(state.tasks.map((task) => `${task.label || "Prestation"} (${reportTaskQuantity(task, templateById.get(task.templateId))})`), "Aucun travail saisi", 3)
      : "Aucun travail saisi.";
    const pendingAnomalies = state.anomalies.filter((row) => row.severity !== "Information");
    const observationSummary = pendingAnomalies.length
      ? reportTextList(pendingAnomalies.map((row) => row.detail || row.action || "Point de suivi"), "Aucun point à lever", 2)
      : "Aucun point bloquant signalé.";
    const coverVisual = coverPhoto
      ? `<img src="${escapeHtml(coverPhoto.dataUrl)}" alt="Photo terrain de la séance">`
      : `<div class="rj-cover-placeholder"><img src="assets/ainm-infrapole-paris-sud-est.jpg" alt="AINM Infrapôle Paris Sud Est"><span>Ajouter une photo terrain pour illustrer la séance</span></div>`;
    const reportTitle = state.meta.cancelled ? "Rapport journalier - chantier annulé" : "Rapport Journalier de Chantier";
    const reportKicker = state.meta.cancelled ? "Séance annulée - traçabilité conservée" : "Compte rendu terrain - travaux signalisation";
    const pages = [];

    pages.push(`
      <article class="rj-report-page rj-cover-page">
        <header class="rj-report-head">
          <div class="rj-report-brand"><img class="rj-report-logo" src="assets/ainm-infrapole-paris-sud-est.jpg" alt="AINM Infrapôle Paris Sud Est"><div><h1 class="rj-report-title">${escapeHtml(reportTitle)}</h1><p class="rj-report-subtitle">${escapeHtml(reportKicker)}</p></div></div>
          <div class="rj-report-auto">Document terrain<br>généré par l'application</div>
        </header>
        <section class="rj-project"><span class="rj-project-label">Projet / opération</span><div class="rj-project-name">${escapeHtml(state.meta.operation || "Opération à renseigner")}</div></section>
        <figure class="rj-cover-visual">${coverVisual}</figure>
        <section class="rj-stat-grid" aria-label="Synthèse de séance">
          <div class="rj-stat-card"><span class="rj-stat-label">Date</span><span class="rj-stat-value">${escapeHtml(formatDate(state.meta.date))}</span></div>
          <div class="rj-stat-card"><span class="rj-stat-label">Séance</span><span class="rj-stat-value">${escapeHtml(session)}</span></div>
          <div class="rj-stat-card"><span class="rj-stat-label">Météo</span><span class="rj-stat-value">${escapeHtml([state.meta.weather || "Non renseignée", state.meta.temperature !== "" && state.meta.temperature != null ? `${state.meta.temperature} °C` : ""].filter(Boolean).join(" - "))}</span></div>
          <div class="rj-stat-card"><span class="rj-stat-label">Entreprise(s)</span><span class="rj-stat-value">${escapeHtml(reportTextList(companies, "A renseigner", 2))}</span></div>
          <div class="rj-stat-card"><span class="rj-stat-label">Effectif</span><span class="rj-stat-value">${totalPeople ? `${displayNumber(totalPeople, 0)} personne(s)` : "Non renseigné"}</span></div>
          <div class="rj-stat-card"><span class="rj-stat-label">Engins</span><span class="rj-stat-value">${totalEquipment ? `${displayNumber(totalEquipment, 0)} engin(s)` : "Aucun renseigné"}</span></div>
          <div class="rj-stat-card"><span class="rj-stat-label">Incident / aléa</span><span class="rj-stat-value">${state.anomalies.length ? `${state.anomalies.length} point(s) signalé(s)` : "Aucun"}</span></div>
          <div class="rj-stat-card wide"><span class="rj-stat-label">Voies / zone</span><span class="rj-stat-value">${escapeHtml(reportTextList(locations, "Zone à renseigner", 3))}</span></div>
        </section>
        <section class="rj-summary-grid">
          <section class="rj-summary-panel"><h2>Objectif de la séance</h2><p>${escapeHtml(state.meta.objective || "Objectif non renseigné dans la saisie terrain.")}</p></section>
          <section class="rj-summary-panel"><h2>Synthèse rapide</h2><ul class="rj-status-list"><li><strong><span class="rj-status-dot"></span>Travaux réalisés</strong>${escapeHtml(workSummary)}</li><li><strong><span class="rj-status-dot ${pendingAnomalies.length ? "warning" : ""}"></span>Points à suivre</strong>${escapeHtml(observationSummary)}</li>${state.meta.cancelled ? `<li><strong><span class="rj-status-dot danger"></span>Annulation</strong>${escapeHtml(state.meta.cancelReason || "Motif non renseigné")}</li>` : ""}</ul></section>
        </section>
        ${reportFooter()}
      </article>`);

    tasks.forEach((pageTasks, pageIndex) => {
      const rows = pageTasks.length ? pageTasks.map(({ task, template, result }, index) => {
        const sequence = pageIndex * 9 + index + 1;
        return `<tr><td><div class="rj-work-name"><span class="rj-work-seq">${sequence}</span><span>${escapeHtml(task.label || template?.reportLabel || "Prestation")}</span></div></td><td class="rj-work-numeric">${escapeHtml(reportTaskQuantity(task, template))}</td><td>${escapeHtml(reportTaskLocation(task))}</td><td>${escapeHtml(task.note || "Sans observation")}</td></tr>`;
      }).join("") : `<tr><td colspan="${includeValuation ? 7 : 4}" class="rj-empty-note">Aucune prestation saisie.</td></tr>`;
      pages.push(`
        <article class="rj-report-page">
          <header class="rj-section-head"><span class="rj-section-icon">P</span><div><h1>Prestations saisies sur le terrain${pageIndex ? " - suite" : ""}</h1><p>Saisie terrain simplifiée — quantités, voies et observations</p></div></header>
          <table class="rj-work-table"><thead><tr><th style="width:31%">Prestation terrain</th><th style="width:15%">Qté / unité</th><th style="width:28%">Critères / localisation</th><th style="width:26%">Observation</th></tr></thead><tbody>${rows}</tbody></table>
          ${pageIndex === 0 ? `<section class="rj-production-bottom"><section class="rj-feature-card"><h2>Fonctions intégrées de l'application</h2><ul><li>Numérotation unique de chaque rapport</li><li>Reprise du personnel et des engins de la dernière nuit</li><li>Saisie simplifiée sans affichage des prix terrain</li><li>Photos datées avant / après nuit, avec zone et légende</li><li>Visas et signature après travaux</li></ul></section><section class="rj-production-total"><div><span>Production de la séance</span><strong>${state.tasks.length}</strong><span>prestation(s) saisie(s)</span></div><div class="minor-total"><span>Traçabilité</span><strong>${allPhotos.length}</strong><span>photo(s) jointe(s)</span></div></section></section>` : ""}
          ${reportFooter()}
        </article>`);
    });

    const observationRows = state.anomalies.length ? state.anomalies.slice(0, 2).map((row, index) => {
      const status = reportStatusForAnomaly(row);
      const photo = observationPhotos[index];
      const photoMarkup = photo ? `<figure class="rj-observation-photo"><img src="${escapeHtml(photo.dataUrl)}" alt="Photo de suivi terrain"><figcaption class="hidden">${escapeHtml(photo.caption || "Photo terrain")}</figcaption></figure>` : `<div class="rj-observation-photo"><div class="rj-observation-placeholder">Photo de suivi<br>non ajoutée</div></div>`;
      return `<article class="rj-observation-card"><div><div class="rj-observation-top"><span class="rj-observation-id">Observation n° ${escapeHtml(`${state.meta.reportNo || "RJ"}-${String(index + 1).padStart(2, "0")}`)}</span><span class="rj-observation-status ${status.tone}">${escapeHtml(status.label)}</span></div><div class="rj-observation-zone">${escapeHtml(row.type || "Observation terrain")} - ${escapeHtml(row.severity || "Niveau à renseigner")}</div><p><strong>Description</strong> ${escapeHtml(row.detail || "Aucun détail renseigné.")}</p><p><strong>Suite</strong> ${escapeHtml(row.action || "Aucune action renseignée.")}</p></div>${photoMarkup}</article>`;
    }).join("") : `<div class="rj-empty-note">Aucune anomalie ou réserve constatée pour cette séance.</div>`;
    const personnelText = reportTextList(state.personnel.map((row) => `${roleName(row)} (${displayNumber(row.count, 0)})`), "Aucun intervenant renseigné", 3);
    const equipmentText = reportTextList(state.equipment.map((row) => `${equipmentName(row)}${row.count ? ` (${displayNumber(row.count, 0)})` : ""}`), "Aucun engin renseigné", 3);
    const possessionText = reportTextList(state.possessions.map((row) => `${row.voie || "Voie"} ${row.actualStart || "--:--"}-${row.actualEnd || "--:--"}`), session, 2);
    const sncfMeansText = reportTextList(state.sncfMeans.map((row) => `${canonicalSncfRole(row.role) || "Moyen"}${row.count ? ` (${displayNumber(row.count, 0)})` : ""}`), "Aucun moyen SNCF renseigné", 4);
    const documentsText = reportTextList(state.documents.map((row) => row.reference ? `${row.name || "Document"} - ${row.reference}` : row.name), "Aucun document renseigné", 3);
    const actionRows = state.anomalies.length ? state.anomalies.map((row, index) => {
      const status = reportStatusForAnomaly(row);
      return `<tr><td>${index + 1}</td><td>${escapeHtml(row.action || row.detail || "Action à définir")}</td><td>${escapeHtml(row.responsible || "À désigner")}</td><td>${escapeHtml(row.dueDate ? formatDate(row.dueDate) : "-")}</td><td>${escapeHtml(status.label)}</td></tr>`;
    }).join("") : `<tr><td colspan="5">Aucun point à lever.</td></tr>`;
    pages.push(`
      <article class="rj-report-page">
        <header class="rj-section-head"><span class="rj-section-icon">O</span><div><h1>Observations et suivi terrain</h1><p>Suivi des situations, actions et validations de la séance</p></div></header>
        <section class="rj-observation-list">${observationRows}</section>
        <section class="rj-resource-strip"><section class="rj-resource-item"><h2>Personnel</h2><p>${escapeHtml(personnelText)}</p></section><section class="rj-resource-item"><h2>Matériels et engins</h2><p>${escapeHtml(equipmentText)}</p></section><section class="rj-resource-item"><h2>Horaires / interceptions</h2><p>${escapeHtml(possessionText)}</p></section></section>
        <section class="rj-trace-note"><strong>Moyens SNCF :</strong> ${escapeHtml(sncfMeansText)}<br><strong>Documents / fiches :</strong> ${escapeHtml(documentsText)}</section>
        <section class="rj-actions"><h2>Actions / points à lever</h2><table class="rj-actions-table"><thead><tr><th>N°</th><th>Action / point à lever</th><th>Responsable</th><th>Échéance</th><th>Statut</th></tr></thead><tbody>${actionRows}</tbody></table></section>
        <section class="rj-signatures"><section class="rj-signature-box"><strong>Représentant entreprise</strong><span>${escapeHtml(state.meta.companyRepresentative || "Nom à renseigner")}</span><div class="rj-signature-line"></div></section><section class="rj-signature-box"><strong>Représentant SNCF</strong><span>${escapeHtml(state.meta.moeRepresentative || "Nom à renseigner")}</span><div class="rj-signature-line"></div></section><section class="rj-signature-box"><strong>Visa après travaux</strong><span>${escapeHtml([state.afterWorkSignature?.name, state.afterWorkSignature?.role].filter(Boolean).join(" - ") || "Nom et fonction à renseigner")}</span>${state.afterWorkSignature?.dataUrl ? `<img src="${escapeHtml(state.afterWorkSignature.dataUrl)}" alt="Signature après travaux">` : "<div class=\"rj-signature-line\"></div>"}</section></section>
        ${reportFooter()}
      </article>`);

    if (state.anomalies.length > 2) {
      chunkReportItems(state.anomalies.slice(2), 2).forEach((anomalyPage, anomalyPageIndex) => {
        const cards = anomalyPage.map((row, index) => {
          const globalIndex = anomalyPageIndex * 2 + index + 2;
          const status = reportStatusForAnomaly(row);
          const photo = allPhotos[globalIndex];
          const photoMarkup = photo ? `<figure class="rj-observation-photo"><img src="${escapeHtml(photo.dataUrl)}" alt="Photo de suivi terrain"><figcaption class="hidden">${escapeHtml(photo.caption || "Photo terrain")}</figcaption></figure>` : `<div class="rj-observation-photo"><div class="rj-observation-placeholder">Photo de suivi<br>non ajoutée</div></div>`;
          return `<article class="rj-observation-card"><div><div class="rj-observation-top"><span class="rj-observation-id">Observation n° ${escapeHtml(`${state.meta.reportNo || "RJ"}-${String(globalIndex + 1).padStart(2, "0")}`)}</span><span class="rj-observation-status ${status.tone}">${escapeHtml(status.label)}</span></div><div class="rj-observation-zone">${escapeHtml(row.type || "Observation terrain")} - ${escapeHtml(row.severity || "Niveau à renseigner")}</div><p><strong>Description</strong> ${escapeHtml(row.detail || "Aucun détail renseigné.")}</p><p><strong>Suite</strong> ${escapeHtml(row.action || "Aucune action renseignée.")}</p></div>${photoMarkup}</article>`;
        }).join("");
        pages.push(`<article class="rj-report-page"><header class="rj-section-head"><span class="rj-section-icon">O</span><div><h1>Observations de terrain - suite</h1><p>Détails complémentaires des situations signalées</p></div></header><section class="rj-observation-list">${cards}</section>${reportFooter()}</article>`);
      });
    }

    if (appendixPhotos.length) {
      photosPages.forEach((photoPage, photoPageIndex) => {
        const photoCards = photoPage.map((photo) => `<figure class="rj-photo-appendix-card"><img src="${escapeHtml(photo.dataUrl)}" alt="Photo ${escapeHtml(photo.phase === "avant" ? "avant nuit" : "après nuit")}"><figcaption><strong>${escapeHtml(photo.phase === "avant" ? "Avant nuit" : "Après nuit")}${photo.category ? ` · ${escapeHtml(photo.category)}` : ""}</strong><br>${escapeHtml(formatDateTime(photo.capturedAt))}${photo.zone ? `<br>${escapeHtml(photo.zone)}` : ""}${photo.caption ? `<br>${escapeHtml(photo.caption)}` : ""}</figcaption></figure>`).join("");
        pages.push(`<article class="rj-report-page"><header class="rj-section-head"><span class="rj-section-icon">P</span><div><h1>Pièces jointes photo${photoPageIndex ? " - suite" : ""}</h1><p>Photos datées, classées avant / après nuit et localisées</p></div></header><section class="rj-photo-appendix-grid">${photoCards}</section>${reportFooter()}</article>`);
      });
    }

    pages.push(...renderArchivePages());

    if (includeValuation) {
      const valuationRows = breakdown.valuations.map(({ task, template, result }) => `<tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}</td><td>${escapeHtml(result.record?.article || "A contrôler")}</td><td class="rj-work-numeric">${escapeHtml(reportTaskQuantity(task, template))}</td><td class="rj-work-numeric">${result.status === "priced" ? escapeHtml(euros(result.unitPrice)) : "-"}</td><td class="rj-work-numeric">${result.status === "priced" ? escapeHtml(euros(result.amount)) : "-"}</td></tr>`);
      const financePages = chunkReportItems(valuationRows, 12);
      financePages.forEach((financeRows, financeIndex) => {
        const isLast = financeIndex === financePages.length - 1;
        const commonRows = isLast ? breakdown.commonCosts.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.article)}</td><td class="rj-work-numeric">Base ${escapeHtml(euros(row.base))}</td><td class="rj-work-numeric">${displayNumber(row.rate * 100)} %</td><td class="rj-work-numeric">${escapeHtml(euros(row.amount))}</td></tr>`).join("") : "";
        const totalRow = isLast ? `<tr><td colspan="4"><strong>Total valorisé indicatif HT</strong></td><td class="rj-work-numeric"><strong>${escapeHtml(euros(breakdown.total))}</strong></td></tr>` : "";
        const body = financeRows.length ? financeRows.join("") : `<tr><td colspan="5" class="rj-empty-note">Aucune prestation à valoriser.</td></tr>`;
        pages.push(`<article class="rj-report-page rj-admin-page"><header class="rj-section-head"><span class="rj-section-icon">€</span><div><h1>Annexe de valorisation interne${financeIndex ? " - suite" : ""}</h1><p>Réservée à l'administrateur principal - montants indicatifs HT</p></div></header><table class="rj-work-table"><thead><tr><th style="width:35%">Prestation terrain</th><th style="width:18%">Référence PB</th><th style="width:17%">Qté / unité</th><th style="width:15%">P.U. HT</th><th style="width:15%">Montant HT</th></tr></thead><tbody>${body}${commonRows}${totalRow}</tbody></table>${isLast ? `<section class="rj-feature-card"><h2>Contrôle administratif</h2><ul><li>Les prix ne sont jamais affichés aux agents terrain.</li><li>Les lignes sans prix restent à contrôler dans l'espace administrateur.</li><li>Cette annexe ne remplace pas la validation de la situation de travaux.</li></ul></section>` : ""}${reportFooter()}</article>`);
      });
    }

    $("#printReport").innerHTML = pages.map((page, index) => page.replaceAll("__REPORT_PAGE__", `${index + 1}/${pages.length}`)).join("");
  }

  function exportState(share = false, { handoff = false } = {}) {
    const baseName = (state.meta.reportNo || "brouillon").replace(/[^a-zA-Z0-9_-]+/g, "-");
    const filename = `${handoff ? "passation-" : "rapport-journalier-"}${baseName}${handoff ? `-r${state.collaboration?.revision || 1}` : ""}.json`;
    const exportable = clone(state);
    exportable.transfer = {
      format: "AINM-RJ-PASSATION",
      exportedAt: new Date().toISOString(),
      handoff,
      reportUid: state.reportUid,
      revision: state.collaboration?.revision || 1,
    };
    if (!isAdminView()) {
      delete exportable.settings;
      exportable.tasks = exportable.tasks.map(({ billingCr, ...task }) => task);
    }
    const file = new File([JSON.stringify(exportable, null, 2)], filename, { type: "application/json" });
    if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      navigator.share({ title: handoff ? "Passation rapport journalier" : "Rapport journalier", text: handoff ? `Passation · ${state.meta.reportNo || "rapport"} · révision ${state.collaboration?.revision || 1}` : (state.meta.operation || "Rapport journalier"), files: [file] }).catch(() => {});
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

  function openHandoffDialog() {
    $("#handoffEditorName").value = state.collaboration?.currentEditor || state.meta.reporter || "";
    $("#handoffEditorRole").value = state.collaboration?.currentRole || "";
    $("#handoffRecipient").value = "";
    $("#handoffStatus").textContent = `${state.meta.reportNo || "Rapport"} · révision ${state.collaboration?.revision || 1}. Le destinataire importe ensuite ce fichier depuis Actions.`;
    $("#handoffDialog").showModal();
  }

  function sendHandoff() {
    const editor = editorValue("handoffEditorName");
    const role = editorValue("handoffEditorRole");
    const recipient = editorValue("handoffRecipient");
    state.collaboration.currentEditor = editor;
    state.collaboration.currentRole = role;
    state.collaboration.revision = Math.max(1, number(state.collaboration.revision)) + 1;
    state.collaboration.handoffs.unshift({ id: uid(), sentAt: new Date().toISOString(), editor, role, recipient, revision: state.collaboration.revision });
    state.collaboration.handoffs = state.collaboration.handoffs.slice(0, 20);
    save(`Passation préparée · révision ${state.collaboration.revision}`);
    $("#handoffDialog").close();
    exportState(true, { handoff: true });
    showToast("Passation exportée : partager le fichier puis le faire importer par le destinataire.", "success");
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
      participatingCompanies: clone(sourceCopy.meta?.participatingCompanies || [sourceCopy.meta?.enterprise || state.meta.enterprise]).filter(Boolean),
      reporter: sourceCopy.meta?.reporter || "",
      moeRepresentative: sourceCopy.meta?.moeRepresentative || "",
      companyRepresentative: sourceCopy.meta?.companyRepresentative || "",
      location: sourceCopy.meta?.location || "",
      shiftType: sourceCopy.meta?.shiftType || "nuit",
      shiftStart: sourceCopy.meta?.shiftStart || "22:00",
      shiftEnd: sourceCopy.meta?.shiftEnd || "06:00",
      workDuration: sourceCopy.meta?.workDuration || "",
      weather: "",
      temperature: "",
      executionNotes: "",
      nextWorks: "",
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

  async function duplicateLastNight() {
    const history = readReportHistory();
    const source = history.find((report) => report.meta?.shiftType === "nuit")
      || (state.meta.shiftType === "nuit" && (state.personnel.length || state.equipment.length) ? state : null);
    if (!source) {
      showToast("Aucune nuit précédente avec personnel ou engin n’est disponible sur cet appareil. Créez le premier rapport puis utilisez Nouveau rapport à la fin de la séance.", "warning");
      return;
    }
    const label = `${formatDate(source.meta?.date)} · ${source.meta?.reportNo || "rapport précédent"}`;
    const accepted = await askConfirm({
      title: "Reprendre la dernière nuit",
      message: `Créer un nouveau rapport en reprenant le personnel, les engins et les moyens SNCF de ${label} ? Les travaux, photos, anomalies, consignations et signatures ne seront pas recopiés.`,
      confirmLabel: "Créer le rapport",
    });
    if (!accepted) return;
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
        save();
        refresh({ inputs: false });
      };
      element.addEventListener(element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input", handler);
    });

    $("#participantCompanyPicker")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-participant-company]");
      if (button) toggleParticipantCompany(button.dataset.participantCompany);
    });
    $("#addParticipantCompanyButton")?.addEventListener("click", () => {
      const input = $("#participantCompanyCustomInput");
      const company = input?.value.trim();
      if (!company) { showToast("Saisir le nom de l’entreprise ou du prestataire.", "warning"); return; }
      if (!participatingCompanyNames().includes(company)) state.meta.participatingCompanies.push(company);
      syncPrimaryEnterprise();
      input.value = "";
      save("Entreprise intervenante ajoutée");
      refresh({ inputs: true });
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
    $("#taskList").addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-edit-task]");
      const remove = event.target.closest("[data-delete-task]");
      if (edit) openTaskCatalog(edit.dataset.editTask);
      if (remove && await askConfirm({ title: "Supprimer la prestation", message: "Supprimer cette prestation du rapport ?", confirmLabel: "Supprimer", danger: true })) {
        state.tasks = state.tasks.filter((task) => task.id !== remove.dataset.deleteTask);
        save("Prestation supprimée");
        refresh();
      }
    });

    $$('[data-add-row]').forEach((button) => button.addEventListener("click", () => openRowDialog(button.dataset.addRow)));
    $("#rowDialog").addEventListener("click", (event) => {
      const counter = event.target.closest("[data-counter-target]");
      if (counter) {
        const input = $(`#${counter.dataset.counterTarget}`);
        if (input) input.value = Math.max(1, Math.floor(number(input.value)) + number(counter.dataset.counterDelta));
        return;
      }
      if (event.target.closest("#saveRowButton")) saveRow();
    });
    $("#quickPersonnelRoster")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quick-personnel-role]");
      if (!button) return;
      const company = button.dataset.quickPersonnelCompany;
      const role = button.dataset.quickPersonnelRole;
      const team = button.dataset.quickPersonnelTeam;
      adjustRoleCounter("personnel", { company, role, team }, { company, role, team, companyOther: "", roleOther: "", lead: "", observation: "" }, number(button.dataset.counterDelta));
    });
    $("#quickSncfRoster")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quick-sncf-role]");
      if (!button) return;
      const role = button.dataset.quickSncfRole;
      adjustRoleCounter("sncfMeans", { role }, { role, observation: "" }, number(button.dataset.counterDelta));
    });
    $$(".data-list").forEach((list) => list.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-edit-row]");
      const remove = event.target.closest("[data-delete-row]");
      if (edit) {
        const [key, id] = edit.dataset.editRow.split(":");
        const row = state[key]?.find((item) => item.id === id);
        if (row) openRowDialog(key, row);
        return;
      }
      if (!remove) return;
      const accepted = await askConfirm({ title: "Supprimer la ligne", message: "Supprimer cette ligne du rapport ?", confirmLabel: "Supprimer", danger: true });
      if (!accepted) return;
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
    $("#photoList").addEventListener("click", async (event) => {
      const remove = event.target.closest("[data-delete-photo]");
      if (!remove) return;
      const accepted = await askConfirm({ title: "Supprimer la photo", message: "Supprimer cette photo du rapport ?", confirmLabel: "Supprimer", danger: true });
      if (!accepted) return;
      state.photos = state.photos.filter((photo) => photo.id !== remove.dataset.deletePhoto);
      save("Photo supprimée");
      renderPhotos();
      renderPrintReport();
    });
    $("#photoList").addEventListener("change", (event) => {
      const input = event.target.closest("[data-photo-field]");
      if (!input) return;
      const photo = state.photos.find((item) => item.id === input.dataset.photoId);
      if (!photo) return;
      photo[input.dataset.photoField] = input.value.trim();
      save("Informations photo enregistrées");
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
    $("#clearAfterWorkSignatureButton").addEventListener("click", async () => {
      if (state.afterWorkSignature.dataUrl) {
        const accepted = await askConfirm({ title: "Effacer la signature", message: "Effacer la signature après travaux ?", confirmLabel: "Effacer", danger: true });
        if (!accepted) return;
      }
      state.afterWorkSignature.dataUrl = "";
      state.afterWorkSignature.signedAt = "";
      save("Signature effacée");
      renderAfterWorkSignature();
      renderPrintReport();
    });

    $("#addCompanyVisaButton")?.addEventListener("click", () => openCompanyVisaDialog(enterpriseName()));
    $("#companyVisaList")?.addEventListener("click", async (event) => {
      const add = event.target.closest("[data-add-company-visa]");
      if (add) { openCompanyVisaDialog(add.dataset.addCompanyVisa); return; }
      const edit = event.target.closest("[data-edit-company-visa]");
      if (edit) {
        const visa = state.companySignatures.find((signature) => signature.id === edit.dataset.editCompanyVisa);
        if (visa) openCompanyVisaDialog(visa.company, visa);
        return;
      }
      const remove = event.target.closest("[data-delete-company-visa]");
      if (!remove) return;
      const accepted = await askConfirm({ title: "Supprimer le visa", message: "Supprimer ce visa entreprise du rapport ?", confirmLabel: "Supprimer", danger: true });
      if (!accepted) return;
      state.companySignatures = state.companySignatures.filter((signature) => signature.id !== remove.dataset.deleteCompanyVisa);
      save("Visa entreprise supprimé");
      renderCompanyVisas();
      renderPrintReport();
    });
    $("#companyVisaDialog")?.addEventListener("click", (event) => {
      if (event.target.closest("#saveCompanyVisaButton")) { saveCompanyVisa(); return; }
      if (!event.target.closest("#clearCompanyVisaSignatureButton")) return;
      if (!companyVisaDraft) return;
      companyVisaDraft.dataUrl = "";
      companyVisaDraft.signedAt = "";
      drawCompanySignatureData();
      const status = $("#companyVisaSignatureStatus");
      if (status) status.textContent = "Signer au doigt dans la zone ci-dessus.";
    });

    $("#printButton").addEventListener("click", () => { renderPrintReport(); window.print(); });
    $("#handoffButton")?.addEventListener("click", openHandoffDialog);
    $("#handoffMenuButton")?.addEventListener("click", () => { $("#moreDialog").close(); openHandoffDialog(); });
    $("#sendHandoffButton")?.addEventListener("click", sendHandoff);
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
    $("#newReportButton").addEventListener("click", async () => {
      const accepted = await askConfirm({
        title: "Créer un nouveau rapport",
        message: "Le rapport actuel sera conservé localement pour pouvoir reprendre ses équipes et engins.",
        confirmLabel: "Créer le rapport",
      });
      if (!accepted) return;
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
        const incomingRevision = Math.max(1, number(parsed.collaboration?.revision) || 1);
        const currentRevision = Math.max(1, number(state.collaboration?.revision) || 1);
        if (parsed.reportUid && parsed.reportUid === state.reportUid && incomingRevision < currentRevision) {
          const accepted = await askConfirm({ title: "Révision plus ancienne", message: `Cette passation est en révision ${incomingRevision} alors que cet appareil contient déjà la révision ${currentRevision}. L’importation remplacerait la saisie locale. Continuer ?`, confirmLabel: "Importer quand même", danger: true });
          if (!accepted) { event.target.value = ""; return; }
        }
        const currentSettings = clone(state.settings || {});
        const importedSettings = parsed.settings || {};
        state = parsed;
        delete state.transfer;
        state.settings = {
          ...currentSettings,
          ...importedSettings,
          mappings: { ...(currentSettings.mappings || {}), ...(importedSettings.mappings || {}) },
          admin: currentSettings.admin || { pinHash: "", configuredAt: "" },
        };
        ensureSettings();
        ensureState();
        state.collaboration.receivedAt = new Date().toISOString();
        adminUnlocked = false;
        adminLoginOpen = false;
        try { sessionStorage.removeItem(adminSessionKey); } catch (_) { /* Session locale indisponible. */ }
        save(parsed.transfer?.handoff ? `Passation importée · révision ${state.collaboration.revision}` : "Saisie importée");
        refresh({ inputs: true });
      } catch (_) { showToast("Ce fichier n’est pas une exportation compatible de rapport journalier.", "danger"); }
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
