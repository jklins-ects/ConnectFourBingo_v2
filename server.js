require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
    res.json({
        googleSheetsConfigured: Boolean(GOOGLE_SHEETS_API_KEY),
    });
});

app.post("/api/google-sheet", async (req, res) => {
    const { shareUrl, sheetName, cellRange } = req.body || {};

    if (!GOOGLE_SHEETS_API_KEY) {
        return res.status(500).json({
            result: false,
            error: "Google Sheets is not configured on the server.",
        });
    }

    if (!shareUrl || !sheetName || !cellRange) {
        return res.status(400).json({
            result: false,
            error: "Share URL, sheet name, and range are required.",
        });
    }

    const spreadsheetId = parseSheetIdFromShareUrl(shareUrl);

    if (!spreadsheetId) {
        return res.status(400).json({
            result: false,
            error: "That Google Sheets share link could not be read.",
        });
    }

    const encodedRange = encodeURIComponent(`${sheetName}!${cellRange}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?key=${encodeURIComponent(GOOGLE_SHEETS_API_KEY)}`;

    try {
        const response = await fetch(url);
        const payload = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                result: false,
                error: payload?.error?.message || "Google Sheets could not be loaded.",
            });
        }

        const data = normalizeRows(payload.values || []);
        res.json({ result: true, data });
    } catch (error) {
        res.status(500).json({
            result: false,
            error: "The server could not reach Google Sheets.",
            details: error.message,
        });
    }
});

app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Connect Four Bingo is running on http://localhost:${PORT}`);
});

function normalizeRows(rows) {
    return rows
        .slice(1)
        .map((row) => ({
            term: String(row?.[0] ?? "").trim(),
            definition: String(row?.[1] ?? "").trim(),
        }))
        .filter((item) => item.term);
}

function parseSheetIdFromShareUrl(shareUrl) {
    try {
        const url = new URL(shareUrl);
        const parts = url.pathname.split("/");
        const sheetIndex = parts.indexOf("d");
        return sheetIndex >= 0 ? parts[sheetIndex + 1] : "";
    } catch (_error) {
        return "";
    }
}
