/**
 * School Visit Tracker — Google Apps Script Backend
 * -----------------------------------------------------------
 * This script turns a Google Sheet into a tiny JSON API used by the
 * Next.js app for:
 *   1. Logging executives in against a "Users" sheet
 *   2. Appending new school visits to a "Visits" sheet
 *   3. Listing all visits so the app can compute dashboard stats
 *
 * SETUP
 * -----------------------------------------------------------
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script, delete any starter code, and paste
 *    this whole file in as Code.gs.
 * 3. Run the `setup` function once (Run > setup) and grant the
 *    requested permissions. This creates the "Visits" and "Users"
 *    sheets with the correct headers, and adds one sample user
 *    (username: admin / password: admin123) — change this password!
 * 4. Deploy > New deployment > Select type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the generated Web App URL (it ends in /exec) into the
 *    Next.js app's .env.local as NEXT_PUBLIC_APPS_SCRIPT_URL.
 * 6. Whenever you edit this script, create a NEW deployment version
 *    (Deploy > Manage deployments > Edit > New version) or your
 *    changes will not go live.
 */

const VISITS_SHEET_NAME = "Visits";
const USERS_SHEET_NAME = "Users";

// Column order for the Visits sheet. Keep this in sync with the
// VisitPayload fields sent from the Next.js app.
const VISIT_FIELDS = [
  "date",
  "executive",
  "school_name",
  "visitor",
  "designation",
  "mobile",
  "address",
  "google_map",
  "instruction",
  "students",
  "teachers",
  "current_software",
  "interest",
  "report",
  "followup",
  "notes",
];

/**
 * One-time setup: creates the sheets and headers if they don't exist.
 * Run this manually from the Apps Script editor.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let visits = ss.getSheetByName(VISITS_SHEET_NAME);
  if (!visits) {
    visits = ss.insertSheet(VISITS_SHEET_NAME);
  }
  if (visits.getLastRow() === 0) {
    visits.appendRow(["timestamp"].concat(VISIT_FIELDS));
    visits.setFrozenRows(1);
  }

  let users = ss.getSheetByName(USERS_SHEET_NAME);
  if (!users) {
    users = ss.insertSheet(USERS_SHEET_NAME);
  }
  if (users.getLastRow() === 0) {
    users.appendRow(["username", "password", "name"]);
    users.appendRow(["admin", "admin123", "Admin User"]);
    users.setFrozenRows(1);
  }
}

/**
 * Handles GET requests.
 *   ?action=visits  -> returns all visit rows as JSON
 */
function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();

  if (action === "visits") {
    return jsonResponse({ success: true, data: getAllVisits() });
  }

  return jsonResponse({ success: true, message: "School Visit Tracker API is running." });
}

/**
 * Handles POST requests. The body is sent as text/plain JSON from the
 * Next.js app (to avoid CORS pre-flight) and parsed manually here.
 *   { "action": "login", "username": "...", "password": "..." }
 *   { "action": "addVisit", ...visit fields }
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, message: "Invalid JSON body." });
  }

  const action = (body.action || "addVisit").toLowerCase();

  if (action === "login") {
    return jsonResponse(handleLogin(body.username, body.password));
  }

  if (action === "addvisit") {
    return jsonResponse(handleAddVisit(body));
  }

  return jsonResponse({ success: false, message: "Unknown action: " + action });
}

/**
 * Validates a username/password pair against the Users sheet.
 */
function handleLogin(username, password) {
  if (!username || !password) {
    return { success: false, message: "Username and password are required." };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    return { success: false, message: "Users sheet not found. Run setup() first." };
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [rowUser, rowPass, rowName] = rows[i];
    if (
      String(rowUser).trim().toLowerCase() === String(username).trim().toLowerCase() &&
      String(rowPass) === String(password)
    ) {
      return { success: true, name: rowName || rowUser };
    }
  }

  return { success: false, message: "Invalid username or password." };
}

/**
 * Appends a new visit row to the Visits sheet.
 */
function handleAddVisit(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VISITS_SHEET_NAME);
  if (!sheet) {
    return { success: false, message: "Visits sheet not found. Run setup() first." };
  }

  const row = [new Date()].concat(
    VISIT_FIELDS.map((field) => (body[field] !== undefined ? body[field] : ""))
  );

  sheet.appendRow(row);
  return { success: true, message: "Visit saved." };
}

/**
 * Reads every visit row and returns it as an array of objects keyed
 * by VISIT_FIELDS (plus a timestamp).
 */
function getAllVisits() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VISITS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  return rows.map((row) => {
    const record = {};
    headers.forEach((header, idx) => {
      let value = row[idx];
      if (value instanceof Date) {
        value = header === "timestamp" ? value.toISOString() : formatDate(value);
      }
      record[header] = value;
    });
    return record;
  });
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
