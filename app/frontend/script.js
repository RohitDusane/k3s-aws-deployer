document.addEventListener("DOMContentLoaded", () => {

/* =====================================================
   PERSISTED SETTINGS
   Stored in localStorage so they survive a page reload.
   This works because index.html/script.js/style.css are
   served as real static files by the FastAPI app (StaticFiles
   mount) — a normal browser tab, not a sandboxed preview.
===================================================== */

const SETTINGS_KEY = "riskguard.settings.v1";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error("Failed to read settings:", error);
        return {};
    }
}

function saveSettingsToStorage(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const savedSettings = loadSettings();

let API_BASE_URL =
    savedSettings.apiBaseUrl || DEFAULT_API_BASE_URL;

let currentEnvironment =
    savedSettings.environment || "development";

const form = document.querySelector("form");

const transactionIdInput =
    document.getElementById("transaction_id");

const userIdInput =
    document.getElementById("user_id");

const amountInput =
    document.getElementById("amount");

const transactionTypeInput =
    document.getElementById("transaction_type");

const merchantCategoryInput =
    document.getElementById("merchant_category");

const countryInput =
    document.getElementById("country");

const hourInput =
    document.getElementById("hour");

const deviceRiskInput =
    document.querySelectorAll(".range-input")[0];

const ipRiskInput =
    document.querySelectorAll(".range-input")[1];

/* =====================================================
   SIDEBAR NAVIGATION
===================================================== */

const navItems =
    document.querySelectorAll(".nav-item");

const pageSections =
    document.querySelectorAll(".page-section");


function showPage(pageId) {

    /* Hide every page */

    pageSections.forEach((page) => {

        page.style.display = "none";

    });


    /* Remove active state */

    navItems.forEach((item) => {

        item.classList.remove("active");

    });


    /* Show selected page */

    const selectedPage =
        document.getElementById(pageId);

    if (selectedPage) {

        selectedPage.style.display = "";

    }


    /* Activate selected navigation item */

    const selectedNav =
        document.querySelector(
            `.nav-item[data-page="${pageId}"]`
        );

    if (selectedNav) {

        selectedNav.classList.add("active");

    }


    /* Update browser URL */

    if (window.location.hash !== `#${pageId}`) {

        history.replaceState(
            null,
            "",
            `#${pageId}`
        );

    }

}


/* Handle sidebar clicks */

navItems.forEach((item) => {

    item.addEventListener("click", (event) => {

        event.preventDefault();

        const pageId =
            item.dataset.page;

        showPage(pageId);

    });

});


/* Handle page if user refreshes */

const initialPage =
    window.location.hash
        ? window.location.hash.substring(1)
        : "risk-prediction";


if (
    document.getElementById(initialPage)
) {

    showPage(initialPage);

} else {

    showPage("risk-prediction");

}


/* =====================================================
   RESULT ELEMENTS
===================================================== */

const riskStatus =
    document.querySelector(".risk-status");

const riskStatusIcon =
    document.querySelector(".risk-status-icon");

const riskStatusLabel =
    document.querySelector(".risk-status span");

const riskStatusTitle =
    document.querySelector(".risk-status h3");

const probabilityValue =
    document.querySelector(".probability-heading strong");

const probabilityFill =
    document.querySelector(".probability-fill");

const riskLevel =
    document.querySelector(".risk-level strong");

/* =====================================================
   RESULT DETAILS
===================================================== */

const resultDetails =
    document.querySelectorAll(".result-details > div");

/* =====================================================
   SYSTEM STATUS
===================================================== */

const apiStatus =
    document.querySelector(".live-indicator");

const modelStatus =
    document.querySelector(".model-status");

const healthRows =
    document.querySelectorAll(".health-row");

/* =====================================================
   RISK SLIDER VALUES
===================================================== */

const riskValueElements =
    document.querySelectorAll(".risk-input-heading strong");

function updateRiskSliderValue(slider, output) {

    if (!slider || !output) {
        return;
    }

    output.textContent =
        Number(slider.value).toFixed(2);

}

if (deviceRiskInput) {

    deviceRiskInput.addEventListener("input", () => {

        updateRiskSliderValue(
            deviceRiskInput,
            riskValueElements[0]
        );

    });

}

if (ipRiskInput) {

    ipRiskInput.addEventListener("input", () => {

        updateRiskSliderValue(
            ipRiskInput,
            riskValueElements[1]
        );

    });

}

/* =====================================================
   BUILD REQUEST PAYLOAD
===================================================== */

function getPayload() {

    return {

        transaction_id:
            transactionIdInput.value.trim(),

        user_id:
            userIdInput.value.trim(),

        amount:
            Number(amountInput.value),

        transaction_type:
            transactionTypeInput.value,

        merchant_category:
            merchantCategoryInput.value,

        country:
            countryInput.value,

        hour:
            Number(hourInput.value),

        device_risk_score:
            Number(deviceRiskInput.value),

        ip_risk_score:
            Number(ipRiskInput.value)

    };

}

/* =====================================================
   BUTTON LOADING STATE
===================================================== */

function setLoading(isLoading) {

    const submitButton =
        form.querySelector(".primary-button");

    if (!submitButton) {
        return;
    }

    if (isLoading) {

        submitButton.disabled = true;

        submitButton.dataset.originalText =
            submitButton.innerHTML;

        submitButton.innerHTML = `
            <span class="loading-spinner"></span>
            Analyzing...
        `;

    } else {

        submitButton.disabled = false;

        submitButton.innerHTML =
            submitButton.dataset.originalText ||
            "Analyze Transaction <span>→</span>";

    }

}

/* =====================================================
   DISPLAY ERROR
===================================================== */

function showError(message) {

    riskStatus.classList.remove(
        "safe",
        "fraud"
    );

    riskStatus.classList.add("fraud");

    riskStatusIcon.textContent = "!";

    riskStatusLabel.textContent =
        "REQUEST ERROR";

    riskStatusTitle.textContent =
        message;

    probabilityValue.textContent =
        "--";

    probabilityFill.style.width = "0%";

    probabilityFill.classList.add("danger");

    riskLevel.textContent =
        "Unavailable";

}

/* =====================================================
   DISPLAY PREDICTION
===================================================== */

function displayPrediction(result) {

    const probability =
        Number(result.fraud_probability);

    const isFraud =
        Number(result.is_fraud) === 1;

    const percentage =
        probability * 100;

    /*
     * Update probability
     */

    probabilityValue.textContent =
        `${percentage.toFixed(1)}%`;

    probabilityFill.style.width =
        `${Math.min(Math.max(percentage, 0), 100)}%`;

    /*
     * Update transaction status
     */

    riskStatus.classList.remove(
        "safe",
        "fraud"
    );

    probabilityFill.classList.remove(
        "danger"
    );

    if (isFraud) {

        riskStatus.classList.add("fraud");

        riskStatusIcon.textContent = "!";

        riskStatusLabel.textContent =
            "TRANSACTION STATUS";

        riskStatusTitle.textContent =
            "Potential Fraud Detected";

        probabilityFill.classList.add(
            "danger"
        );

        riskLevel.textContent =
            "High Risk";

    } else {

        riskStatus.classList.add("safe");

        riskStatusIcon.textContent = "✓";

        riskStatusLabel.textContent =
            "TRANSACTION STATUS";

        riskStatusTitle.textContent =
            "Low Fraud Risk";

        riskLevel.textContent =
            percentage >= 30
                ? "Moderate Risk"
                : "Low Risk";

    }

    /*
     * Update result details
     */

    if (resultDetails.length >= 4) {

        resultDetails[0]
            .querySelector("strong")
            .textContent =
            `Class ${result.is_fraud}`;

        resultDetails[1]
            .querySelector("strong")
            .textContent =
            result.model_name;

        resultDetails[2]
            .querySelector("strong")
            .textContent =
            result.model_version;

        resultDetails[3]
            .querySelector("strong")
            .textContent =
            transactionIdInput.value.trim();

    }

}

/* =====================================================
   PREDICT
===================================================== */

async function predictTransaction(payload) {

    const response =
        await fetch(
            `${API_BASE_URL}/predict`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body:
                    JSON.stringify(payload)
            }
        );

    /*
     * FastAPI validation error
     */

    if (response.status === 422) {

        const errorData =
            await response.json();

        console.error(
            "Validation error:",
            errorData
        );

        throw new Error(
            "Invalid transaction data. Please check the form."
        );

    }

    /*
     * Model unavailable
     */

    if (response.status === 503) {

        throw new Error(
            "ML model is currently unavailable."
        );

    }

    /*
     * Server error
     */

    if (!response.ok) {

        const errorText =
            await response.text();

        console.error(
            "API error:",
            errorText
        );

        throw new Error(
            "Prediction request failed."
        );

    }

    return await response.json();

}

/* =====================================================
   FORM SUBMIT
===================================================== */

// form.addEventListener(
//     "submit",
//     async (event) => {

//         event.preventDefault();

//         /*
//          * Browser validation
//          */

//         if (!form.checkValidity()) {

//             form.reportValidity();

//             return;

//         }

//         const payload =
//             getPayload();

//         console.log(
//             "Prediction request:",
//             payload
//         );

//         setLoading(true);

//         try {

//             const result =
//                 await predictTransaction(
//                     payload
//                 );

//             console.log(
//                 "Prediction response:",
//                 result
//             );

//             displayPrediction(
//                 result
//             );

//         } catch (error) {

//             console.error(
//                 "Prediction failed:",
//                 error
//             );

//             showError(
//                 error.message
//             );

//         } finally {

//             setLoading(false);

//         }

//     }
// );

if (form) {

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!form.checkValidity()) {

                form.reportValidity();

                return;

            }

            const payload =
                getPayload();

            console.log(
                "Prediction request:",
                payload
            );

            setLoading(true);

            try {

                const result =
                    await predictTransaction(payload);

                console.log(
                    "Prediction response:",
                    result
                );

                displayPrediction(result);

                addTransactionRecord(payload, result);

            } catch (error) {

                console.error(
                    "Prediction failed:",
                    error
                );

                showError(error.message);

            } finally {

                setLoading(false);

            }

        }
    );

}


/* =====================================================
   HEALTH CHECK
===================================================== */

async function checkHealth() {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/health`
            );

        if (!response.ok) {
            throw new Error(
                "Health endpoint unavailable"
            );
        }

        const data =
            await response.json();

        console.log(
            "Health:",
            data
        );

        setApiOnline(true);

    } catch (error) {

        console.error(
            "Health check failed:",
            error
        );

        setApiOnline(false);

    }

}

/* =====================================================
   READY CHECK
===================================================== */

async function checkReady() {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/ready`
            );

        if (!response.ok) {
            throw new Error(
                "Ready endpoint unavailable"
            );
        }

        const data =
            await response.json();

        console.log(
            "Ready:",
            data
        );

        setModelReady(true);

    } catch (error) {

        console.error(
            "Ready check failed:",
            error
        );

        setModelReady(false);

    }

}

/* =====================================================
   API STATUS UI
===================================================== */

function setApiOnline(isOnline) {

    if (!apiStatus) {
        return;
    }

    const dot =
        apiStatus.querySelector(
            ".status-dot"
        );

    if (isOnline) {

        if (dot) {

            dot.classList.remove(
                "red"
            );

            dot.classList.add(
                "green"
            );

        }

        apiStatus.innerHTML = `
            <span class="status-dot green"></span>
            API Connected
        `;

    } else {

        apiStatus.innerHTML = `
            <span class="status-dot red"></span>
            API Offline
        `;

    }

}

/* =====================================================
   MODEL STATUS UI
===================================================== */

function setModelReady(isReady) {

    if (!modelStatus) {
        return;
    }

    if (isReady) {

        modelStatus.innerHTML = `
            <span class="status-dot green"></span>
            Model Ready
        `;

    } else {

        modelStatus.innerHTML = `
            <span class="status-dot red"></span>
            Model Unavailable
        `;

    }

}

/* =====================================================
   HEALTH ROWS
===================================================== */

function updateHealthRows(
    apiOnline,
    modelReady
) {

    if (healthRows.length < 3) {
        return;
    }

    /*
     * API Service
     */

    updateHealthRow(
        healthRows[0],
        apiOnline,
        "API Service",
        apiOnline
            ? "Operational"
            : "Offline"
    );

    /*
     * ML Model
     */

    updateHealthRow(
        healthRows[1],
        modelReady,
        "ML Model",
        modelReady
            ? "Loaded"
            : "Unavailable"
    );

    /*
     * Prediction endpoint
     */

    updateHealthRow(
        healthRows[2],
        apiOnline && modelReady,
        "Endpoint",
        apiOnline && modelReady
            ? "POST /predict"
            : "Unavailable"
    );

}

function updateHealthRow(
    row,
    online,
    label,
    status
) {

    const dot =
        row.querySelector(
            ".status-dot"
        );

    const statusText =
        row.querySelector(
            "strong"
        );

    if (dot) {

        dot.classList.remove(
            "green",
            "red"
        );

        dot.classList.add(
            online
                ? "green"
                : "red"
        );

    }

    if (statusText) {

        statusText.textContent =
            status;

        statusText.classList.remove(
            "online",
            "offline"
        );

        statusText.classList.add(
            online
                ? "online"
                : "offline"
        );

    }

}

/* =====================================================
   FULL SYSTEM CHECK
===================================================== */

async function checkSystemStatus() {

    let apiOnline = false;
    let modelReady = false;

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/health`
            );

        apiOnline =
            response.ok;

    } catch (error) {

        apiOnline = false;

    }

    if (apiOnline) {

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/ready`
                );

            modelReady =
                response.ok;

        } catch (error) {

            modelReady = false;

        }

    }

    setApiOnline(
        apiOnline
    );

    setModelReady(
        modelReady
    );

    updateHealthRows(
        apiOnline,
        modelReady
    );

}

/* =====================================================
   REFRESH BUTTON
===================================================== */

const refreshButton =
    document.querySelector(
        ".refresh-button"
    );

if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            refreshButton.disabled =
                true;

            refreshButton.style.transform =
                "rotate(360deg)";

            await checkSystemStatus();

            setTimeout(() => {

                refreshButton.disabled =
                    false;

                refreshButton.style.transform =
                    "";

            }, 400);

        }
    );

}

/* =====================================================
   TOAST NOTIFICATIONS
===================================================== */

let toastRoot = document.querySelector(".toast-root");

if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";
    document.body.appendChild(toastRoot);
}

function showToast(message, type = "success") {

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastRoot.appendChild(toast);

    // Force reflow so the enter transition actually plays.
    void toast.offsetWidth;
    toast.classList.add("toast-visible");

    setTimeout(() => {
        toast.classList.remove("toast-visible");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 3200);

}

/* =====================================================
   TRANSACTION HISTORY (localStorage)
   Every completed prediction is appended here, which is
   what powers the Transactions and Model Monitor pages.
===================================================== */

const HISTORY_KEY = "riskguard.transactions.v1";
const PAGE_SIZE = 8;

let transactionsPage = 1;
let transactionsSearch = "";
let transactionsRiskFilter = "all";
let transactionsSortKey = "timestamp";
let transactionsSortDir = "desc";

function loadTransactionHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error("Failed to read transaction history:", error);
        return [];
    }
}

function saveTransactionHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function riskBandFor(probability, isFraud) {
    if (isFraud) return "fraud";
    if (probability >= 0.30) return "moderate";
    return "safe";
}

function addTransactionRecord(payload, result) {

    const probability = Number(result.fraud_probability);
    const isFraud = Number(result.is_fraud) === 1;

    const record = {
        transactionId: payload.transaction_id,
        userId: payload.user_id,
        amount: payload.amount,
        transactionType: payload.transaction_type,
        merchantCategory: payload.merchant_category,
        country: payload.country,
        hour: payload.hour,
        deviceRiskScore: payload.device_risk_score,
        ipRiskScore: payload.ip_risk_score,
        probability,
        isFraud,
        modelName: result.model_name,
        modelVersion: result.model_version,
        timestamp: new Date().toISOString(),
    };

    const history = loadTransactionHistory();
    history.unshift(record);
    saveTransactionHistory(history);

    transactionsPage = 1;
    renderTransactionsPage();
    renderModelMonitorPage();

}

function clearTransactionHistory() {

    const confirmed = window.confirm(
        "Clear all stored transaction history? This can't be undone."
    );

    if (!confirmed) return;

    localStorage.removeItem(HISTORY_KEY);
    transactionsPage = 1;
    renderTransactionsPage();
    renderModelMonitorPage();
    showToast("Transaction history cleared", "success");

}

/* =====================================================
   TRANSACTIONS PAGE — filtering, sorting, pagination
===================================================== */

const transactionSearchInput = document.getElementById("transaction-search");
const transactionRiskFilter = document.getElementById("transaction-risk-filter");
const transactionsBody = document.getElementById("transactions-body");
const transactionsEmptyState = document.getElementById("transactions-empty-state");
const transactionsTableWrapper = document.querySelector(".transaction-table-wrapper");
const downloadCsvButton = document.getElementById("download-csv");
const clearHistoryButton = document.getElementById("clear-history");
const paginationControls = document.getElementById("transactions-pagination");
const sortableHeaders = document.querySelectorAll("[data-sort-key]");

function getFilteredSortedHistory() {

    const history = loadTransactionHistory();
    const term = transactionsSearch.trim().toLowerCase();

    let filtered = history.filter((record) => {

        const matchesSearch =
            !term ||
            record.transactionId.toLowerCase().includes(term) ||
            record.userId.toLowerCase().includes(term);

        const band = riskBandFor(record.probability, record.isFraud);

        const matchesRisk =
            transactionsRiskFilter === "all" ||
            transactionsRiskFilter === band;

        return matchesSearch && matchesRisk;

    });

    filtered.sort((a, b) => {

        let valA = a[transactionsSortKey];
        let valB = b[transactionsSortKey];

        if (transactionsSortKey === "timestamp") {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }

        if (valA < valB) return transactionsSortDir === "asc" ? -1 : 1;
        if (valA > valB) return transactionsSortDir === "asc" ? 1 : -1;
        return 0;

    });

    return filtered;

}

function formatCurrency(amount) {
    return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function riskBadgeMarkup(band) {
    const labels = { safe: "Low Risk", moderate: "Moderate Risk", fraud: "High Risk" };
    return `<span class="table-status ${band === "fraud" ? "fraud" : band === "moderate" ? "moderate" : "safe"}">${labels[band]}</span>`;
}

function renderTransactionsPage() {

    if (!transactionsBody) return;

    const filtered = getFilteredSortedHistory();
    const totalRecords = loadTransactionHistory().length;

    renderTransactionStats(filtered, totalRecords);

    if (totalRecords === 0) {

        if (transactionsTableWrapper) transactionsTableWrapper.style.display = "none";
        if (transactionsEmptyState) {
            transactionsEmptyState.style.display = "";
            transactionsEmptyState.classList.remove("no-results");
        }
        if (paginationControls) paginationControls.innerHTML = "";
        return;

    }

    if (filtered.length === 0) {

        if (transactionsTableWrapper) transactionsTableWrapper.style.display = "none";
        if (transactionsEmptyState) {
            transactionsEmptyState.style.display = "";
            transactionsEmptyState.classList.add("no-results");
        }
        if (paginationControls) paginationControls.innerHTML = "";
        return;

    }

    if (transactionsTableWrapper) transactionsTableWrapper.style.display = "";
    if (transactionsEmptyState) transactionsEmptyState.style.display = "none";

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    transactionsPage = Math.min(transactionsPage, totalPages);

    const start = (transactionsPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    transactionsBody.innerHTML = pageRows.map((record) => {

        const band = riskBandFor(record.probability, record.isFraud);

        return `
            <tr>
                <td>${record.transactionId}</td>
                <td>${record.userId}</td>
                <td>${formatCurrency(record.amount)}</td>
                <td>${record.transactionType}</td>
                <td>${(record.probability * 100).toFixed(1)}%</td>
                <td>${riskBadgeMarkup(band)}</td>
                <td class="table-timestamp">${formatTimestamp(record.timestamp)}</td>
            </tr>
        `;

    }).join("");

    renderPaginationControls(totalPages);
    updateSortIndicators();

}

function renderTransactionStats(filtered, totalRecords) {

    const statTotal = document.getElementById("stat-total");
    const statFraud = document.getElementById("stat-fraud");
    const statAvgAmount = document.getElementById("stat-avg-amount");
    const statAvgRisk = document.getElementById("stat-avg-risk");

    if (!statTotal) return;

    const all = loadTransactionHistory();

    if (all.length === 0) {
        statTotal.textContent = "0";
        statFraud.textContent = "0";
        statAvgAmount.textContent = "—";
        statAvgRisk.textContent = "—";
        return;
    }

    const fraudCount = all.filter((r) => r.isFraud).length;
    const avgAmount = all.reduce((sum, r) => sum + Number(r.amount), 0) / all.length;
    const avgRisk = all.reduce((sum, r) => sum + Number(r.probability), 0) / all.length;

    statTotal.textContent = all.length.toLocaleString();
    statFraud.textContent = fraudCount.toLocaleString();
    statAvgAmount.textContent = formatCurrency(avgAmount);
    statAvgRisk.textContent = `${(avgRisk * 100).toFixed(1)}%`;

}

function renderPaginationControls(totalPages) {

    if (!paginationControls) return;

    if (totalPages <= 1) {
        paginationControls.innerHTML = "";
        return;
    }

    let buttons = `
        <button type="button" class="page-button" data-page="prev" ${transactionsPage === 1 ? "disabled" : ""}>‹</button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        buttons += `<button type="button" class="page-button ${i === transactionsPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    }

    buttons += `
        <button type="button" class="page-button" data-page="next" ${transactionsPage === totalPages ? "disabled" : ""}>›</button>
    `;

    paginationControls.innerHTML = buttons;

    paginationControls.querySelectorAll("[data-page]").forEach((btn) => {

        btn.addEventListener("click", () => {

            const target = btn.dataset.page;

            if (target === "prev") transactionsPage = Math.max(1, transactionsPage - 1);
            else if (target === "next") transactionsPage = Math.min(totalPages, transactionsPage + 1);
            else transactionsPage = Number(target);

            renderTransactionsPage();

        });

    });

}

function updateSortIndicators() {

    sortableHeaders.forEach((header) => {

        header.classList.remove("sort-asc", "sort-desc");

        if (header.dataset.sortKey === transactionsSortKey) {
            header.classList.add(transactionsSortDir === "asc" ? "sort-asc" : "sort-desc");
        }

    });

}

if (transactionSearchInput) {

    transactionSearchInput.addEventListener("input", (event) => {
        transactionsSearch = event.target.value;
        transactionsPage = 1;
        renderTransactionsPage();
    });

}

if (transactionRiskFilter) {

    transactionRiskFilter.addEventListener("change", (event) => {
        transactionsRiskFilter = event.target.value;
        transactionsPage = 1;
        renderTransactionsPage();
    });

}

sortableHeaders.forEach((header) => {

    header.addEventListener("click", () => {

        const key = header.dataset.sortKey;

        if (transactionsSortKey === key) {
            transactionsSortDir = transactionsSortDir === "asc" ? "desc" : "asc";
        } else {
            transactionsSortKey = key;
            transactionsSortDir = "desc";
        }

        renderTransactionsPage();

    });

});

if (downloadCsvButton) {

    downloadCsvButton.addEventListener("click", () => {

        const records = getFilteredSortedHistory();

        if (records.length === 0) {
            showToast("No transactions to download yet", "error");
            return;
        }

        const headers = [
            "transaction_id", "user_id", "amount", "transaction_type",
            "merchant_category", "country", "hour", "device_risk_score",
            "ip_risk_score", "fraud_probability", "is_fraud", "model_name",
            "model_version", "timestamp",
        ];

        const rows = records.map((r) => [
            r.transactionId, r.userId, r.amount, r.transactionType,
            r.merchantCategory, r.country, r.hour, r.deviceRiskScore,
            r.ipRiskScore, r.probability, r.isFraud ? 1 : 0, r.modelName,
            r.modelVersion, r.timestamp,
        ]);

        const csv = [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        link.href = url;
        link.download = `riskguard-transactions-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        showToast(`Downloaded ${records.length} transaction${records.length === 1 ? "" : "s"}`, "success");

    });

}

if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", clearTransactionHistory);
}

/* =====================================================
   MODEL MONITOR PAGE — live serving stats + mini sparkline
   The Accuracy/Precision/Recall/F1 card elsewhere on this
   page reflects the last OFFLINE evaluation run, not these
   numbers — the two are intentionally kept visually distinct
   so nobody mistakes live volume for evaluated quality.
===================================================== */

function renderModelMonitorPage() {

    const history = loadTransactionHistory();

    const liveTotal = document.getElementById("live-total-predictions");
    const liveFraudRate = document.getElementById("live-fraud-rate");
    const liveAvgProbability = document.getElementById("live-avg-probability");
    const liveLastPrediction = document.getElementById("live-last-prediction");
    const sparkline = document.getElementById("probability-sparkline");

    if (!liveTotal) return;

    if (history.length === 0) {
        liveTotal.textContent = "0";
        liveFraudRate.textContent = "—";
        liveAvgProbability.textContent = "—";
        liveLastPrediction.textContent = "No predictions yet";
        if (sparkline) sparkline.innerHTML = `<span class="sparkline-empty">Run a prediction to see recent activity</span>`;
        return;
    }

    const fraudCount = history.filter((r) => r.isFraud).length;
    const avgProbability = history.reduce((sum, r) => sum + r.probability, 0) / history.length;

    liveTotal.textContent = history.length.toLocaleString();
    liveFraudRate.textContent = `${((fraudCount / history.length) * 100).toFixed(1)}%`;
    liveAvgProbability.textContent = `${(avgProbability * 100).toFixed(1)}%`;
    liveLastPrediction.textContent = formatTimestamp(history[0].timestamp);

    if (sparkline) {

        const recent = history.slice(0, 20).reverse();

        sparkline.innerHTML = recent.map((r) => {
            const heightPct = Math.max(6, r.probability * 100);
            const barClass = r.isFraud ? "fraud" : r.probability >= 0.30 ? "moderate" : "safe";
            return `<span class="sparkline-bar ${barClass}" style="height:${heightPct}%" title="${(r.probability * 100).toFixed(1)}%"></span>`;
        }).join("");

    }

}

/* =====================================================
   SETTINGS PAGE
===================================================== */

const apiUrlSettingInput = document.getElementById("api-url-setting");
const environmentSettingSelect = document.getElementById("environment-setting");
const saveSettingsButton = document.getElementById("save-settings");
const testConnectionButton = document.getElementById("test-connection");
const settingsHistoryCount = document.getElementById("settings-history-count");
const settingsStorageUsage = document.getElementById("settings-storage-usage");
const clearHistorySettingsButton = document.getElementById("clear-history-settings");
const environmentValueDisplay = document.querySelector(".environment-value");

function applyEnvironmentToSidebar(environment) {

    if (!environmentValueDisplay) return;

    const dot = environmentValueDisplay.querySelector(".status-dot");
    const isProduction = environment === "production";

    if (dot) {
        dot.classList.toggle("green", !isProduction);
        dot.classList.toggle("yellow", isProduction);
    }

    environmentValueDisplay.lastChild.textContent =
        isProduction ? " Production" : " Development";

}

function refreshSettingsStorageInfo() {

    if (!settingsHistoryCount) return;

    const history = loadTransactionHistory();
    const raw = localStorage.getItem(HISTORY_KEY) || "";
    const kb = (new Blob([raw]).size / 1024).toFixed(1);

    settingsHistoryCount.textContent = history.length.toLocaleString();
    settingsStorageUsage.textContent = `${kb} KB`;

}

function initSettingsPage() {

    if (apiUrlSettingInput) apiUrlSettingInput.value = API_BASE_URL;
    if (environmentSettingSelect) environmentSettingSelect.value = currentEnvironment;

    applyEnvironmentToSidebar(currentEnvironment);
    refreshSettingsStorageInfo();

    if (saveSettingsButton) {

        saveSettingsButton.addEventListener("click", () => {

            const newUrl = apiUrlSettingInput.value.trim() || DEFAULT_API_BASE_URL;
            const newEnvironment = environmentSettingSelect.value;

            API_BASE_URL = newUrl;
            currentEnvironment = newEnvironment;

            saveSettingsToStorage({ apiBaseUrl: newUrl, environment: newEnvironment });
            applyEnvironmentToSidebar(newEnvironment);

            showToast("Settings saved", "success");

            checkSystemStatus();

        });

    }

    if (testConnectionButton) {

        testConnectionButton.addEventListener("click", async () => {

            testConnectionButton.disabled = true;
            const originalText = testConnectionButton.textContent;
            testConnectionButton.textContent = "Testing...";

            const testUrl = apiUrlSettingInput.value.trim() || DEFAULT_API_BASE_URL;

            try {

                const response = await fetch(`${testUrl}/health`);

                if (response.ok) {
                    showToast("Connection successful", "success");
                } else {
                    showToast(`API responded with status ${response.status}`, "error");
                }

            } catch (error) {
                showToast("Could not reach that API URL", "error");
            } finally {
                testConnectionButton.disabled = false;
                testConnectionButton.textContent = originalText;
            }

        });

    }

    if (clearHistorySettingsButton) {

        clearHistorySettingsButton.addEventListener("click", () => {
            clearTransactionHistory();
            refreshSettingsStorageInfo();
        });

    }

}

/* =====================================================
   INITIALIZATION
===================================================== */

updateRiskSliderValue(
    deviceRiskInput,
    riskValueElements[0]
);

updateRiskSliderValue(
    ipRiskInput,
    riskValueElements[1]
);

renderTransactionsPage();
renderModelMonitorPage();
initSettingsPage();
refreshSettingsStorageInfo();

checkSystemStatus();

/*
 * Check system status every 30 seconds.
 */

setInterval(
    checkSystemStatus,
    30000
);

});