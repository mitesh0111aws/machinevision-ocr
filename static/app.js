// State Management
let currentData = null;
let currentSapFormat = "bapi"; // "bapi" or "odata"
let currentBapiPayload = null;
let currentOdataPayload = null;
let activeImageFilename = "carding.jpg";
let currentViewMode = "desktop"; // "desktop" or "scanner"
let cameraStream = null;

// DOM Elements
const samplesContainer = document.getElementById("samples-container");
const fileInput = document.getElementById("file-input");
const cameraInput = document.getElementById("camera-input");
const templateSelect = document.getElementById("template-select");
const screenImage = document.getElementById("screen-image");
const bboxOverlay = document.getElementById("bbox-overlay");
const scanLaser = document.getElementById("scan-laser");
const detectedTemplateBadge = document.getElementById("detected-template-badge");
const overallConfidence = document.getElementById("overall-confidence");
const formFieldsContainer = document.getElementById("form-fields-container");
const formFieldCount = document.getElementById("form-field-count");
const sapPayloadCode = document.getElementById("sap-payload-code");
const btnSubmitSap = document.getElementById("btn-submit-sap");
const sapResponseCard = document.getElementById("sap-response-card");
const validationWarnings = document.getElementById("validation-warnings");
const warningList = document.getElementById("warning-list");
const hoverTooltip = document.getElementById("hover-tooltip");
const tooltipLabel = document.getElementById("tooltip-label");
const tooltipValue = document.getElementById("tooltip-value");
const tooltipConf = document.getElementById("tooltip-conf");

// View Mode Toggles & Containers
const btnModeDesktop = document.getElementById("btn-mode-desktop");
const btnModeScanner = document.getElementById("btn-mode-scanner");
const btnCameraCapture = document.getElementById("btn-camera-capture");
const btnUploadPhoto = document.getElementById("btn-upload-photo");
const mainLayout = document.getElementById("main-layout");
const appViewportWrapper = document.getElementById("app-viewport-wrapper");
const scannerHardwareBezel = document.getElementById("scanner-hardware-bezel");
const androidBottomNav = document.getElementById("android-bottom-nav");
const scannerTriggerBar = document.getElementById("scanner-trigger-bar");
const splitContainer = document.getElementById("split-container");

// Modals
const btnViewAudit = document.getElementById("btn-view-audit");
const auditModal = document.getElementById("audit-modal");
const btnCloseAudit = document.getElementById("btn-close-audit");
const auditTableBody = document.getElementById("audit-table-body");
const auditCount = document.getElementById("audit-count");
const tableViewCard = document.getElementById("table-view-card");
const matrixTableBody = document.getElementById("matrix-table-body");
const btnDownloadApk = document.getElementById("btn-download-apk");
const apkModal = document.getElementById("apk-modal");
const btnCloseApk = document.getElementById("btn-close-apk");
const cameraModal = document.getElementById("camera-modal");
const cameraStreamVideo = document.getElementById("camera-stream");
const btnScannerTorch = document.getElementById("btn-scanner-torch");

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  loadSamples();
  setupEventListeners();
  loadAuditLogs();
  updateAndroidClock();
  setInterval(updateAndroidClock, 30000);

  // Check URL param ?mode=scanner
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "scanner") {
    setViewMode("scanner");
  } else {
    setViewMode("desktop");
  }
});

// Update Android Clock
function updateAndroidClock() {
  const clockEl = document.getElementById("android-clock");
  if (clockEl) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    clockEl.textContent = `${hours}:${mins}`;
  }
}

// Setup All UI Event Listeners
function setupEventListeners() {
  // File & Camera Upload Handlers
  fileInput.addEventListener("change", handleFileUpload);
  cameraInput.addEventListener("change", handleFileUpload);

  // Camera Capture Button in Scanner View
  btnCameraCapture.addEventListener("click", triggerScannerCameraModal);

  // Template Dropdown Override
  templateSelect.addEventListener("change", () => {
    const selectedTemplate = templateSelect.value === "auto" ? null : templateSelect.value;
    if (activeImageFilename) {
      extractScreenData(activeImageFilename, selectedTemplate);
    }
  });

  // SAP Format Switcher
  document.getElementById("tab-sap-bapi").addEventListener("click", () => {
    currentSapFormat = "bapi";
    document.getElementById("tab-sap-bapi").className = "px-2.5 py-1 rounded-md bg-blue-600 text-white font-medium";
    document.getElementById("tab-sap-odata").className = "px-2.5 py-1 rounded-md text-slate-400 hover:text-white font-medium";
    renderSapPayload();
  });

  document.getElementById("tab-sap-odata").addEventListener("click", () => {
    currentSapFormat = "odata";
    document.getElementById("tab-sap-odata").className = "px-2.5 py-1 rounded-md bg-blue-600 text-white font-medium";
    document.getElementById("tab-sap-bapi").className = "px-2.5 py-1 rounded-md text-slate-400 hover:text-white font-medium";
    renderSapPayload();
  });

  // Re-extract button
  document.getElementById("btn-reextract").addEventListener("click", () => {
    const selectedTemplate = templateSelect.value === "auto" ? null : templateSelect.value;
    extractScreenData(activeImageFilename, selectedTemplate);
  });

  // Copy SAP JSON
  document.getElementById("btn-copy-sap").addEventListener("click", () => {
    const jsonStr = sapPayloadCode.textContent;
    navigator.clipboard.writeText(jsonStr).then(() => {
      const originalText = document.getElementById("btn-copy-sap").innerHTML;
      document.getElementById("btn-copy-sap").innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> Copied!`;
      setTimeout(() => {
        document.getElementById("btn-copy-sap").innerHTML = originalText;
      }, 1500);
    });
  });

  // Submit to SAP
  btnSubmitSap.addEventListener("click", submitConfirmationToSAP);

  // View Mode Toggles: Workstation View vs Scanner View
  btnModeDesktop.addEventListener("click", () => setViewMode("desktop"));
  btnModeScanner.addEventListener("click", () => setViewMode("scanner"));

  // Audit Log Modal
  btnViewAudit.addEventListener("click", () => {
    auditModal.classList.remove("hidden");
    auditModal.classList.add("flex");
    loadAuditLogs();
  });
  btnCloseAudit.addEventListener("click", () => {
    auditModal.classList.add("hidden");
    auditModal.classList.remove("flex");
  });

  // Download APK Modal
  btnDownloadApk.addEventListener("click", () => {
    apkModal.classList.remove("hidden");
    apkModal.classList.add("flex");
  });
  btnCloseApk.addEventListener("click", () => {
    apkModal.classList.add("hidden");
    apkModal.classList.remove("flex");
  });

  // Torch simulation
  let torchOn = false;
  if (btnScannerTorch) {
    btnScannerTorch.addEventListener("click", () => {
      torchOn = !torchOn;
      btnScannerTorch.className = torchOn 
        ? "w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center text-xs shadow-lg shadow-amber-400/50" 
        : "w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs";
    });
  }

  // SAP Header Inputs change listeners
  ["sap-order-id", "sap-operation", "sap-work-center", "sap-plant"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateSapPreview);
  });
}

// Load Machine Samples Catalog (All 8 Stages)
async function loadSamples() {
  try {
    const res = await fetch("/api/samples");
    const data = await res.json();
    const samples = data.samples || [];

    samplesContainer.innerHTML = samples.map((s, idx) => `
      <div onclick="selectSample('${s.filename}', '${s.template_id}')" 
           id="sample-card-${s.template_id}"
           class="sample-card cursor-pointer bg-slate-950 border ${idx === 0 ? 'border-blue-500 shadow-md shadow-blue-500/20' : 'border-slate-800'} hover:border-slate-600 rounded-xl p-2.5 transition flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[9px] uppercase font-bold text-blue-400 tracking-wider truncate">${s.category}</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>
          <h4 class="font-bold text-xs text-white truncate">${s.title}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">${s.subtitle}</p>
        </div>
        <div class="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
          <span class="font-mono text-slate-500 text-[9px]">${s.template_id}</span>
          <span class="text-blue-400 group-hover:translate-x-0.5 transition font-semibold text-[10px]">&rarr;</span>
        </div>
      </div>
    `).join("");

    if (samples.length > 0) {
      selectSample(samples[0].filename, samples[0].template_id);
    }
  } catch (err) {
    console.error("Error loading samples:", err);
  }
}

// Handle Machine Sample Selection
function selectSample(filename, templateId) {
  activeImageFilename = filename;
  document.querySelectorAll(".sample-card").forEach(el => {
    el.classList.remove("border-blue-500", "shadow-md", "shadow-blue-500/20", "border-amber-500", "shadow-amber-500/20");
    el.classList.add("border-slate-800");
  });
  
  const activeCard = document.getElementById(`sample-card-${templateId}`);
  if (activeCard) {
    const highlightColor = currentViewMode === "scanner" ? "border-amber-500 shadow-md shadow-amber-500/20" : "border-blue-500 shadow-md shadow-blue-500/20";
    activeCard.className = `sample-card cursor-pointer bg-slate-950 ${highlightColor} rounded-xl p-2.5 transition flex flex-col justify-between group`;
  }

  if (templateSelect) {
    templateSelect.value = templateId || "auto";
  }

  extractScreenData(filename, templateId);
}

// Extract Screen Data via Backend Vision Engine
async function extractScreenData(filename, templateId = null) {
  scanLaser.classList.remove("hidden");
  detectedTemplateBadge.textContent = "Scanning...";
  overallConfidence.textContent = "...";

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, template_id: templateId })
    });

    const json = await res.json();
    if (json.status === "success") {
      currentData = json.data;
      renderScreenData(currentData);
      updateSapPreview();
    } else {
      alert("Error analyzing screen: " + json.message);
    }
  } catch (err) {
    console.error("Extraction error:", err);
  } finally {
    setTimeout(() => {
      scanLaser.classList.add("hidden");
    }, 600);
  }
}

// Render Extracted Data on UI
function renderScreenData(data) {
  screenImage.src = `${data.image_url}?t=${new Date().getTime()}`;
  detectedTemplateBadge.textContent = data.template_name || data.template_id;
  overallConfidence.textContent = `${Math.round(data.overall_confidence * 100)}% Conf.`;
  formFieldCount.textContent = `${data.fields.length} Fields`;

  // Work Center synchronization
  if (data.default_work_center) {
    document.getElementById("sap-work-center").value = data.default_work_center;
  }
  if (data.default_plant) {
    document.getElementById("sap-plant").value = data.default_plant;
  }

  // Handle Multi-Row Matrix Table (for Speed Frame / Rovematic ADR)
  if (data.is_table && data.table_rows && data.table_rows.length > 0) {
    tableViewCard.classList.remove("hidden");
    renderMatrixTable(data.table_rows);
  } else {
    tableViewCard.classList.add("hidden");
  }

  // Render SVG Bounding Boxes
  renderBoundingBoxes(data.fields);

  // Render Form Fields
  renderFormFields(data.fields);

  // Render Validation Warnings
  if (data.warnings && data.warnings.length > 0) {
    warningList.innerHTML = data.warnings.map(w => `<li>${w}</li>`).join("");
    validationWarnings.classList.remove("hidden");
  } else {
    validationWarnings.classList.add("hidden");
  }
}

// Render Speed Frame Historical Shifts Matrix Table
function renderMatrixTable(rows) {
  matrixTableBody.innerHTML = rows.map(r => `
    <tr class="border-b border-slate-800/70 hover:bg-slate-800/40 transition">
      <td class="py-2 px-2 font-bold text-white">${r.date}</td>
      <td class="py-2 px-2 text-emerald-400">${r.eff}%</td>
      <td class="py-2 px-2 text-slate-300">${r.stop_time}m</td>
      <td class="py-2 px-2 text-amber-300">${r.doffs}</td>
      <td class="py-2 px-2 text-cyan-300 font-bold">${r.kgs}</td>
      <td class="py-2 px-2 text-slate-300">${r.hanks}</td>
      <td class="py-2 px-2 text-right">
        <button onclick="selectTableRow('${r.date}', ${r.eff}, ${r.stop_time}, ${r.doffs}, ${r.kgs}, ${r.hanks})" 
                class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-[10px] font-bold">
          Load Row
        </button>
      </td>
    </tr>
  `).join("");
}

// Load a specific historical shift date from table into active form
function selectTableRow(date, eff, stopTime, doffs, kgs, hanks) {
  if (!currentData) return;

  currentData.fields.forEach(f => {
    if (f.key === "shift_date") f.value = date;
    if (f.key === "machine_efficiency") { f.value = String(eff); f.numeric_value = eff; }
    if (f.key === "stop_time_mins") { f.value = String(stopTime); f.numeric_value = stopTime; }
    if (f.key === "doffs") { f.value = String(doffs); f.numeric_value = doffs; }
    if (f.key === "production_kgs") { f.value = String(kgs); f.numeric_value = kgs; }
    if (f.key === "hanks") { f.value = String(hanks); f.numeric_value = hanks; }
  });

  renderFormFields(currentData.fields);
  updateSapPreview();
}

// Render SVG Bounding Boxes Overlay
function renderBoundingBoxes(fields) {
  bboxOverlay.innerHTML = "";
  fields.forEach(f => {
    const bbox = f.bbox;
    if (!bbox) return;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", bbox.x);
    rect.setAttribute("y", bbox.y);
    rect.setAttribute("width", bbox.w);
    rect.setAttribute("height", bbox.h);
    rect.setAttribute("rx", "6");
    rect.setAttribute("fill", "rgba(59, 130, 246, 0.12)");
    rect.setAttribute("stroke", "#3b82f6");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("class", "transition-all duration-150 cursor-pointer hover:stroke-cyan-300");
    rect.setAttribute("id", `bbox-${f.key}`);

    rect.addEventListener("mouseenter", (e) => {
      highlightBBox(f.key);
      highlightFormField(f.key);
      showTooltip(e, f);
    });

    rect.addEventListener("mouseleave", () => {
      unhighlightBBox(f.key);
      unhighlightFormField(f.key);
      hideTooltip();
    });

    rect.addEventListener("click", () => {
      const inputEl = document.getElementById(`input-${f.key}`);
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    });

    bboxOverlay.appendChild(rect);
  });
}

// Tooltip Helpers
function showTooltip(e, field) {
  tooltipLabel.textContent = field.label;
  tooltipValue.textContent = `${field.value} ${field.unit || ""}`;
  tooltipConf.textContent = `Confidence: ${Math.round(field.confidence * 100)}%`;

  const wrapperRect = document.getElementById("canvas-wrapper").getBoundingClientRect();
  const x = e.clientX - wrapperRect.left + 15;
  const y = e.clientY - wrapperRect.top + 15;

  hoverTooltip.style.left = `${Math.min(x, wrapperRect.width - 150)}px`;
  hoverTooltip.style.top = `${Math.min(y, wrapperRect.height - 70)}px`;
  hoverTooltip.classList.remove("hidden");
}

function hideTooltip() {
  hoverTooltip.classList.add("hidden");
}

// Render Form Fields
function renderFormFields(fields) {
  formFieldsContainer.innerHTML = fields.map(f => {
    const isRequired = f.required ? '<span class="text-red-400">*</span>' : '';
    const confColor = f.confidence > 0.90 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

    return `
      <div id="form-group-${f.key}" 
           class="p-2.5 rounded-xl border border-slate-800 bg-slate-950 transition flex flex-col justify-between hover:border-slate-700">
        <div class="flex items-center justify-between mb-1">
          <label class="text-slate-300 font-medium text-[11px] truncate flex items-center gap-1" title="${f.label}">
            ${f.label} ${isRequired}
          </label>
          <span class="px-1.5 py-0.2 rounded font-mono text-[9px] border ${confColor}">
            ${Math.round(f.confidence * 100)}%
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <input type="text" 
                 id="input-${f.key}" 
                 value="${f.value || ''}" 
                 data-key="${f.key}"
                 onfocus="highlightBBox('${f.key}')" 
                 onblur="unhighlightBBox('${f.key}')"
                 oninput="handleFieldEdit('${f.key}', this.value)"
                 class="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none">
          ${f.unit ? `<span class="text-slate-400 text-[10px] font-mono shrink-0">${f.unit}</span>` : ''}
        </div>
      </div>
    `;
  }).join("");
}

// Handle inline field corrections by operator
function handleFieldEdit(key, newValue) {
  if (!currentData) return;
  const field = currentData.fields.find(f => f.key === key);
  if (field) {
    field.value = newValue;
    if (field.type === "duration") {
      field.decimal_hours = normalizeDuration(newValue);
      field.numeric_value = field.decimal_hours;
    } else if (["number", "integer", "percentage"].includes(field.type)) {
      field.numeric_value = parseFloat(newValue.replace(",", ".")) || 0.0;
    }
    updateSapPreview();
  }
}

function normalizeDuration(val) {
  if (!val) return 0.0;
  const parts = val.replace("hrs", "").trim().split(":");
  if (parts.length === 2) {
    return Math.round((parseFloat(parts[0]) + parseFloat(parts[1]) / 60) * 100) / 100;
  }
  return parseFloat(val) || 0.0;
}

// Bounding Box Highlight Helpers
function highlightBBox(key) {
  const rect = document.getElementById(`bbox-${key}`);
  if (rect) {
    rect.setAttribute("stroke", "#38bdf8");
    rect.setAttribute("stroke-width", "4");
    rect.setAttribute("fill", "rgba(56, 189, 248, 0.35)");
  }
}

function unhighlightBBox(key) {
  const rect = document.getElementById(`bbox-${key}`);
  if (rect) {
    rect.setAttribute("stroke", "#3b82f6");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("fill", "rgba(59, 130, 246, 0.12)");
  }
}

function highlightFormField(key) {
  const group = document.getElementById(`form-group-${key}`);
  if (group) {
    group.classList.add("border-cyan-400", "bg-slate-900");
  }
}

function unhighlightFormField(key) {
  const group = document.getElementById(`form-group-${key}`);
  if (group) {
    group.classList.remove("border-cyan-400", "bg-slate-900");
  }
}

// Update SAP Payload Preview via API
async function updateSapPreview() {
  if (!currentData) return;

  const customParams = {
    order_no: document.getElementById("sap-order-id").value,
    operation_no: document.getElementById("sap-operation").value,
    work_center: document.getElementById("sap-work-center").value,
    plant: document.getElementById("sap-plant").value,
    operator_id: "OPR-8420"
  };

  try {
    const res = await fetch("/api/sap/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extracted_data: currentData, custom_params: customParams })
    });
    const json = await res.json();
    if (json.status === "success") {
      currentBapiPayload = json.bapi_payload;
      currentOdataPayload = json.odata_payload;
      renderSapPayload();
    }
  } catch (err) {
    console.error("Failed to update SAP preview:", err);
  }
}

// Render active SAP payload (BAPI or OData)
function renderSapPayload() {
  const payload = currentSapFormat === "bapi" ? currentBapiPayload : currentOdataPayload;
  sapPayloadCode.textContent = JSON.stringify(payload, null, 2);
}

// Submit Confirmation to SAP
async function submitConfirmationToSAP() {
  if (!currentData) return;

  btnSubmitSap.disabled = true;
  btnSubmitSap.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Communicating with SAP RFC Gateway...`;

  const customParams = {
    order_no: document.getElementById("sap-order-id").value,
    operation_no: document.getElementById("sap-operation").value,
    work_center: document.getElementById("sap-work-center").value,
    plant: document.getElementById("sap-plant").value
  };

  try {
    const res = await fetch("/api/sap/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extracted_data: currentData, custom_params: customParams })
    });
    const json = await res.json();
    if (json.status === "success") {
      const sapRes = json.sap_response;
      document.getElementById("res-conf-no").textContent = `CONF #${sapRes.CONFIRMATION_NUMBER}`;
      document.getElementById("res-message").textContent = sapRes.RETURN[0].MESSAGE;
      document.getElementById("res-yield").textContent = sapRes.POSTED_YIELD;
      document.getElementById("res-work").textContent = sapRes.ACTUAL_MACHINE_HOURS;
      sapResponseCard.classList.remove("hidden");
      loadAuditLogs();
      
      // Feedback: scroll to confirmation
      sapResponseCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } catch (err) {
    alert("SAP submission error: " + err.message);
  } finally {
    btnSubmitSap.disabled = false;
    btnSubmitSap.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Confirm &amp; Push to SAP System`;
  }
}

// Load Audit Logs from SQLite
async function loadAuditLogs() {
  try {
    const res = await fetch("/api/audit-log");
    const json = await res.json();
    const logs = json.audit_logs || [];
    auditCount.textContent = logs.length;

    auditTableBody.innerHTML = logs.map(l => `
      <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
        <td class="py-2.5 px-3 text-slate-400">${new Date(l.created_at).toLocaleTimeString()}</td>
        <td class="py-2.5 px-3 font-semibold text-emerald-400">${l.sap_conf_no}</td>
        <td class="py-2.5 px-3 text-white">${l.work_center} <span class="text-slate-500 text-[10px]">(${l.plant})</span></td>
        <td class="py-2.5 px-3 text-cyan-300">${l.yield_qty} ${l.yield_unit}</td>
        <td class="py-2.5 px-3 text-white">${l.run_time_hours} hrs</td>
        <td class="py-2.5 px-3 text-slate-400">${l.operator_id}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
            ${l.status}
          </span>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Failed to load audit logs:", err);
  }
}

// ================================================================
// VIEW MODE TOGGLING: WORKSTATION VIEW VS SCANNER VIEW
// ================================================================
function setViewMode(mode) {
  currentViewMode = mode;

  if (mode === "scanner") {
    // 1. Header Button Styles
    btnModeScanner.className = "px-3 py-1.5 rounded-lg font-bold transition bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-1.5";
    btnModeDesktop.className = "px-3 py-1.5 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center gap-1.5";

    // 2. Wrap into Android Rugged Device Frame
    appViewportWrapper.className = "android-scanner-frame";
    scannerHardwareBezel.classList.remove("hidden");
    androidBottomNav.classList.remove("hidden");
    scannerTriggerBar.classList.remove("hidden");
    
    // 3. Compact mobile layout inside phone frame
    mainLayout.className = "w-full p-3.5 space-y-4";
    splitContainer.className = "flex flex-col gap-4";
    samplesContainer.className = "grid grid-cols-2 gap-2";

    // 4. ACTION BUTTON VISIBILITY FOR SCANNER VIEW:
    // Both Camera Photo Capture AND Upload Photo are visible in Scanner View!
    btnCameraCapture.classList.remove("hidden");
    btnUploadPhoto.classList.remove("hidden");
    document.getElementById("selector-subtext").textContent = "Zebra Rugged Scanner &bull; Tap Camera or Upload to extract screen";

  } else {
    // WORKSTATION VIEW (Desktop)
    // 1. Header Button Styles
    btnModeDesktop.className = "px-3 py-1.5 rounded-lg font-bold transition bg-blue-600 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5";
    btnModeScanner.className = "px-3 py-1.5 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center gap-1.5";

    // 2. Remove mobile frame
    appViewportWrapper.className = "";
    scannerHardwareBezel.classList.add("hidden");
    androidBottomNav.classList.add("hidden");
    scannerTriggerBar.classList.add("hidden");

    // 3. Wide Workstation layout
    mainLayout.className = "max-w-7xl mx-auto p-4 sm:p-6 transition-all duration-300";
    splitContainer.className = "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start";
    samplesContainer.className = "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2";

    // 4. ACTION BUTTON VISIBILITY FOR WORKSTATION VIEW:
    // In Workstation View: ONLY Upload Photo is visible (Camera Capture is hidden)
    btnCameraCapture.classList.add("hidden");
    btnUploadPhoto.classList.remove("hidden");
    document.getElementById("selector-subtext").textContent = "Select one of the 8 production stages or upload a screen photo";
  }

  // Update active card highlight if selected
  if (currentData) {
    const card = document.getElementById(`sample-card-${currentData.template_id}`);
    if (card) {
      document.querySelectorAll(".sample-card").forEach(el => {
        el.classList.remove("border-blue-500", "shadow-blue-500/20", "border-amber-500", "shadow-amber-500/20");
        el.classList.add("border-slate-800");
      });
      const highlight = mode === "scanner" ? "border-amber-500 shadow-md shadow-amber-500/20" : "border-blue-500 shadow-md shadow-blue-500/20";
      card.className = `sample-card cursor-pointer bg-slate-950 ${highlight} rounded-xl p-2.5 transition flex flex-col justify-between group`;
    }
  }
}

// ================================================================
// CAMERA CAPTURE LOGIC (WebRTC Viewfinder + Native Camera Intent)
// ================================================================
async function triggerScannerCameraModal() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      cameraStreamVideo.srcObject = cameraStream;
      cameraModal.classList.remove("hidden");
      cameraModal.classList.add("flex");
      return;
    } catch (err) {
      console.warn("WebRTC camera not available or denied, falling back to native file input:", err);
    }
  }
  // Fallback to native Android camera intent
  cameraInput.click();
}

function closeScannerCameraModal() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraModal.classList.add("hidden");
  cameraModal.classList.remove("flex");
}

function snapCameraPhoto() {
  if (!cameraStreamVideo.videoWidth) return;

  const canvas = document.createElement("canvas");
  canvas.width = cameraStreamVideo.videoWidth;
  canvas.height = cameraStreamVideo.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraStreamVideo, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    closeScannerCameraModal();
    if (!blob) return;

    const formData = new FormData();
    const filename = `snap_${Date.now()}.jpg`;
    formData.append("file", blob, filename);
    const selectedTemplate = templateSelect.value === "auto" ? "" : templateSelect.value;
    if (selectedTemplate) {
      formData.append("template_id", selectedTemplate);
    }

    try {
      scanLaser.classList.remove("hidden");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.status === "success") {
        activeImageFilename = data.filename;
        extractScreenData(data.filename, data.template_hint || selectedTemplate);
      }
    } catch (err) {
      alert("Error uploading snapped photo: " + err.message);
    } finally {
      scanLaser.classList.add("hidden");
    }
  }, "image/jpeg", 0.95);
}

// Universal File Upload Handler
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  const selectedTemplate = templateSelect.value === "auto" ? "" : templateSelect.value;
  if (selectedTemplate) {
    formData.append("template_id", selectedTemplate);
  }

  scanLaser.classList.remove("hidden");
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.status === "success") {
      activeImageFilename = data.filename;
      extractScreenData(data.filename, data.template_hint || selectedTemplate);
    } else {
      alert("Upload failed: " + data.error);
    }
  } catch (err) {
    alert("Upload failed: " + err.message);
  } finally {
    e.target.value = "";
    scanLaser.classList.add("hidden");
  }
}
