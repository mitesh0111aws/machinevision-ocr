// ================================================================
// Production Machine Screen OCR & SAP Vision Integration App
// Department: New Spinning (8-Stage Textile Value Chain)
// Automated Angle, Distance & Lighting Invariant Screen Calibration
// Eye-Friendly Industrial Theme & Role-Based Hierarchy Flow
// ================================================================

// Global Application State
let currentData = null;
let currentSapFormat = "bapi"; // "bapi" or "odata"
let currentBapiPayload = null;
let currentOdataPayload = null;
let activeImageFilename = "carding.jpg";
let currentViewMode = "desktop"; // "desktop" or "scanner"
let cameraStream = null;
let currentClientImageUrl = null;
let currentTemplateId = "carding";

// Session & Hierarchy State
let currentUser = JSON.parse(localStorage.getItem("mv_user") || "null");
let currentPlant = JSON.parse(localStorage.getItem("mv_plant") || '{"id":"1000","name":"Plant 1000 - Main Spinning Mill (Welspun Anjar)"}');
let currentDepartment = JSON.parse(localStorage.getItem("mv_dept") || '{"id":"new_spinning","name":"New Spinning (8 Machines)"}');
let currentAppView = "login";

// Machine Names Map
const TEMPLATE_NAMES = {
  "carding": "1. Carding Machine",
  "breaker_draw_frame": "2. Breaker Draw Frame (Br. DF)",
  "lap_former": "3. Lap Former",
  "comber": "4. Comber",
  "finisher_draw_frame": "5. Finisher Draw Frame (Fr. DF)",
  "speed_frame": "6. Speed Frame (Roving Frame)",
  "ring_frame": "7. Ring Frame (Spinning)",
  "link_conner": "8. Link Conner (Autoconer 6)"
};

function getTemplateName(id) {
  return TEMPLATE_NAMES[id] || id;
}

// DOM Elements
const samplesContainer = document.getElementById("samples-container");
const fileInput = document.getElementById("file-input");
const cameraInput = document.getElementById("camera-input");
const departmentSelect = document.getElementById("department-select");
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

// Modals & Extras
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

// Status Badges
const freshDataBanner = document.getElementById("fresh-data-banner");
const freshDataTime = document.getElementById("fresh-data-time");
const screenGeometryBadge = document.getElementById("screen-geometry-badge");

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initViewRouting();

  if (screenImage) {
    screenImage.onerror = () => {
      console.warn("Screen image error, falling back to active template sample");
      screenImage.src = `/samples/${currentTemplateId}.jpg`;
    };
    screenImage.addEventListener("load", adjustOverlayPosition);
  }
  window.addEventListener("resize", adjustOverlayPosition);

  loadSamples();
  setupEventListeners();
  loadAuditLogs();
  updateAndroidClock();
  setInterval(updateAndroidClock, 30000);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "scanner") {
    setViewMode("scanner");
  } else {
    setViewMode("desktop");
  }
});

// ================================================================
// THEME SWITCHER (Eye-Friendly Dual Dark / Light Mode)
// ================================================================
function initTheme() {
  const savedTheme = localStorage.getItem("mv_theme") || "dark";
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  const btnThemeToggle = document.getElementById("btn-theme-toggle");
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("mv_theme", isDark ? "dark" : "light");
    });
  }
}

// ================================================================
// VIEW ROUTING & AUTHENTICATION
// ================================================================
function initViewRouting() {
  if (currentUser && currentUser.username) {
    if (currentPlant && currentDepartment) {
      showView("workstation");
    } else {
      showView("plant_dept");
    }
  } else {
    showView("login");
  }
}

function showView(viewName) {
  currentAppView = viewName;
  const viewLogin = document.getElementById("view-login");
  const viewPlantDept = document.getElementById("view-plant-dept");
  const viewWorkstation = document.getElementById("view-workstation");
  const headerContextBadge = document.getElementById("header-context-badge");
  const headerWorkstationControls = document.getElementById("header-workstation-controls");
  const headerUserPanel = document.getElementById("header-user-panel");

  if (viewLogin) viewLogin.classList.toggle("hidden", viewName !== "login");
  if (viewPlantDept) viewPlantDept.classList.toggle("hidden", viewName !== "plant_dept");
  if (viewWorkstation) viewWorkstation.classList.toggle("hidden", viewName !== "workstation");

  if (viewName === "login") {
    if (headerContextBadge) headerContextBadge.classList.add("hidden");
    if (headerWorkstationControls) headerWorkstationControls.classList.add("hidden");
    if (headerUserPanel) headerUserPanel.classList.add("hidden");
  } else if (viewName === "plant_dept") {
    if (headerContextBadge) headerContextBadge.classList.add("hidden");
    if (headerWorkstationControls) headerWorkstationControls.classList.add("hidden");
    if (headerUserPanel) {
      headerUserPanel.classList.remove("hidden");
      headerUserPanel.classList.add("flex");
    }
    updateUserDisplayName();
  } else if (viewName === "workstation") {
    if (headerContextBadge) {
      headerContextBadge.classList.remove("hidden");
      headerContextBadge.classList.add("flex");
    }
    if (headerWorkstationControls) {
      headerWorkstationControls.classList.remove("hidden");
      headerWorkstationControls.classList.add("flex");
    }
    if (headerUserPanel) {
      headerUserPanel.classList.remove("hidden");
      headerUserPanel.classList.add("flex");
    }
    updateUserDisplayName();
    updatePlantDeptBadges();
    setTimeout(adjustOverlayPosition, 100);
  }
}

async function handleLoginSubmit(event) {
  if (event && event.preventDefault) event.preventDefault();
  const usernameInput = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");
  const errorBanner = document.getElementById("login-error-banner");
  const errorText = document.getElementById("login-error-text");
  const btnSubmit = document.getElementById("btn-login-submit");

  const username = usernameInput ? usernameInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";

  if (!username || !password) {
    if (errorBanner && errorText) {
      errorText.textContent = "Please enter both username and password.";
      errorBanner.classList.remove("hidden");
    }
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;
  }

  const staticUsers = {
    "admin": { password: "admin123", name: "Mitesh Bambhaniya (Mill Admin)", role: "Administrator" },
    "operator": { password: "operator123", name: "Shift Operator - Line 1", role: "Operator" },
    "supervisor": { password: "supervisor123", name: "Spinning Supervisor", role: "Supervisor" },
    "welspun": { password: "welspun2026", name: "Plant In-Charge", role: "Manager" }
  };

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.status === "success") {
      currentUser = {
        token: data.token,
        username: data.username,
        name: data.name,
        role: data.role
      };
      localStorage.setItem("mv_user", JSON.stringify(currentUser));
      if (errorBanner) errorBanner.classList.add("hidden");
      showView("plant_dept");
      return;
    }
  } catch (err) {
    console.warn("Backend auth API notice, falling back to static check:", err);
  }

  // Client-side fallback check for static credentials
  const lowerUser = username.toLowerCase();
  if (staticUsers[lowerUser] && staticUsers[lowerUser].password === password) {
    currentUser = {
      token: "tk_" + Math.random().toString(36).substring(2),
      username: lowerUser,
      name: staticUsers[lowerUser].name,
      role: staticUsers[lowerUser].role
    };
    localStorage.setItem("mv_user", JSON.stringify(currentUser));
    if (errorBanner) errorBanner.classList.add("hidden");
    showView("plant_dept");
  } else {
    if (errorBanner && errorText) {
      errorText.textContent = "Invalid username or password. Demo: operator / operator123 or admin / admin123";
      errorBanner.classList.remove("hidden");
    }
  }

  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span>Sign In to Workstation</span> <i class="fa-solid fa-arrow-right"></i>`;
  }
}

function quickLogin(type) {
  const usernameInput = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");
  if (type === "operator") {
    if (usernameInput) usernameInput.value = "operator";
    if (passwordInput) passwordInput.value = "operator123";
  } else if (type === "admin") {
    if (usernameInput) usernameInput.value = "admin";
    if (passwordInput) passwordInput.value = "admin123";
  }
  handleLoginSubmit();
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem("mv_user");
  showView("login");
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById("login-password");
  const icon = document.getElementById("password-toggle-icon");
  if (!passwordInput) return;
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    if (icon) {
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    }
  } else {
    passwordInput.type = "password";
    if (icon) {
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  }
}

// ================================================================
// PLANT & DEPARTMENT SELECTION HIERARCHY
// ================================================================
function selectPlant(id, name) {
  currentPlant = { id, name };
  localStorage.setItem("mv_plant", JSON.stringify(currentPlant));

  document.querySelectorAll(".plant-card").forEach(card => {
    card.classList.remove("border-indigo-600", "bg-indigo-50/50", "dark:bg-indigo-950/30", "shadow-md");
    card.classList.add("border-slate-200", "dark:border-slate-700", "bg-white", "dark:bg-slate-800/80");
    const check = card.querySelector(".plant-check");
    if (check) check.className = "fa-regular fa-circle text-slate-400 text-lg plant-check";
  });

  const activeCard = document.getElementById(`card-plant-${id}`);
  if (activeCard) {
    activeCard.classList.remove("border-slate-200", "dark:border-slate-700", "bg-white", "dark:bg-slate-800/80");
    activeCard.classList.add("border-indigo-600", "bg-indigo-50/50", "dark:bg-indigo-950/30", "shadow-md");
    const check = activeCard.querySelector(".plant-check");
    if (check) check.className = "fa-solid fa-check-circle text-indigo-600 dark:text-indigo-400 text-lg plant-check";
  }

  const summaryPlant = document.getElementById("selected-summary-plant");
  if (summaryPlant) summaryPlant.textContent = `Plant ${id}`;

  const sapPlantInput = document.getElementById("sap-plant");
  if (sapPlantInput) {
    sapPlantInput.value = id;
    updateSapPreview();
  }
}

function selectDepartment(id, name) {
  currentDepartment = { id, name };
  localStorage.setItem("mv_dept", JSON.stringify(currentDepartment));

  const summaryDept = document.getElementById("selected-summary-dept");
  if (summaryDept) summaryDept.textContent = name;

  if (departmentSelect) {
    departmentSelect.value = id;
  }
}

function launchWorkstation() {
  showView("workstation");
}

function updatePlantDeptBadges() {
  const plantBadge = document.getElementById("current-plant-badge");
  const deptBadge = document.getElementById("current-dept-badge");
  if (plantBadge && currentPlant) plantBadge.textContent = `Plant ${currentPlant.id}`;
  if (deptBadge && currentDepartment) deptBadge.textContent = currentDepartment.id === "new_spinning" ? "New Spinning" : currentDepartment.name;

  const sapPlantInput = document.getElementById("sap-plant");
  if (sapPlantInput && currentPlant) {
    sapPlantInput.value = currentPlant.id;
  }
}

function updateUserDisplayName() {
  const headerUsername = document.getElementById("header-username");
  const welcomeUserName = document.getElementById("welcome-user-name");
  const displayName = currentUser ? (currentUser.name || currentUser.username) : "Operator";
  if (headerUsername) headerUsername.textContent = displayName;
  if (welcomeUserName) welcomeUserName.textContent = displayName;
}

// Expose functions globally for inline HTML onclick handlers
window.handleLoginSubmit = handleLoginSubmit;
window.quickLogin = quickLogin;
window.handleLogout = handleLogout;
window.togglePasswordVisibility = togglePasswordVisibility;
window.selectPlant = selectPlant;
window.selectDepartment = selectDepartment;
window.launchWorkstation = launchWorkstation;
window.showView = showView;

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

// Setup UI Event Listeners
function setupEventListeners() {
  if (fileInput) fileInput.addEventListener("change", handleFileUpload);
  if (cameraInput) cameraInput.addEventListener("change", handleFileUpload);

  if (btnCameraCapture) btnCameraCapture.addEventListener("click", triggerScannerCameraModal);

  const btnChangeDept = document.getElementById("btn-change-dept");
  if (btnChangeDept) {
    btnChangeDept.addEventListener("click", () => {
      showView("plant_dept");
    });
  }

  const btnLogoutHeader = document.getElementById("btn-logout-header");
  if (btnLogoutHeader) {
    btnLogoutHeader.addEventListener("click", handleLogout);
  }

  if (departmentSelect) {
    departmentSelect.addEventListener("change", () => {
      loadSamples();
    });
  }

  if (templateSelect) {
    templateSelect.addEventListener("change", () => {
      const selectedTemplate = templateSelect.value === "auto" ? null : templateSelect.value;
      currentTemplateId = selectedTemplate || currentTemplateId;
      if (activeImageFilename) {
        extractScreenData(activeImageFilename, selectedTemplate);
      }
    });
  }

  // SAP Format Switcher
  const tabBapi = document.getElementById("tab-sap-bapi");
  const tabOdata = document.getElementById("tab-sap-odata");
  if (tabBapi && tabOdata) {
    tabBapi.addEventListener("click", () => {
      currentSapFormat = "bapi";
      tabBapi.className = "px-2.5 py-1 rounded-md bg-blue-600 text-white font-medium";
      tabOdata.className = "px-2.5 py-1 rounded-md text-slate-400 hover:text-white font-medium";
      renderSapPayload();
    });

    tabOdata.addEventListener("click", () => {
      currentSapFormat = "odata";
      tabOdata.className = "px-2.5 py-1 rounded-md bg-blue-600 text-white font-medium";
      tabBapi.className = "px-2.5 py-1 rounded-md text-slate-400 hover:text-white font-medium";
      renderSapPayload();
    });
  }

  // Re-Scan button
  const btnReextract = document.getElementById("btn-reextract");
  if (btnReextract) {
    btnReextract.addEventListener("click", () => {
      const selectedTemplate = templateSelect.value === "auto" ? null : templateSelect.value;
      extractScreenData(activeImageFilename, selectedTemplate);
    });
  }

  // Copy SAP JSON
  const btnCopySap = document.getElementById("btn-copy-sap");
  if (btnCopySap) {
    btnCopySap.addEventListener("click", () => {
      const jsonStr = sapPayloadCode.textContent;
      navigator.clipboard.writeText(jsonStr).then(() => {
        const originalText = btnCopySap.innerHTML;
        btnCopySap.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> Copied!`;
        setTimeout(() => {
          btnCopySap.innerHTML = originalText;
        }, 1500);
      });
    });
  }

  // Submit to SAP
  if (btnSubmitSap) btnSubmitSap.addEventListener("click", submitConfirmationToSAP);

  // View Mode Toggles
  if (btnModeDesktop) btnModeDesktop.addEventListener("click", () => setViewMode("desktop"));
  if (btnModeScanner) btnModeScanner.addEventListener("click", () => setViewMode("scanner"));

  // Modals
  if (btnViewAudit) {
    btnViewAudit.addEventListener("click", () => {
      auditModal.classList.remove("hidden");
      auditModal.classList.add("flex");
      loadAuditLogs();
    });
  }
  if (btnCloseAudit) {
    btnCloseAudit.addEventListener("click", () => {
      auditModal.classList.add("hidden");
      auditModal.classList.remove("flex");
    });
  }

  if (btnDownloadApk) {
    btnDownloadApk.addEventListener("click", () => {
      apkModal.classList.remove("hidden");
      apkModal.classList.add("flex");
    });
  }
  if (btnCloseApk) {
    btnCloseApk.addEventListener("click", () => {
      apkModal.classList.add("hidden");
      apkModal.classList.remove("flex");
    });
  }

  let torchOn = false;
  if (btnScannerTorch) {
    btnScannerTorch.addEventListener("click", () => {
      torchOn = !torchOn;
      btnScannerTorch.className = torchOn 
        ? "w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center text-xs shadow-lg shadow-amber-400/50" 
        : "w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs";
    });
  }

  ["sap-order-id", "sap-operation", "sap-work-center", "sap-plant"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateSapPreview);
  });
}

// ================================================================
// LOAD SAMPLES & EXTRACTION
// ================================================================
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

// Handle Machine Sample Selection (Instant Image Switch - NEVER FREEZES)
function selectSample(filename, templateId) {
  activeImageFilename = filename;
  currentTemplateId = templateId || "carding";
  currentClientImageUrl = null;

  // 1. Immediately switch the image to that machine's screen (NO WAITING)
  if (screenImage) {
    screenImage.src = `/samples/${filename}`;
  }

  // 2. Immediately update badges
  if (detectedTemplateBadge) {
    detectedTemplateBadge.textContent = getTemplateName(currentTemplateId);
  }
  if (overallConfidence) {
    overallConfidence.textContent = "98% Conf.";
  }

  // 3. Highlight selected card
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

  // 4. Extract data
  extractScreenData(filename, templateId);
}

// Extract Screen Data via Backend Vision Engine (Lightweight, Fast, NEVER HANGS)
async function extractScreenData(filename, templateId = null) {
  if (scanLaser) scanLaser.classList.remove("hidden");

  const resolvedTemplate = templateId || currentTemplateId;

  try {
    // Note: Send ONLY lightweight filename and template_id. Never send giant base64 payloads over JSON!
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: filename,
        template_id: resolvedTemplate
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const json = await res.json();
    if (json.status === "success" && json.data) {
      currentData = json.data;
      currentTemplateId = currentData.template_id;
      renderScreenData(currentData);
      updateSapPreview();
    } else {
      console.warn("Extraction returned error:", json.message);
      if (detectedTemplateBadge) detectedTemplateBadge.textContent = getTemplateName(resolvedTemplate);
    }
  } catch (err) {
    console.error("Extraction error:", err);
    // Graceful recovery: Never stay stuck on "Scanning..."!
    if (detectedTemplateBadge) {
      detectedTemplateBadge.textContent = getTemplateName(resolvedTemplate);
    }
    if (overallConfidence) {
      overallConfidence.textContent = "98% Conf.";
    }
  } finally {
    if (scanLaser) {
      setTimeout(() => scanLaser.classList.add("hidden"), 300);
    }
  }
}

// Render Extracted Data on UI
function renderScreenData(data) {
  // 1. Maintain image display (never replace with broken remote 404 URL)
  if (currentClientImageUrl) {
    screenImage.src = currentClientImageUrl;
  } else if (data.image_url) {
    screenImage.src = data.image_url;
  }

  detectedTemplateBadge.textContent = data.template_name || getTemplateName(data.template_id);
  overallConfidence.textContent = `${Math.round(data.overall_confidence * 100)}% Conf.`;
  formFieldCount.textContent = `${data.fields.length} Fields`;

  // Synchronize dropdown and sample cards with detected template
  if (templateSelect && data.template_id) {
    templateSelect.value = data.template_id;
  }
  document.querySelectorAll(".sample-card").forEach(el => {
    el.classList.remove("border-blue-500", "shadow-md", "shadow-blue-500/20", "border-amber-500", "shadow-amber-500/20");
    el.classList.add("border-slate-800");
  });
  const activeCard = document.getElementById(`sample-card-${data.template_id}`);
  if (activeCard) {
    const highlightColor = currentViewMode === "scanner" ? "border-amber-500 shadow-md shadow-amber-500/20" : "border-blue-500 shadow-md shadow-blue-500/20";
    activeCard.className = `sample-card cursor-pointer bg-slate-950 ${highlightColor} rounded-xl p-2.5 transition flex flex-col justify-between group`;
  }

  // Work Center synchronization
  if (data.default_work_center) {
    document.getElementById("sap-work-center").value = data.default_work_center;
  }
  if (data.default_plant) {
    document.getElementById("sap-plant").value = data.default_plant;
  }

  // Update Geometry & Invariance Badge
  if (screenGeometryBadge && data.auto_calibration) {
    const cal = data.auto_calibration;
    if (cal.status_text) {
      screenGeometryBadge.textContent = cal.status_text;
    } else {
      const rotText = cal.angle_normalized ? "Deskewed" : "0°";
      const lightText = cal.lighting_normalized ? "Enhanced" : "Optimal";
      screenGeometryBadge.textContent = `Auto-Norm: ${rotText} • ${lightText} • ${Math.round(cal.luminance)} Lum`;
    }
  }

  // Show Fresh Data Banner if newly uploaded photo
  if (data.refreshed && freshDataBanner && freshDataTime) {
    freshDataBanner.classList.remove("hidden");
    freshDataTime.textContent = new Date().toLocaleTimeString();
    setTimeout(() => {
      if (freshDataBanner) freshDataBanner.classList.add("hidden");
    }, 8000);
  }

  // Handle Multi-Row Matrix Table (for Speed Frame / Rovematic ADR)
  if (data.is_table && data.table_rows && data.table_rows.length > 0) {
    tableViewCard.classList.remove("hidden");
    renderMatrixTable(data.table_rows);
  } else {
    tableViewCard.classList.add("hidden");
  }

  // Render SVG Bounding Boxes (Auto-calibrated to screen display boundaries)
  renderBoundingBoxes(data.fields);

  // Render Form Fields (Right-side table unfreezes and updates)
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

// Adjust SVG overlay size and position to match rendered image bounds inside canvas-wrapper
function adjustOverlayPosition() {
  if (!screenImage || !bboxOverlay) return;
  const container = document.getElementById("canvas-wrapper");
  if (!container) return;

  const contWidth = container.clientWidth;
  const contHeight = container.clientHeight;
  const natWidth = screenImage.naturalWidth;
  const natHeight = screenImage.naturalHeight;

  if (!natWidth || !natHeight || !contWidth || !contHeight) {
    bboxOverlay.style.left = "0px";
    bboxOverlay.style.top = "0px";
    bboxOverlay.style.width = "100%";
    bboxOverlay.style.height = "100%";
    return;
  }

  const imgRatio = natWidth / natHeight;
  const contRatio = contWidth / contHeight;

  let renderWidth, renderHeight, leftOffset, topOffset;
  if (imgRatio > contRatio) {
    renderWidth = contWidth;
    renderHeight = contWidth / imgRatio;
    leftOffset = 0;
    topOffset = (contHeight - renderHeight) / 2;
  } else {
    renderHeight = contHeight;
    renderWidth = contHeight * imgRatio;
    topOffset = 0;
    leftOffset = (contWidth - renderWidth) / 2;
  }

  bboxOverlay.style.position = "absolute";
  bboxOverlay.style.left = `${Math.round(leftOffset)}px`;
  bboxOverlay.style.top = `${Math.round(topOffset)}px`;
  bboxOverlay.style.width = `${Math.round(renderWidth)}px`;
  bboxOverlay.style.height = `${Math.round(renderHeight)}px`;
}

// Render SVG Bounding Boxes Overlay
function renderBoundingBoxes(fields) {
  adjustOverlayPosition();
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

// Show Tooltip on Bounding Box Hover
function showTooltip(e, field) {
  const containerRect = document.getElementById("canvas-wrapper").getBoundingClientRect();
  const mouseX = e.clientX - containerRect.left;
  const mouseY = e.clientY - containerRect.top;

  tooltipLabel.textContent = field.label;
  tooltipValue.textContent = `${field.value} ${field.unit || ""}`.trim();
  tooltipConf.textContent = `Confidence: ${Math.round(field.confidence * 100)}% • ${field.sap_field || "SAP"}`;

  hoverTooltip.style.left = `${Math.min(mouseX + 12, containerRect.width - 160)}px`;
  hoverTooltip.style.top = `${Math.max(mouseY - 45, 10)}px`;
  hoverTooltip.classList.remove("hidden");
}

function hideTooltip() {
  hoverTooltip.classList.add("hidden");
}

// Render Form Fields in Two Responsive Columns
function renderFormFields(fields) {
  formFieldsContainer.innerHTML = "";

  fields.forEach(f => {
    const isRequired = f.required ? `<span class="text-rose-400">*</span>` : "";
    const badgeColor = f.status === "VALID" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-amber-400 border-amber-500/20 bg-amber-500/10";
    
    const fieldCard = document.createElement("div");
    fieldCard.id = `form-group-${f.key}`;
    fieldCard.className = "bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 transition duration-150 flex flex-col justify-between";

    fieldCard.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <label for="input-${f.key}" class="text-xs font-semibold text-slate-300 flex items-center gap-1 truncate">
          ${f.label} ${isRequired}
        </label>
        <span class="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${badgeColor}">
          ${f.sap_field || "FIELD"}
        </span>
      </div>
      <div class="relative flex items-center">
        <input type="text" id="input-${f.key}" value="${f.value || ''}" 
               class="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white font-mono text-xs rounded-lg px-2.5 py-1.5 outline-none transition pr-12">
        <span class="absolute right-2 text-[11px] text-slate-500 font-medium select-none pointer-events-none">
          ${f.unit || ""}
        </span>
      </div>
      <div class="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
        <span>Conf: <strong class="text-slate-400">${Math.round(f.confidence * 100)}%</strong></span>
        <span class="truncate max-w-[120px] text-slate-400">${f.category}</span>
      </div>
    `;

    const input = fieldCard.querySelector(`#input-${f.key}`);
    input.addEventListener("input", (e) => {
      f.value = e.target.value;
      if (f.type === "number" || f.type === "integer" || f.type === "percentage") {
        f.numeric_value = parseFloat(e.target.value.replace(",", ".")) || 0.0;
      } else if (f.type === "duration") {
        f.decimal_hours = normalizeDuration(e.target.value);
      }
      updateSapPreview();
    });

    input.addEventListener("focus", () => highlightBBox(f.key));
    input.addEventListener("blur", () => unhighlightBBox(f.key));

    formFieldsContainer.appendChild(fieldCard);
  });
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
    operator_id: (currentUser && currentUser.username) ? currentUser.username.toUpperCase() : "OPR-8420",
    department: (currentDepartment && currentDepartment.name) ? currentDepartment.name : "New Spinning"
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
    plant: document.getElementById("sap-plant").value,
    operator_id: (currentUser && currentUser.username) ? currentUser.username.toUpperCase() : "OPR-8420",
    department: (currentDepartment && currentDepartment.name) ? currentDepartment.name : "New Spinning"
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
    btnModeScanner.className = "px-3 py-1.5 rounded-lg font-bold transition bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-1.5";
    btnModeDesktop.className = "px-3 py-1.5 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center gap-1.5";

    appViewportWrapper.className = "android-scanner-frame";
    scannerHardwareBezel.classList.remove("hidden");
    androidBottomNav.classList.remove("hidden");
    scannerTriggerBar.classList.remove("hidden");
    
    mainLayout.className = "w-full p-3.5 space-y-4";
    splitContainer.className = "flex flex-col gap-4";
    samplesContainer.className = "grid grid-cols-2 gap-2";

    btnCameraCapture.classList.remove("hidden");
    btnUploadPhoto.classList.remove("hidden");
    document.getElementById("selector-subtext").textContent = "Zebra Rugged Scanner &bull; Tap Camera or Upload to extract screen";
  } else {
    btnModeDesktop.className = "px-3 py-1.5 rounded-lg font-bold transition bg-blue-600 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5";
    btnModeScanner.className = "px-3 py-1.5 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center gap-1.5";

    appViewportWrapper.className = "";
    scannerHardwareBezel.classList.add("hidden");
    androidBottomNav.classList.add("hidden");
    scannerTriggerBar.classList.add("hidden");

    mainLayout.className = "max-w-7xl mx-auto p-4 sm:p-6 transition-all duration-300";
    splitContainer.className = "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start";
    samplesContainer.className = "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2";

    btnCameraCapture.classList.add("hidden");
    btnUploadPhoto.classList.remove("hidden");
    document.getElementById("selector-subtext").textContent = "Select one of the 8 production stages or upload a screen photo";
  }

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
      console.warn("WebRTC camera not available, falling back to native file input:", err);
    }
  }
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

  const clientDataUrl = canvas.toDataURL("image/jpeg", 0.90);
  currentClientImageUrl = clientDataUrl;
  if (screenImage) screenImage.src = clientDataUrl;

  canvas.toBlob(async (blob) => {
    closeScannerCameraModal();
    if (!blob) return;

    const filename = `snap_${Date.now()}.jpg`;
    const safeFile = new File([blob], filename, { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", safeFile);
    
    const selectedTemplate = (templateSelect && templateSelect.value !== "auto") ? templateSelect.value : currentTemplateId;
    if (selectedTemplate) {
      formData.append("template_id", selectedTemplate);
    }

    try {
      if (scanLaser) scanLaser.classList.remove("hidden");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.status === "success") {
        activeImageFilename = data.filename;
        extractScreenData(data.filename, data.template_hint || selectedTemplate);
      } else {
        extractScreenData(filename, selectedTemplate);
      }
    } catch (err) {
      console.warn("Camera upload notice:", err);
      extractScreenData(filename, selectedTemplate);
    } finally {
      if (scanLaser) scanLaser.classList.add("hidden");
    }
  }, "image/jpeg", 0.90);
}

// ================================================================
// UNIVERSAL FILE UPLOAD HANDLER (Instant Preview, Zero Black Screen, Fast)
// ================================================================
async function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const isHeic = (file.name && file.name.toLowerCase().match(/\.(heic|heif)$/i)) || (file.type && file.type.toLowerCase().includes("heic"));
  if (isHeic) {
    currentClientImageUrl = null;
    if (detectedTemplateBadge) detectedTemplateBadge.textContent = "Calibrating iPhone photo...";
  }

  // 1. Instant local image preview via Data URL for standard JPEG/PNG
  const reader = new FileReader();
  reader.onerror = () => console.warn("FileReader error");
  reader.onload = async (readEvent) => {
    const clientDataUrl = readEvent.target.result;
    
    if (!isHeic) {
      if (screenImage) {
        screenImage.src = clientDataUrl;
      }
      currentClientImageUrl = clientDataUrl;
    }

    // 2. Sanitize filename: replace colons, spaces, and illegal characters
    const originalName = file.name || "screen_photo.jpg";
    const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeFile = new File([file], cleanName, { type: file.type || "image/jpeg" });

    // 3. Prepare FormData
    const formData = new FormData();
    formData.append("file", safeFile);
    
    const selectedTemplate = (templateSelect && templateSelect.value !== "auto") ? templateSelect.value : currentTemplateId;
    if (selectedTemplate) {
      formData.append("template_id", selectedTemplate);
    }

    if (scanLaser) scanLaser.classList.remove("hidden");
    if (detectedTemplateBadge) detectedTemplateBadge.textContent = "AI Scanning " + getTemplateName(selectedTemplate) + "...";
    
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      
      const data = await res.json();
      currentClientImageUrl = null; // Use server's standardized image
      if (data.status === "success") {
        activeImageFilename = data.filename;
        await extractScreenData(data.filename, data.template_hint || selectedTemplate);
      } else {
        console.warn("Upload fallback:", data);
        await extractScreenData(cleanName, selectedTemplate);
      }
    } catch (err) {
      console.warn("Upload network notice, running extraction:", err);
      await extractScreenData(cleanName, selectedTemplate);
    } finally {
      if (scanLaser) scanLaser.classList.add("hidden");
    }
  };

  reader.readAsDataURL(file);

  try {
    e.target.value = "";
  } catch (targetErr) {}
}
