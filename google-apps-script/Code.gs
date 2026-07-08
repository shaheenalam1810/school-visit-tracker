/**
 * School Visit Tracker — Google Apps Script Backend
 * -----------------------------------------------------------
 * Turns a Google Sheet into a small JSON API + role-based CRM used by
 * the Next.js app for:
 *   1. Logging users in against a "Users" sheet (role + active/disabled status)
 *   2. Appending new school visits to a "Visits" sheet (tagged with username)
 *   3. Listing visits — all of them for admins, only their own for normal users
 *   4. Admin user management (add / edit / disable / delete / reset password)
 *   5. Duplicate-visit prevention (same school_name + latitude + longitude)
 *
 * Still only two sheets are used: "Visits" and "Users". No new sheets
 * are created. Existing spreadsheets that were set up before role-based
 * access existed are migrated automatically (missing columns are added
 * in place, existing rows are preserved) the first time this script runs.
 *
 * SETUP
 * -----------------------------------------------------------
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script, delete any starter code, and paste
 *    this whole file in as Code.gs.
 * 3. Run the `setup` function once (Run > setup) and grant the
 *    requested permissions. This creates the "Visits" and "Users"
 *    sheets with the correct headers, and adds one sample admin user
 *    (username: admin / password: admin123) — change this password!
 * 4. Deploy > New deployment > Select type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the generated Web App URL (it ends in /exec) into the
 *    Next.js app's .env.local as NEXT_PUBLIC_APPS_SCRIPT_URL.
 * 6. Whenever you edit this script, create a NEW deployment version
 *    (Deploy > Manage deployments > Edit > New version > Deploy) or
 *    your changes will not go live.
 */

const VISITS_SHEET_NAME = "Visits";
const USERS_SHEET_NAME = "Users";

// Canonical Visits schema. ensureVisitsSheetSchema() adds any of these
// columns that are missing from an existing sheet (backward compatible
// migration — no data is deleted, new columns are backfilled blank).
const VISIT_FIELDS = [
  "username",
  "date",
  "executive",
  "school_name",
  "visitor",
  "designation",
  "mobile",
  "address",
  "google_map",
  "latitude",
  "longitude",
  "accuracy",
  "instruction",
  "students",
  "teachers",
  "current_software",
  "interest",
  "report",
  "followup",
  "notes",
];

// Canonical Users schema (password is never sent back to the client).
const USER_FIELDS = ["username", "password", "name", "role", "status"];

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
    users.appendRow(USER_FIELDS);
    users.appendRow(["admin", "admin123", "Admin User", "admin", "active"]);
    users.setFrozenRows(1);
  }
}

/**
 * Handles GET requests.
 *   ?action=visits&username=...&role=...  -> visits (all for admin, own for user)
 *   ?action=listUsers&requestedBy=...     -> all users (admin only)
 */
function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();

  if (action === "visits") {
    return jsonResponse({ success: true, data: handleGetVisits(e) });
  }

  if (action === "listusers") {
    return jsonResponse(handleListUsers(e));
  }

  return jsonResponse({ success: true, message: "School Visit Tracker API is running." });
}

/**
 * Handles POST requests. The body is sent as text/plain JSON from the
 * Next.js app (to avoid CORS pre-flight) and parsed manually here.
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, message: "Invalid JSON body." });
  }

  const action = (body.action || "").toLowerCase();

  switch (action) {
    case "login":
      return jsonResponse(handleLogin(body.username, body.password));
    case "addvisit":
      return jsonResponse(handleAddVisit(body));
    case "adduser":
      return jsonResponse(handleAddUser(body));
    case "updateuser":
      return jsonResponse(handleUpdateUser(body));
    case "setuserstatus":
      return jsonResponse(handleSetUserStatus(body));
    case "deleteuser":
      return jsonResponse(handleDeleteUser(body));
    case "resetpassword":
      return jsonResponse(handleResetPassword(body));
    default:
      return jsonResponse({ success: false, message: "Unknown action: " + action });
  }
}

// ---------------------------------------------------------------------
// Sheet access + schema migration helpers
// ---------------------------------------------------------------------

function getVisitsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VISITS_SHEET_NAME);
  if (sheet) ensureVisitsSheetSchema(sheet);
  return sheet;
}

function getUsersSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  if (sheet) ensureUsersSheetSchema(sheet);
  return sheet;
}

/**
 * Adds any missing Visits columns (e.g. "username") to an existing
 * sheet without touching existing data.
 */
function ensureVisitsSheetSchema(sheet) {
  ensureColumns(sheet, ["timestamp"].concat(VISIT_FIELDS), {});
}

/**
 * Adds any missing Users columns ("role", "status") to an existing
 * sheet, backfilling sensible defaults for pre-existing rows.
 */
function ensureUsersSheetSchema(sheet) {
  ensureColumns(sheet, USER_FIELDS, {
    role: function (rowNum) {
      const usernameCell = sheet.getRange(rowNum, 1).getValue();
      return String(usernameCell).trim().toLowerCase() === "admin" ? "admin" : "user";
    },
    status: "active",
  });
}

/**
 * Ensures `sheet` has every header in `requiredHeaders`. Missing
 * headers are appended as new columns; existing rows are backfilled
 * using `defaults[header]` (a static value or a function(rowNumber)).
 */
function ensureColumns(sheet, requiredHeaders, defaults) {
  if (sheet.getLastRow() === 0) return;

  requiredHeaders.forEach(function (header) {
    const headers = getHeaders(sheet);
    if (headers.indexOf(header) !== -1) return;

    const newColIndex = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColIndex).setValue(header);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const numRows = lastRow - 1;
      const defaultSpec = defaults[header];
      const values = [];
      for (let i = 0; i < numRows; i++) {
        const rowNum = i + 2;
        const value =
          typeof defaultSpec === "function" ? defaultSpec(rowNum) : defaultSpec !== undefined ? defaultSpec : "";
        values.push([value]);
      }
      sheet.getRange(2, newColIndex, numRows, 1).setValues(values);
    }
  });
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

/**
 * Appends a row built from `valueMap`, ordered to match the sheet's
 * actual current header row (so column order never has to match a
 * hardcoded constant).
 */
function appendRowByHeaders(sheet, headers, valueMap) {
  const row = headers.map(function (h) {
    return valueMap[h] !== undefined ? valueMap[h] : "";
  });
  sheet.appendRow(row);
}

/**
 * Finds a Users row by username (case-insensitive). Returns null if
 * not found, otherwise { rowIndex (1-based sheet row), headers, values }.
 */
function findUserRow(sheet, username) {
  if (!sheet || !username) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const userCol = headers.indexOf("username");
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][userCol]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      return { rowIndex: i + 1, headers: headers, values: values[i] };
    }
  }
  return null;
}

/**
 * Confirms `requestedBy` is an active admin. Every admin-only action
 * calls this first — this app has no server-side session, so trust is
 * anchored to the Users sheet role/status columns for each request.
 */
function requireAdmin(sheet, requestedBy) {
  const found = findUserRow(sheet, requestedBy);
  if (!found) return { ok: false, message: "Requesting user not found." };

  const statusIdx = found.headers.indexOf("status");
  const roleIdx = found.headers.indexOf("role");
  const status = found.values[statusIdx];
  const role = found.values[roleIdx];

  if (status !== "active") return { ok: false, message: "Your account is disabled." };
  if (role !== "admin") return { ok: false, message: "Admin access required." };
  return { ok: true };
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

/**
 * Validates a username/password pair against the Users sheet and
 * rejects disabled accounts.
 */
function handleLogin(username, password) {
  if (!username || !password) {
    return { success: false, message: "Username and password are required." };
  }

  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, message: "Users sheet not found. Run setup() first." };
  }

  const found = findUserRow(sheet, username);
  if (!found) {
    return { success: false, message: "Invalid username or password." };
  }

  const headers = found.headers;
  const rowPass = found.values[headers.indexOf("password")];
  if (String(rowPass).trim() !== String(password).trim()) {
    return { success: false, message: "Invalid username or password." };
  }

  const statusIdx = headers.indexOf("status");
  const status = statusIdx !== -1 ? found.values[statusIdx] || "active" : "active";
  if (status !== "active") {
    return { success: false, message: "Your account has been disabled. Contact your administrator." };
  }

  const roleIdx = headers.indexOf("role");
  const role = roleIdx !== -1 ? found.values[roleIdx] || "user" : "user";
  const nameIdx = headers.indexOf("name");

  return {
    success: true,
    name: found.values[nameIdx] || username,
    role: role,
    status: status,
  };
}

// ---------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------

/**
 * Returns visits scoped to the requester: all rows for an admin, only
 * their own rows (matched by username) for anyone else.
 */
function handleGetVisits(e) {
  const username = e.parameter.username || "";
  const role = (e.parameter.role || "").toLowerCase();
  const all = getAllVisits();

  if (role === "admin") return all;
  if (!username) return [];

  return all.filter(function (v) {
    return String(v.username || "").trim().toLowerCase() === String(username).trim().toLowerCase();
  });
}

/**
 * Appends a new visit row, rejecting duplicates keyed on
 * school_name + latitude + longitude.
 */
function handleAddVisit(body) {
  const sheet = getVisitsSheet();
  if (!sheet) {
    return { success: false, message: "Visits sheet not found. Run setup() first." };
  }

  const headers = getHeaders(sheet);

  if (isDuplicateVisit(sheet, headers, body.school_name, body.latitude, body.longitude)) {
    return {
      success: false,
      message: "This school visit (same school and location) has already been logged.",
    };
  }

  const valueMap = {};
  VISIT_FIELDS.forEach(function (field) {
    valueMap[field] = body[field] !== undefined ? body[field] : "";
  });
  valueMap.timestamp = new Date();

  appendRowByHeaders(sheet, headers, valueMap);
  return { success: true, message: "Visit saved." };
}

/**
 * True if a visit with the same school_name (case-insensitive) and
 * the same latitude/longitude already exists in the sheet.
 */
function isDuplicateVisit(sheet, headers, schoolName, lat, lng) {
  if (!schoolName || !lat || !lng) return false;

  const schoolIdx = headers.indexOf("school_name");
  const latIdx = headers.indexOf("latitude");
  const lngIdx = headers.indexOf("longitude");
  if (schoolIdx === -1 || latIdx === -1 || lngIdx === -1) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const numRows = lastRow - 1;
  const data = sheet.getRange(2, 1, numRows, headers.length).getValues();
  const normSchool = String(schoolName).trim().toLowerCase();
  const normLat = String(lat).trim();
  const normLng = String(lng).trim();

  for (let i = 0; i < data.length; i++) {
    const rowSchool = String(data[i][schoolIdx] || "").trim().toLowerCase();
    const rowLat = String(data[i][latIdx] || "").trim();
    const rowLng = String(data[i][lngIdx] || "").trim();
    if (rowSchool === normSchool && rowLat === normLat && rowLng === normLng) {
      return true;
    }
  }
  return false;
}

/**
 * Reads every visit row and returns it as an array of objects keyed
 * by the sheet's actual header row (plus a timestamp).
 */
function getAllVisits() {
  const sheet = getVisitsSheet();
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

// ---------------------------------------------------------------------
// User management (admin only)
// ---------------------------------------------------------------------

function handleListUsers(e) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, e.parameter.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  if (sheet.getLastRow() < 2) return { success: true, data: [] };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const usernameIdx = headers.indexOf("username");
  const nameIdx = headers.indexOf("name");
  const roleIdx = headers.indexOf("role");
  const statusIdx = headers.indexOf("status");

  const data = values.slice(1).map(function (row) {
    return {
      username: row[usernameIdx],
      name: row[nameIdx],
      role: row[roleIdx] || "user",
      status: row[statusIdx] || "active",
    };
  });

  return { success: true, data: data };
}

function handleAddUser(body) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, body.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const role = body.role === "admin" ? "admin" : "user";

  if (!username || !password || !name) {
    return { success: false, message: "Username, password, and name are required." };
  }
  if (findUserRow(sheet, username)) {
    return { success: false, message: "A user with that username already exists." };
  }

  const headers = getHeaders(sheet);
  appendRowByHeaders(sheet, headers, {
    username: username,
    password: password,
    name: name,
    role: role,
    status: "active",
  });

  return { success: true, message: "User created." };
}

function handleUpdateUser(body) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, body.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  const found = findUserRow(sheet, body.username);
  if (!found) return { success: false, message: "User not found." };

  const headers = found.headers;
  if (body.name !== undefined) {
    sheet.getRange(found.rowIndex, headers.indexOf("name") + 1).setValue(String(body.name).trim());
  }
  if (body.role !== undefined) {
    sheet.getRange(found.rowIndex, headers.indexOf("role") + 1).setValue(body.role === "admin" ? "admin" : "user");
  }

  return { success: true, message: "User updated." };
}

function handleSetUserStatus(body) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, body.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  if (String(body.username).trim().toLowerCase() === String(body.requestedBy).trim().toLowerCase()) {
    return { success: false, message: "You cannot change your own status." };
  }

  const found = findUserRow(sheet, body.username);
  if (!found) return { success: false, message: "User not found." };

  const status = body.status === "disabled" ? "disabled" : "active";
  sheet.getRange(found.rowIndex, found.headers.indexOf("status") + 1).setValue(status);

  return { success: true, message: status === "disabled" ? "User disabled." : "User enabled." };
}

function handleDeleteUser(body) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, body.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  if (String(body.username).trim().toLowerCase() === String(body.requestedBy).trim().toLowerCase()) {
    return { success: false, message: "You cannot delete your own account." };
  }

  const found = findUserRow(sheet, body.username);
  if (!found) return { success: false, message: "User not found." };

  sheet.deleteRow(found.rowIndex);
  return { success: true, message: "User deleted." };
}

function handleResetPassword(body) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, body.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  const found = findUserRow(sheet, body.username);
  if (!found) return { success: false, message: "User not found." };

  const newPassword = String(body.newPassword || "");
  if (!newPassword) return { success: false, message: "New password is required." };

  sheet.getRange(found.rowIndex, found.headers.indexOf("password") + 1).setValue(newPassword);
  return { success: true, message: "Password reset." };
}

// ---------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
