const BOARD_SIZE = 16;
const SAMPLE_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1aIPptNOpldYZVHXNp19WS5daip-CJCEvcAAuEv-xQw8/edit?usp=sharing";
const DEFAULT_SHEET_NAME = "Sheet1";
const DEFAULT_CELL_RANGE = "A1:B25";

const state = {
    allTerms: [],
    sourceParams: null,
};

const elements = {
    board: document.getElementById("BingoBoard"),
    inputSheetURL: document.getElementById("inputSheetURL"),
    inputSheetName: document.getElementById("inputSheetName"),
    inputSheetRange: document.getElementById("inputSheetRange"),
    csvFile: document.getElementById("csvFile"),
    directInput: document.getElementById("directInput"),
    termsNotUsedList: document.getElementById("termsNotUsedList"),
    definitionsModal: document.getElementById("definitionsModal"),
    definitionsTable: document.getElementById("definitionsTable"),
    feedbackMessage: document.getElementById("feedbackMessage"),
    shareSection: document.getElementById("shareSection"),
    shareLink: document.getElementById("shareLink"),
    setupPanel: document.getElementById("setupPanel"),
    formToggle: document.getElementById("formToggle"),
    googleConfigHint: document.getElementById("googleConfigHint"),
    showAnswersButton: document.getElementById("showAnswers"),
    showAnswersInShare: document.getElementById("showAnswersInShare"),
    includePanelInShare: document.getElementById("includePanelInShare"),
    layout: document.querySelector(".layout"),
    hero: document.querySelector(".hero"),
    copyShareLink: document.getElementById("copyShareLink"),
    printSection: document.getElementById("printSection"),
    printBoardCount: document.getElementById("printBoardCount"),
    openPrintBoards: document.getElementById("openPrintBoards"),
    openPrintDefinitions: document.getElementById("openPrintDefinitions"),
};

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

document.querySelectorAll(".cell").forEach((cell) => {
    cell.addEventListener("click", () => {
        if (!cell.textContent.trim()) {
            return;
        }
        cell.classList.toggle("backColorYellow");
        checkForWinner();
    });
});

document
    .getElementById("loadGoogleSheet")
    .addEventListener("click", handleGoogleSheetLoad);
document.getElementById("loadCsv").addEventListener("click", handleCsvLoad);
document
    .getElementById("loadDirectInput")
    .addEventListener("click", handleDirectInputLoad);
document.getElementById("showAnswers").addEventListener("click", () => {
    if (!state.allTerms.length) {
        setFeedback("Load a board before opening the answer key.");
        return;
    }
    elements.definitionsModal.showModal();
});
document.getElementById("closeAnswers").addEventListener("click", () => {
    elements.definitionsModal.close();
});
elements.formToggle.addEventListener("click", toggleSetupPanel);
elements.showAnswersInShare.addEventListener("change", updateShareLinks);
elements.includePanelInShare.addEventListener("change", updateShareLinks);
elements.copyShareLink.addEventListener("click", copyShareLink);
elements.openPrintDefinitions.addEventListener("click", openPrintableDefinitions);
elements.openPrintBoards.addEventListener("click", openPrintableBoards);

bootstrap();

async function bootstrap() {
    elements.inputSheetURL.value = SAMPLE_SHEET_URL;

    const params = new URLSearchParams(window.location.search);

    if (params.has("boardOnly")) {
        elements.setupPanel.classList.add("hidden");
        elements.formToggle.classList.add("hidden");
        elements.layout.classList.add("board-only");
        elements.hero.classList.add("board-only");
    }

    elements.showAnswersButton.classList.toggle("hidden", !params.has("showAnswers"));

    await loadConfig();

    if (params.has("data")) {
        try {
            const data = decodeDataParam(params.get("data"));
            loadBoard(data, {
                sourceParams: { data: params.get("data") },
                statusMessage: "Board loaded from the shared link.",
            });
            return;
        } catch (_error) {
            setFeedback("The shared link could not be read.");
        }
    }

    const sheetUrl = params.get("SheetUrl");
    const sheetName = params.get("SheetName");
    const cellRange = params.get("CellRange");

    if (sheetUrl && sheetName && cellRange) {
        elements.inputSheetURL.value = sheetUrl;
        elements.inputSheetName.value = sheetName;
        elements.inputSheetRange.value = cellRange;
        activateTab("google");
        await fetchGoogleSheet(sheetUrl, sheetName, cellRange);
        return;
    }

    await fetchGoogleSheet(
        SAMPLE_SHEET_URL,
        DEFAULT_SHEET_NAME,
        DEFAULT_CELL_RANGE,
        { silent: true }
    );
}

async function loadConfig() {
    try {
        const response = await fetch("/api/config");
        const config = await response.json();
        elements.googleConfigHint.textContent = config.googleSheetsConfigured
            ? ""
            : "Google Sheets loading is currently unavailable until the server is given a Google Sheets API key.";
    } catch (_error) {
        elements.googleConfigHint.textContent =
            "Google Sheets status could not be confirmed.";
    }
}

function activateTab(tabName) {
    document.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === tabName);
    });
}

async function handleGoogleSheetLoad() {
    await fetchGoogleSheet(
        elements.inputSheetURL.value.trim(),
        elements.inputSheetName.value.trim(),
        elements.inputSheetRange.value.trim()
    );
}

async function fetchGoogleSheet(shareUrl, sheetName, cellRange, options = {}) {
    if (!shareUrl || !sheetName || !cellRange) {
        if (!options.silent) {
            setFeedback("Enter a share link, sheet name, and range before loading.");
        }
        return;
    }

    if (!options.silent) {
        setFeedback("Loading data from Google Sheets...");
    }

    try {
        const response = await fetch("/api/google-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shareUrl, sheetName, cellRange }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.result) {
            throw new Error(payload.error || "The Google Sheet could not be loaded.");
        }

        loadBoard(payload.data, {
            sourceParams: {
                SheetUrl: shareUrl,
                SheetName: sheetName,
                CellRange: cellRange,
            },
            statusMessage: options.silent
                ? "Sample board loaded."
                : "Board loaded from Google Sheets.",
        });
    } catch (error) {
        if (!options.silent) {
            setFeedback(error.message);
        }
    }
}

function handleCsvLoad() {
    const file = elements.csvFile.files[0];

    if (!file) {
        setFeedback("Choose a CSV file before loading.");
        return;
    }

    setFeedback("Reading the CSV file...");

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const raw = String(reader.result || "");
            const rows = parseCsv(raw);
            const data = normalizeClientRows(rows);
            loadBoard(data, {
                sourceParams: { data: encodeDataParam(data) },
                statusMessage: "Board loaded from CSV.",
            });
        } catch (error) {
            setFeedback(error.message);
        }
    };
    reader.onerror = () => {
        setFeedback("The CSV file could not be read.");
    };
    reader.readAsText(file);
}

function handleDirectInputLoad() {
    const raw = elements.directInput.value.trim();

    if (!raw) {
        setFeedback("Enter at least 16 terms before loading.");
        return;
    }

    try {
        const data = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const dividerIndex = line.indexOf("|");
                if (dividerIndex < 0) {
                    return {
                        term: line.trim(),
                        definition: "",
                    };
                }
                return {
                    term: line.slice(0, dividerIndex).trim(),
                    definition: line.slice(dividerIndex + 1).trim(),
                };
            })
            .filter((item) => item.term);

        loadBoard(data, {
            sourceParams: { data: encodeDataParam(data) },
            statusMessage: "Board loaded from direct input.",
        });
    } catch (error) {
        setFeedback(error.message);
    }
}

function loadBoard(data, options) {
    if (!Array.isArray(data) || data.length < BOARD_SIZE) {
        setFeedback("At least 16 term-definition pairs are required to build a board.");
        return;
    }

    state.allTerms = data.map((item) => ({
        term: String(item.term).trim(),
        definition: String(item.definition).trim(),
    }));
    state.sourceParams = options.sourceParams;

    const shuffled = shuffle(state.allTerms);
    const boardTerms = shuffled.slice(0, BOARD_SIZE);
    const unused = shuffled.slice(BOARD_SIZE);

    renderBoard(boardTerms);
    renderUnusedTerms(unused);
    renderDefinitionsTable(state.allTerms);
    updateShareLinks();
    setFeedback(options.statusMessage);
}

function renderBoard(boardTerms) {
    clearMarks();
    document.querySelectorAll(".cell").forEach((cell, index) => {
        const item = boardTerms[index];
        cell.classList.remove("cellWinner");
        cell.innerHTML = item
            ? `<div class="cellWrap"><p>${escapeHtml(item.term)}</p></div>`
            : "";
    });
}

function renderUnusedTerms(unused) {
    elements.termsNotUsedList.innerHTML = "";
    unused.forEach((item) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "unusedTerm";
        pill.textContent = item.term;
        pill.addEventListener("click", () => {
            pill.classList.toggle("backColorYellow");
        });
        elements.termsNotUsedList.appendChild(pill);
    });
}

function renderDefinitionsTable(data) {
    const rows = data
        .map(
            (item) =>
                `<tr><td>${escapeHtml(item.term)}</td><td>${escapeHtml(
                    item.definition || "-"
                )}</td></tr>`
        )
        .join("");

    elements.definitionsTable.innerHTML = `
        <thead>
            <tr>
                <th>Term</th>
                <th>Definition</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `;
}

function updateShareLinks() {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams(state.sourceParams || {});
    if (elements.showAnswersInShare.checked) {
        params.set("showAnswers", "true");
    } else {
        params.delete("showAnswers");
    }
    if (elements.includePanelInShare.checked) {
        params.delete("boardOnly");
    } else {
        params.set("boardOnly", "true");
    }

    elements.shareLink.value = `${baseUrl}?${params.toString()}`;
    elements.shareSection.classList.remove("hidden");
    elements.printSection.classList.remove("hidden");
}

function toggleSetupPanel() {
    const hidden = elements.setupPanel.classList.toggle("hidden");
    elements.formToggle.textContent = hidden ? "Show setup panel" : "Hide setup panel";
    elements.formToggle.setAttribute("aria-expanded", String(!hidden));
}

async function copyShareLink() {
    const value = elements.shareLink.value;
    if (!value) {
        setFeedback("Load a board before copying the share link.");
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        setFeedback("Share link copied.");
    } catch (_error) {
        elements.shareLink.select();
        document.execCommand("copy");
        setFeedback("Share link copied.");
    }
}

function openPrintableBoards() {
    if (state.allTerms.length < BOARD_SIZE) {
        setFeedback("Load a board before opening printable boards.");
        return;
    }

    const count = Number(elements.printBoardCount.value);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
        setFeedback("Choose a board count between 1 and 100.");
        return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        setFeedback("The print view was blocked. Please allow pop-ups for this page.");
        return;
    }

    const boardsMarkup = Array.from({ length: count }, () => {
        const shuffledTerms = shuffle(state.allTerms);
        return buildPrintableBoardMarkup(
            shuffledTerms.slice(0, BOARD_SIZE),
            shuffledTerms.slice(BOARD_SIZE)
        );
    }).join("");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Printable Connect Four Bingo Boards</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        font-family: Arial, sans-serif;
                        color: #111827;
                        background: #ffffff;
                    }
                    .print-board {
                        min-height: 100vh;
                        padding: 0.5in;
                        display: flex;
                        flex-direction: column;
                        page-break-after: always;
                    }
                    .print-board:last-child {
                        page-break-after: auto;
                    }
                    .print-title {
                        text-align: center;
                        font-size: 28px;
                        font-weight: 700;
                        margin: 0 0 0.15in;
                    }
                    .print-grid {
                        width: min(7.5in, 100%);
                        margin: 0 auto;
                        border: 12px solid #111827;
                        border-radius: 20px;
                        padding: 0.08in;
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 0.08in;
                    }
                    .print-cell {
                        border: 1.5px solid #111827;
                        min-height: 1.55in;
                        border-radius: 14px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 0.12in;
                        font-size: 19px;
                        line-height: 1.15;
                        font-weight: 700;
                        background: #ffffff;
                    }
                    .print-unused {
                        width: min(7.5in, 100%);
                        margin: 0.28in auto 0;
                    }
                    .print-unused h2 {
                        margin: 0 0 0.12in;
                        text-align: center;
                        font-size: 18px;
                    }
                    .print-unused-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.08in;
                        justify-content: center;
                    }
                    .print-unused-term {
                        border: 1px solid #9ca3af;
                        border-radius: 999px;
                        padding: 0.06in 0.12in;
                        font-size: 11px;
                        line-height: 1.2;
                    }
                    @page {
                        size: portrait;
                        margin: 0.5in;
                    }
                    @media print {
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                ${boardsMarkup}
            </body>
        </html>
    `);
    printWindow.document.close();
    setFeedback(`Opened ${count} printable board${count === 1 ? "" : "s"} in a new tab.`);
}

function openPrintableDefinitions() {
    if (state.allTerms.length < BOARD_SIZE) {
        setFeedback("Load a board before opening terms and definitions.");
        return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        setFeedback("The print view was blocked. Please allow pop-ups for this page.");
        return;
    }

    const rows = state.allTerms
        .map(
            (item) => `
                <tr>
                    <td>${escapeHtml(item.term)}</td>
                    <td>${escapeHtml(item.definition || "-")}</td>
                </tr>
            `
        )
        .join("");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Printable Terms and Definitions</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        padding: 0.4in;
                        font-family: Arial, sans-serif;
                        color: #111827;
                        background: #ffffff;
                    }
                    h1 {
                        text-align: center;
                        margin: 0 0 0.25in;
                        font-size: 28px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th, td {
                        border: 1px solid #374151;
                        padding: 0.12in;
                        text-align: left;
                        vertical-align: top;
                        font-size: 12px;
                        line-height: 1.35;
                    }
                    th {
                        background: #f3f4f6;
                        font-size: 13px;
                    }
                    @page {
                        size: portrait;
                        margin: 0.5in;
                    }
                    @media print {
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>Connect Four Bingo Terms and Definitions</h1>
                <table>
                    <thead>
                        <tr>
                            <th>Term</th>
                            <th>Definition</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
        </html>
    `);
    printWindow.document.close();
    setFeedback("Opened printable terms and definitions in a new tab.");
}

function buildPrintableBoardMarkup(boardTerms, unusedTerms) {
    const cells = boardTerms
        .map(
            (item) =>
                `<div class="print-cell">${escapeHtml(item.term)}</div>`
        )
        .join("");
    const unusedMarkup = unusedTerms.length
        ? unusedTerms
              .map(
                  (item) =>
                      `<span class="print-unused-term">${escapeHtml(item.term)}</span>`
              )
              .join("")
        : `<span class="print-unused-term">All terms are used on this board.</span>`;

    return `
        <section class="print-board">
            <h1 class="print-title">Connect Four Bingo</h1>
            <div class="print-grid">${cells}</div>
            <section class="print-unused">
                <h2>Terms not on this board</h2>
                <div class="print-unused-list">${unusedMarkup}</div>
            </section>
        </section>
    `;
}

function clearMarks() {
    elements.board.classList.remove("winner");
    document.querySelectorAll(".cell").forEach((cell) => {
        cell.classList.remove("backColorYellow", "cellWinner");
    });
    document.querySelectorAll(".unusedTerm").forEach((item) => {
        item.classList.remove("backColorYellow");
    });
}

function checkForWinner() {
    let foundWin = false;
    document.querySelectorAll(".cell").forEach((cell) => {
        cell.classList.remove("cellWinner");
    });

    document.querySelectorAll(".boardrow").forEach((row) => {
        const marked = row.querySelectorAll(".cell.backColorYellow");
        if (marked.length === 4) {
            foundWin = true;
            row.querySelectorAll(".cell").forEach((cell) => {
                cell.classList.add("cellWinner");
            });
        }
    });

    for (let i = 1; i <= 4; i += 1) {
        const columnCells = document.querySelectorAll(`.col${i}.backColorYellow`);
        if (columnCells.length === 4) {
            foundWin = true;
            columnCells.forEach((cell) => cell.classList.add("cellWinner"));
        }
    }

    ["up", "down"].forEach((direction) => {
        const diagonalCells = document.querySelectorAll(`.${direction}Right.backColorYellow`);
        if (diagonalCells.length === 4) {
            foundWin = true;
            diagonalCells.forEach((cell) => cell.classList.add("cellWinner"));
        }
    });

    elements.board.classList.toggle("winner", foundWin);
}

function normalizeClientRows(rows) {
    return rows
        .slice(1)
        .map((row) => ({
            term: String(row[0] ?? "").trim(),
            definition: String(row[1] ?? "").trim(),
        }))
        .filter((item) => item.term);
}

function parseCsv(raw) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < raw.length; i += 1) {
        const char = raw[i];
        const nextChar = raw[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            row.push(current);
            current = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && nextChar === "\n") {
                i += 1;
            }
            row.push(current);
            rows.push(row);
            row = [];
            current = "";
            continue;
        }

        current += char;
    }

    if (current.length || row.length) {
        row.push(current);
        rows.push(row);
    }

    return rows;
}

function encodeDataParam(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function decodeDataParam(value) {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function setFeedback(message) {
    elements.feedbackMessage.textContent = message || "";
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
