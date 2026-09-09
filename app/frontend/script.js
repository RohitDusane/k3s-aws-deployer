document.addEventListener("DOMContentLoaded", () => {
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

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

checkSystemStatus();

/*
 * Check system status every 30 seconds.
 */

setInterval(
    checkSystemStatus,
    30000
);

});

