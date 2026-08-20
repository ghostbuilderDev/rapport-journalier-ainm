/* Rapport journalier AINM — prototype PWA terrain, sans dépendance externe. */
(() => {
  "use strict";

  const STORAGE_KEY = "ainm-rj-pwa-v1";
  const snapshotKey = "ainm-rj-pwa-last-snapshot";
  const priceCatalog = Array.isArray(window.RJ_PRICE_CATALOG) ? window.RJ_PRICE_CATALOG : [];
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

  const initialState = () => {
    const date = dateToday();
    const base = date.replaceAll("-", "");
    const sequence = Number(localStorage.getItem("ainm-rj-sequence") || "0") + 1;
    localStorage.setItem("ainm-rj-sequence", String(sequence));
    return {
      schema: 1,
      updatedAt: new Date().toISOString(),
      meta: {
        operation: "RCT AINM — Tronçon Moret–Montargis",
        reportNo: `RJ-${base}-${String(sequence).padStart(2, "0")}`,
        orderNo: "",
        enterprise: "BOUYGUES ENERGIES & SERVICES / TSO SIGNALISATION",
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
      settings: { mappings: {} },
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
  let taskDraft = null;
  let rowDraft = null;

  const getPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
  const setPath = (object, path, value) => {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((value, key) => value[key], object);
    target[last] = value;
  };

  function save(label = "Brouillon local") {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const target = $("#saveState");
    if (target) {
      target.textContent = label;
      window.setTimeout(() => { target.textContent = "Brouillon local"; }, 1200);
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function getShiftContext() {
    const duration = number(state.meta.workDuration);
    const date = state.meta.date ? new Date(`${state.meta.date}T12:00:00`) : null;
    const weekend = Boolean(date && [0, 6].includes(date.getDay()));
    const isWeekend = weekend || Boolean(state.meta.publicHoliday);
    if (isWeekend) return { key: "W", label: "Week-end / jour férié", status: "ok" };
    if (!duration) return { key: null, label: "Durée effective à renseigner", status: "warning" };
    if (state.meta.shiftType === "jour") {
      if (duration > 4) return { key: "J", label: "Jour (> 4 h)", status: "ok" };
      return { key: null, label: "Jour ≤ 4 h : prix à qualifier", status: "warning" };
    }
    if (duration > 2 && duration <= 3) return { key: "N1", label: "Nuit N1 (> 2 h à 3 h)", status: "ok" };
    if (duration > 3 && duration <= 5) return { key: "N2", label: "Nuit N2 (> 3 h à 5 h)", status: "ok" };
    if (duration > 5) return { key: "N3", label: "Nuit N3 (> 5 h)", status: "ok" };
    return { key: null, label: "Nuit ≤ 2 h : prix à qualifier", status: "warning" };
  }

  function candidatesFor(template) {
    const search = template?.priceRoute?.search;
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

  function findPrice(article) {
    return priceCatalog.find((record) => record.article === article) || null;
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
      return { status: "priced", record, quantity, amount: Math.round(quantity * record.contractualUnitPriceHT * 100) / 100 };
    }

    if (route.type === "direct") {
      const record = findPrice(route.article);
      if (!record) return { status: "review", reason: "Prix de bordereau introuvable", quantity };
      return { status: "priced", record, quantity, amount: Math.round(quantity * record.contractualUnitPriceHT * 100) / 100 };
    }

    if (route.type === "mapped") {
      const selectedArticle = state.settings.mappings[template.id];
      const record = selectedArticle ? findPrice(selectedArticle) : null;
      if (!record) {
        const count = candidatesFor(template).length;
        return { status: "review", reason: count ? "Rattachement marché à paramétrer" : "Aucun article trouvé automatiquement", quantity };
      }
      return { status: "priced", record, quantity, amount: Math.round(quantity * record.contractualUnitPriceHT * 100) / 100 };
    }

    return { status: "review", reason: "Prestation à rattacher au bordereau", quantity };
  }

  function renderInputs() {
    $$("[data-path]").forEach((element) => {
      const value = getPath(state, element.dataset.path);
      if (element.type === "checkbox") element.checked = Boolean(value);
      else element.value = value ?? "";
    });
    $("#cancelReasonField").classList.toggle("hidden", !state.meta.cancelled);
  }

  function renderPricingContext() {
    const context = getShiftContext();
    const banner = $("#pricingContext");
    banner.classList.toggle("warning", context.status !== "ok");
    banner.innerHTML = `<strong>Régime de prix identifié :</strong> ${escapeHtml(context.label)}. ${context.key ? "Les prestations de génie civil éligibles seront valorisées avec cette variante." : "Aucune valorisation automatique ne sera appliquée aux articles à plage horaire tant que ce point n’est pas clarifié."}`;
  }

  function renderHeader() {
    const resolved = state.tasks.map(resolveTask);
    const total = resolved.filter((item) => item.status === "priced").reduce((sum, item) => sum + item.amount, 0);
    const toReview = resolved.filter((item) => item.status !== "priced").length;
    $("#taskCount").textContent = state.tasks.length;
    $("#totalEstimate").textContent = total ? euros(total) : "—";
    $("#heroSubtitle").textContent = state.meta.cancelled
      ? "Chantier annulé — éditer la cause et la trace de la séance."
      : `${state.meta.operation || "Opération à renseigner"} · ${toReview ? `${toReview} prestation(s) à qualifier` : "valorisation prête"}`;

    const contextDone = Boolean(state.meta.operation && state.meta.reportNo && state.meta.date && state.meta.workDuration);
    const contextChip = $("#contextStatus");
    contextChip.className = `status-chip ${contextDone ? "success" : "warning"}`;
    contextChip.textContent = contextDone ? "Complet" : "À compléter";
  }

  function renderQuickCatalog() {
    const quick = terrainCatalog.filter((item) => item.id !== "saisie-libre");
    $("#quickCatalog").innerHTML = quick.map((item) => `
      <button class="quick-card" type="button" data-template="${escapeHtml(item.id)}">
        <span class="quick-category">${escapeHtml(item.category)}</span>${escapeHtml(item.label)}
      </button>`).join("");
  }

  function taskStatusMarkup(result) {
    if (result.status === "priced") return `<span class="status-chip success">Valorisé</span>`;
    return `<span class="status-chip warning">À qualifier</span>`;
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
      const pricing = result.status === "priced" ? `${euros(result.amount)} HT estimés` : result.reason;
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

  const rowConfig = {
    personnel: {
      title: "Personnel entreprise",
      fields: [
        ["role", "Fonction / grade", "select", ["Conducteur travaux", "Chef de chantier", "Chef d’équipe", "Monteur signalisation", "Électricien", "Opérateur travaux", "Pelleur", "Conducteur d’engin", "Chef de manœuvre", "Élingueur", "Autre"]],
        ["count", "Nombre", "number", ""],
        ["hours", "Heures par personne", "number", ""],
        ["observation", "Observation", "textarea", "Entreprise, équipe, particularité"],
      ],
      display: (row) => `<h3>${escapeHtml(row.role || "Fonction à préciser")} · ${displayNumber(row.count, 0)} pers.</h3><p>${row.hours ? `${displayNumber(row.hours)} h/pers. · ` : ""}${escapeHtml(row.observation || "Sans observation")}</p>`,
    },
    equipment: {
      title: "Engin entreprise",
      fields: [
        ["name", "Engin / matériel", "text", "Ex. Pelle rail-route"],
        ["count", "Nombre", "number", ""],
        ["observation", "Observation", "textarea", "Usage, immatriculation, incident…"],
      ],
      display: (row) => `<h3>${escapeHtml(row.name || "Engin à préciser")}${row.count ? ` · ${displayNumber(row.count, 0)}` : ""}</h3><p>${escapeHtml(row.observation || "Sans observation")}</p>`,
    },
    possession: {
      title: "Possession / consignation",
      fields: [
        ["voie", "Voie", "text", "Ex. V1"],
        ["plannedStart", "Prévue — début", "time", ""],
        ["plannedEnd", "Prévue — fin", "time", ""],
        ["agreedStart", "Accordée — début", "time", ""],
        ["agreedEnd", "Accordée — fin", "time", ""],
        ["actualStart", "Réelle — début", "time", ""],
        ["actualEnd", "Réelle — fin", "time", ""],
        ["observation", "Observation", "textarea", "ARF, AAN, motif de décalage…"],
      ],
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
      display: (row) => `<h3>${escapeHtml(row.type || "Anomalie")} · ${escapeHtml(row.severity || "À qualifier")}</h3><p>${escapeHtml(row.detail || "Sans détail")}${row.action ? ` · Suite : ${escapeHtml(row.action)}` : ""}</p>`,
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
        <button class="mini-button danger" type="button" data-delete-row="${key}:${row.id}">Supprimer</button>
      </div></article>`).join("") : `<p class="empty-inline">Aucune donnée saisie.</p>`;
  }

  function validation() {
    const checks = [];
    const metaMissing = [state.meta.operation, state.meta.reportNo, state.meta.date].some((value) => !value);
    checks.push({ ok: !metaMissing, message: metaMissing ? "Contexte incomplet : opération, numéro et date sont nécessaires." : "Contexte de séance renseigné." });
    if (state.meta.cancelled) {
      checks.push({ ok: Boolean(state.meta.cancelReason), message: state.meta.cancelReason ? "Motif d’annulation renseigné." : "Ajouter le motif d’annulation." });
    } else {
      checks.push({ ok: state.tasks.length > 0, message: state.tasks.length ? "Au moins une prestation est saisie." : "Ajouter les prestations réellement réalisées." });
      const openTasks = state.tasks.filter((task) => resolveTask(task).status !== "priced");
      checks.push({ ok: openTasks.length === 0, message: openTasks.length ? `${openTasks.length} prestation(s) restent à qualifier pour la valorisation.` : "Toutes les prestations ont un prix de bordereau déterminé." });
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
    renderValuationPreview();
  }

  function renderValuationPreview() {
    const valuations = state.tasks.map((task) => ({ task, template: templateById.get(task.templateId), result: resolveTask(task) }));
    const priced = valuations.filter(({ result }) => result.status === "priced");
    const total = priced.reduce((sum, { result }) => sum + result.amount, 0);
    $("#valuationPreview").innerHTML = valuations.length ? `
      <table class="valuation-table"><thead><tr><th>Prestation</th><th>Réf. PB</th><th class="numeric">Qté</th><th class="numeric">PU HT</th><th class="numeric">Montant HT</th></tr></thead>
      <tbody>${valuations.map(({ task, template, result }) => `
        <tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}${result.status !== "priced" ? `<br><small>${escapeHtml(result.reason)}</small>` : ""}</td>
        <td>${result.record ? escapeHtml(result.record.article) : "À qualifier"}</td>
        <td class="numeric">${displayNumber(result.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}</td>
        <td class="numeric">${result.record ? euros(result.record.contractualUnitPriceHT) : "—"}</td>
        <td class="numeric">${result.status === "priced" ? euros(result.amount) : "—"}</td></tr>`).join("")}
        <tr class="valuation-total"><td colspan="4">Total valorisé indicatif HT</td><td class="numeric">${euros(total)}</td></tr></tbody></table>
      <p class="muted" style="margin-top:9px;font-size:.79rem">Les montants sont une aide au contrôle. La qualification contractuelle finale reste soumise au contrôle MOE / marché.</p>` : `<p class="empty-inline">La valorisation apparaîtra dès la première prestation.</p>`;
  }

  function refresh({ inputs = false } = {}) {
    if (inputs) renderInputs();
    renderPricingContext();
    renderHeader();
    renderQuickCatalog();
    renderTasks();
    ["personnel", "equipment", "possession", "anomaly", "document", "sncfMeans"].forEach(renderDataList);
    renderReview();
    renderPrintReport();
  }

  function openTaskCatalog(editId = null) {
    taskDraft = editId ? clone(state.tasks.find((task) => task.id === editId)) : null;
    $("#taskDialogTitle").textContent = editId ? "Modifier une prestation" : "Ajouter une prestation";
    $("#taskCatalogPane").classList.toggle("hidden", Boolean(taskDraft));
    $("#taskEditorPane").classList.toggle("hidden", !taskDraft);
    if (taskDraft) renderTaskEditor(templateById.get(taskDraft.templateId), taskDraft);
    else renderTaskCatalog();
    $("#taskDialog").showModal();
  }

  function renderTaskCatalog() {
    const groups = terrainCatalog.reduce((acc, template) => {
      (acc[template.category] ||= []).push(template);
      return acc;
    }, {});
    $("#taskCatalogPane").innerHTML = `<div class="catalog-groups">${Object.entries(groups).map(([category, templates]) => `
      <section class="catalog-group"><h3>${escapeHtml(category)}</h3><div class="catalog-options">${templates.map((template) => `
        <button class="catalog-option" data-select-template="${escapeHtml(template.id)}" type="button"><strong>${escapeHtml(template.label)}</strong><span>${escapeHtml(template.hint)}</span></button>`).join("")}</div></section>`).join("")}</div>`;
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
    const note = route === "mapped" ? "Ce libellé est volontairement simple ; l’encadrant choisira une seule fois le bon article dans le paramétrage chantier." : route === "manual" ? "La production sera présente dans le rapport ; le rattachement au prix devra être fait par l’encadrant." : "Le prix de bordereau sera déterminé automatiquement selon le contexte de séance.";
    $("#taskCatalogPane").classList.add("hidden");
    const pane = $("#taskEditorPane");
    pane.classList.remove("hidden");
    pane.innerHTML = `
      <div class="task-editor">
        <div class="task-identity"><strong>${escapeHtml(template.label)}</strong><p>${escapeHtml(template.hint)}</p></div>
        ${isCustom ? `<label class="field"><span>Libellé terrain</span><input id="taskLabel" value="${escapeHtml(task.label === template.reportLabel ? "" : task.label)}" placeholder="Décrire simplement la prestation"></label>` : ""}
        <div class="task-extra-grid">${customFields}
          <label class="field"><span>Voie</span><input id="taskVoie" value="${escapeHtml(task.voie)}" placeholder="Ex. V1"></label>
          <label class="field"><span>PK début</span><input id="taskPkStart" value="${escapeHtml(task.pkStart)}" placeholder="Ex. 80+050"></label>
          <label class="field"><span>PK fin</span><input id="taskPkEnd" value="${escapeHtml(task.pkEnd)}" placeholder="Ex. 80+200"></label>
        </div>
        <label class="field"><span>Observation / précision</span><textarea id="taskNote" rows="3" placeholder="Localisation, type précis, difficulté, matériel…">${escapeHtml(task.note)}</textarea></label>
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
    $("#rowEditorPane").innerHTML = `<div class="task-editor">${config.fields.map(([name, label, type, placeholder]) => {
      const value = rowDraft.row[name] ?? "";
      if (type === "textarea") return `<label class="field"><span>${escapeHtml(label)}</span><textarea id="row_${name}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label>`;
      if (type === "select") return `<label class="field"><span>${escapeHtml(label)}</span><select id="row_${name}"><option value="">À renseigner</option>${placeholder.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
      return `<label class="field"><span>${escapeHtml(label)}</span><input id="row_${name}" type="${type}" ${type === "number" ? "step=0.1 inputmode=decimal" : ""} value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></label>`;
    }).join("")}<div class="dialog-actions"><button id="saveRowButton" type="button" class="primary-button">Enregistrer</button></div></div>`;
    $("#rowDialog").showModal();
  }

  function saveRow() {
    if (!rowDraft) return;
    const config = rowConfig[rowDraft.key];
    config.fields.forEach(([name]) => { rowDraft.row[name] = $(`#row_${name}`).value.trim(); });
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
    const mappedTemplates = terrainCatalog.filter((template) => template.priceRoute?.type === "mapped");
    $("#mappingPane").innerHTML = mappedTemplates.map((template) => {
      const selected = state.settings.mappings[template.id] || "";
      const candidates = candidatesFor(template);
      const select = candidates.length ? `<select id="mapping_${template.id}"><option value="">Choisir la référence marché</option>${candidates.map((record) => `<option value="${escapeHtml(record.article)}" ${record.article === selected ? "selected" : ""}>${escapeHtml(record.article)} — ${escapeHtml(record.description.slice(0, 105))} · ${euros(record.contractualUnitPriceHT)}</option>`).join("")}</select>` : `<span class="muted">Aucun candidat trouvé dans le bordereau : associer ce libellé après analyse marché.</span>`;
      return `<article class="mapping-item"><h3>${escapeHtml(template.label)}</h3><p>${escapeHtml(template.hint)}</p><div class="mapping-actions">${select}${candidates.length ? `<button class="secondary-button" type="button" data-save-mapping="${template.id}">Enregistrer</button>` : ""}</div></article>`;
    }).join("");
  }

  function renderTableRows(rows, builder, columnCount) {
    return rows.length ? rows.map(builder).join("") : `<tr><td colspan="${columnCount}" class="print-empty">Aucune donnée saisie.</td></tr>`;
  }

  function renderPrintReport() {
    const resolved = state.tasks.map((task) => ({ task, template: templateById.get(task.templateId), result: resolveTask(task) }));
    const total = resolved.filter(({ result }) => result.status === "priced").reduce((sum, { result }) => sum + result.amount, 0);
    const reportTitle = state.meta.cancelled ? "RAPPORT JOURNALIER — CHANTIER ANNULÉ" : "RAPPORT JOURNALIER";
    const taskRows = renderTableRows(resolved, ({ task, template, result }) => `
      <tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}${task.note ? `<br><small>${escapeHtml(task.note)}</small>` : ""}</td>
      <td class="numeric">${template?.metric === "openClose" ? `Ouv. ${displayNumber(task.opening)}<br>Ferm. ${displayNumber(task.closing)}` : `${displayNumber(task.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}`}</td>
      <td>${escapeHtml(task.voie || "—")}</td><td>${escapeHtml([task.pkStart, task.pkEnd].filter(Boolean).join(" → ") || "—")}</td>
      <td>${result.status === "priced" ? "Rattachée" : `À qualifier — ${escapeHtml(result.reason)}`}</td></tr>`, 5);
    const personnelRows = renderTableRows(state.personnel, (row) => `<tr><td>${escapeHtml(row.role || "—")}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td class="numeric">${row.hours ? displayNumber(row.hours) : "—"}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 4);
    const equipmentRows = renderTableRows(state.equipment, (row) => `<tr><td>${escapeHtml(row.name || "—")}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 3);
    const possessionRows = renderTableRows(state.possessions, (row) => `<tr><td>${escapeHtml(row.voie || "—")}</td><td>${escapeHtml(`${row.plannedStart || "—"} → ${row.plannedEnd || "—"}`)}</td><td>${escapeHtml(`${row.agreedStart || "—"} → ${row.agreedEnd || "—"}`)}</td><td>${escapeHtml(`${row.actualStart || "—"} → ${row.actualEnd || "—"}`)}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 5);
    const anomalyRows = renderTableRows(state.anomalies, (row) => `<tr><td>${escapeHtml(row.type || "—")}</td><td>${escapeHtml(row.severity || "—")}</td><td>${escapeHtml(row.detail || "—")}</td><td>${escapeHtml(row.action || "—")}</td></tr>`, 4);
    const documentsRows = renderTableRows(state.documents, (row) => `<tr><td>${escapeHtml(row.name || "—")}</td><td>${escapeHtml(row.reference || "—")}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 3);
    const sncfRows = renderTableRows(state.sncfMeans, (row) => `<tr><td>${escapeHtml(row.role || "—")}</td><td class="numeric">${displayNumber(row.count, 0)}</td><td>${escapeHtml(row.observation || "—")}</td></tr>`, 3);
    const valuationRows = renderTableRows(resolved, ({ task, template, result }) => `<tr><td>${escapeHtml(task.label || template?.reportLabel || "Prestation")}</td><td>${result.record ? escapeHtml(result.record.article) : "À qualifier"}</td><td class="numeric">${displayNumber(result.quantity)} ${escapeHtml(task.unit || template?.unit || "u")}</td><td class="numeric">${result.record ? euros(result.record.contractualUnitPriceHT) : "—"}</td><td class="numeric">${result.status === "priced" ? euros(result.amount) : "—"}</td></tr>`, 5);

    $("#printReport").innerHTML = `
      <article class="print-page">
        <header class="print-header"><div><span class="print-brand">SNCF</span><h1 class="print-title">${reportTitle}</h1></div>
          <div class="print-meta">AINM · Travaux signalisation<br>Référentiel rapport journalier<br>Édité le ${formatDate(dateToday())}</div></header>
        <section class="print-section"><h2>Identification</h2><div class="print-info-grid">
          <div><strong>Opération / chantier</strong>${escapeHtml(state.meta.operation || "—")}</div><div><strong>N° rapport</strong>${escapeHtml(state.meta.reportNo || "—")}</div><div><strong>N° commande</strong>${escapeHtml(state.meta.orderNo || "—")}</div>
          <div><strong>Entreprise</strong>${escapeHtml(state.meta.enterprise || "—")}</div><div><strong>Date / nature</strong>${formatDate(state.meta.date)} · ${escapeHtml(state.meta.shiftType || "—")}</div><div><strong>Intervention réelle</strong>${escapeHtml(`${state.meta.shiftStart || "—"} → ${state.meta.shiftEnd || "—"}`)} · ${displayNumber(state.meta.workDuration)} h</div>
          <div><strong>Météo / température</strong>${escapeHtml(state.meta.weather || "—")} · ${escapeHtml(state.meta.temperature || "—")} °C</div><div><strong>Rédacteur</strong>${escapeHtml(state.meta.reporter || "—")}</div><div><strong>Régime de séance</strong>${escapeHtml(getShiftContext().label)}</div>
        </div></section>
        ${state.meta.cancelled ? `<section class="print-section"><h2>Annulation du chantier</h2><div class="print-note">${escapeHtml(state.meta.cancelReason || "Motif non renseigné")}</div></section>` : `
        <section class="print-section"><h2>Travaux exécutés</h2><table class="print-table"><thead><tr><th>Prestation terrain</th><th class="numeric">Quantité</th><th>Voie</th><th>PK</th><th>Statut</th></tr></thead><tbody>${taskRows}</tbody></table></section>
        <section class="print-section"><h2>Main-d’œuvre entreprise</h2><table class="print-table"><thead><tr><th>Fonction / grade</th><th class="numeric">Nb</th><th class="numeric">Heures/pers.</th><th>Observation</th></tr></thead><tbody>${personnelRows}</tbody></table></section>
        <section class="print-section"><h2>Engins entreprise</h2><table class="print-table"><thead><tr><th>Engin / matériel</th><th class="numeric">Nb</th><th>Observation</th></tr></thead><tbody>${equipmentRows}</tbody></table></section>`}
        <section class="print-section"><h2>Périodes d’interception – Consignations</h2><table class="print-table"><thead><tr><th>Voie</th><th>Prévues</th><th>Accordées</th><th>Réelles</th><th>Observations</th></tr></thead><tbody>${possessionRows}</tbody></table></section>
        <section class="print-section"><h2>Anomalies constatées</h2><table class="print-table"><thead><tr><th>Type</th><th>Niveau</th><th>Fait constaté</th><th>Mesure prise / suite</th></tr></thead><tbody>${anomalyRows}</tbody></table></section>
        <section class="print-section"><h2>Rapports fournis par l’entreprise</h2><table class="print-table"><thead><tr><th>Document</th><th>Référence</th><th>Observation</th></tr></thead><tbody>${documentsRows}</tbody></table></section>
        <section class="print-section"><h2>Moyens SNCF entrepreneur</h2><table class="print-table"><thead><tr><th>Fonction</th><th class="numeric">Nb</th><th>Observation</th></tr></thead><tbody>${sncfRows}</tbody></table></section>
        <section class="print-signatures"><div class="signature-box"><strong>Lieu / date</strong>${escapeHtml(formatDate(state.meta.date))}</div><div class="signature-box"><strong>Visa représentant MOETx SNCF</strong>${escapeHtml(state.meta.moeRepresentative || "Nom / prénom à renseigner")}</div><div class="signature-box"><strong>Visa représentant entreprise extérieure</strong>${escapeHtml(state.meta.companyRepresentative || "Nom / prénom à renseigner")}</div></section>
        <p class="print-footer">Rapport opérationnel généré depuis l’application rapport journalier AINM. Les prix de bordereau sont traités dans l’annexe interne ci-après.</p>
      </article>
      <article class="print-page print-internal">
        <header class="print-header"><div><span class="print-brand">SNCF</span><h1 class="print-title">ANNEXE DE VALORISATION INTERNE</h1></div><div class="print-meta">${escapeHtml(state.meta.reportNo || "—")}<br>Montants indicatifs HT</div></header>
        <section class="print-section"><h2>Rapprochement production / bordereau</h2><table class="print-table"><thead><tr><th>Prestation terrain</th><th>Référence PB</th><th class="numeric">Quantité</th><th class="numeric">PU HT</th><th class="numeric">Montant HT</th></tr></thead><tbody>${valuationRows}<tr><td colspan="4"><strong>Total valorisé indicatif HT</strong></td><td class="numeric"><strong>${euros(total)}</strong></td></tr></tbody></table></section>
        <section class="print-section"><h2>Contrôle</h2><div class="print-note">Les lignes « À qualifier » ont bien été saisies dans le rapport terrain, mais nécessitent un rattachement de prix par l’encadrant ou le gestionnaire de marché. Cette annexe ne remplace pas la validation de la situation de travaux.</div></section>
      </article>`;
  }

  function exportState(share = false) {
    const filename = `rapport-journalier-${(state.meta.reportNo || "brouillon").replace(/[^a-zA-Z0-9_-]+/g, "-")}.json`;
    const file = new File([JSON.stringify(state, null, 2)], filename, { type: "application/json" });
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

    $$("[data-scroll-target]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.scrollTarget}`).scrollIntoView({ behavior: "smooth", block: "start" })));
    $("#openTaskCatalog").addEventListener("click", () => openTaskCatalog());
    $("#taskDialog").addEventListener("click", (event) => {
      const select = event.target.closest("[data-select-template]");
      if (select) renderTaskEditor(templateById.get(select.dataset.selectTemplate));
      if (event.target.closest("#backToTaskCatalog")) { taskDraft = null; $("#taskEditorPane").classList.add("hidden"); $("#taskCatalogPane").classList.remove("hidden"); renderTaskCatalog(); }
      if (event.target.closest("#saveTaskButton")) saveTask();
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
      const remove = event.target.closest("[data-delete-row]");
      if (!remove || !confirm("Supprimer cette ligne ?")) return;
      const [key, id] = remove.dataset.deleteRow.split(":");
      state[key] = state[key].filter((row) => row.id !== id);
      save("Ligne supprimée");
      refresh();
    }));

    $("#printButton").addEventListener("click", () => { renderPrintReport(); window.print(); });
    $("#exportButton").addEventListener("click", () => exportState(false));
    $("#shareButton").addEventListener("click", () => exportState(true));
    $("#newReportButton").addEventListener("click", () => {
      if (!confirm("Créer un nouveau rapport ? Le brouillon actuel restera exportable seulement s’il est sauvegardé.")) return;
      const project = { operation: state.meta.operation, orderNo: state.meta.orderNo, enterprise: state.meta.enterprise, reporter: state.meta.reporter, moeRepresentative: state.meta.moeRepresentative, companyRepresentative: state.meta.companyRepresentative };
      state = initialState();
      Object.assign(state.meta, project);
      save("Nouveau rapport créé");
      refresh({ inputs: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("#moreButton").addEventListener("click", () => $("#moreDialog").showModal());
    $("#configurePricesButton").addEventListener("click", () => { $("#moreDialog").close(); renderMappingDialog(); $("#mappingDialog").showModal(); });
    $("#mappingDialog").addEventListener("click", (event) => {
      const button = event.target.closest("[data-save-mapping]");
      if (!button) return;
      const templateId = button.dataset.saveMapping;
      const select = $(`#mapping_${templateId}`);
      if (select.value) state.settings.mappings[templateId] = select.value;
      else delete state.settings.mappings[templateId];
      save("Prix chantier paramétré");
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
        state = parsed;
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
    renderInputs();
    setupEvents();
    refresh();
    registerServiceWorker();
  }

  boot();
})();
