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
 *   6. Editing/soft-deleting visits, with a full timeline (created/updated/deleted)
 *   7. An admin-only Activity Log of every important action
 *   8. A Follow-up Timeline: each visit can have unlimited follow-up
 *      entries (date, next date, type, status, notes), independent of
 *      the single legacy "followup" field captured at visit creation
 *   9. A Daily Follow-up Dashboard (action=followupdashboard): every
 *      follow-up entry the caller may see, joined with its visit and
 *      auto-bucketed (overdue/today/tomorrow/upcoming/completed/
 *      cancelled) for the Next.js /followups page
 *
 * Four sheets are used: "Visits", "Users", "ActivityLog", "FollowUps".
 * "ActivityLog" and "FollowUps" are created automatically the first
 * time they're needed — you do not need to create them by hand.
 * Existing spreadsheets set up before any of this existed are migrated
 * automatically (missing columns are added in place, existing rows/
 * data are preserved).
 *
 * PERFORMANCE NOTES
 * -----------------------------------------------------------
 * Two caching layers keep Sheets API calls to a minimum:
 *   - Per-invocation memoization (`_sheetCache`, reset at the top of
 *     every doGet/doPost): each sheet's raw values are read via
 *     getDataRange().getValues() at most ONCE per request, no matter
 *     how many handlers/helpers need them.
 *   - Cross-request caching via CacheService: the fully-computed visits
 *     list (already merged with follow-up data) and the raw Users rows
 *     are cached script-wide. Every mutating handler invalidates the
 *     relevant cache entry immediately after a successful write, so
 *     the TTL is just a safety net, not the source of freshness.
 * Never read a sheet's data directly with getDataRange().getValues() —
 * always go through getVisitsRawValues/getUsersRawValues/
 * getFollowUpsRawValues so the memoization actually applies.
 *
 * SECURITY NOTE: every request re-derives the caller's role/status by
 * looking them up in the Users sheet by username. A `role` sent by the
 * client (e.g. in a GET query string) is never trusted for permission
 * decisions — only for display/back-compat. See resolveRequester().
 *
 * SETUP
 * -----------------------------------------------------------
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script, delete any starter code, and paste
 *    this whole file in as Code.gs.
 * 3. Run the `setup` function once (Run > setup) and grant the
 *    requested permissions. This creates the "Visits", "Users", and
 *    "ActivityLog" sheets with the correct headers, and adds one
 *    sample admin user (username: admin / password: admin123) —
 *    change this password!
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
const ACTIVITY_LOG_SHEET_NAME = "ActivityLog";
const FOLLOWUPS_SHEET_NAME = "FollowUps";

// Canonical Visits schema for fields submitted from the New Visit form.
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

// System-managed columns: identity + full lifecycle timeline. Never
// submitted directly by the New Visit form.
const VISIT_SYSTEM_FIELDS = [
  "visit_id",
  "created_by",
  "updated_by",
  "updated_at",
  "deleted",
  "deleted_by",
  "deleted_at",
];

// Fields an edit is allowed to change. Username, executive, and every
// timeline/system field are read-only from the client's perspective.
// "followup" is intentionally excluded: scheduling is now done through
// FOLLOWUP_FIELDS entries (the Follow-up Timeline) instead of editing
// this single legacy field in place.
const VISIT_EDITABLE_FIELDS = [
  "school_name",
  "visitor",
  "designation",
  "mobile",
  "address",
  "students",
  "teachers",
  "current_software",
  "interest",
  "report",
  "notes",
  "google_map",
  "latitude",
  "longitude",
  "accuracy",
];

// Canonical Users schema (password is never sent back to the client).
const USER_FIELDS = ["username", "password", "name", "role", "status"];

const ACTIVITY_LOG_FIELDS = ["timestamp", "username", "action", "details", "date", "time", "ip"];

// Canonical FollowUps schema. Each row is one follow-up entry attached
// to a visit via visit_id — a visit can have unlimited entries. Soft
// deleted (never removed) so history is never lost.
const FOLLOWUP_FIELDS = [
  "followup_id",
  "visit_id",
  "followup_date",
  "next_followup_date",
  "type",
  "status",
  "notes",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
  "deleted",
  "deleted_by",
  "deleted_at",
];

// Cross-request cache keys + TTL. CacheService caps TTL at 21600s (6h);
// that's fine here because every mutating handler removes the relevant
// key immediately on success, so the TTL only matters as a fallback.
const VISITS_CACHE_KEY = "svt_visits_data_v1";
const USERS_RAW_CACHE_KEY = "svt_users_raw_v1";
const CACHE_TTL_SECONDS = 21600;

// Per-invocation memoization. Reset at the top of doGet/doPost so state
// never leaks between requests, but reused freely within one request.
let _sheetCache = {};

function resetInvocationCache() {
  _sheetCache = {};
}

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
    visits.appendRow(["timestamp"].concat(VISIT_FIELDS).concat(VISIT_SYSTEM_FIELDS));
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

  let activityLog = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!activityLog) {
    activityLog = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
  }
  if (activityLog.getLastRow() === 0) {
    activityLog.appendRow(ACTIVITY_LOG_FIELDS);
    activityLog.setFrozenRows(1);
  }

  let followUps = ss.getSheetByName(FOLLOWUPS_SHEET_NAME);
  if (!followUps) {
    followUps = ss.insertSheet(FOLLOWUPS_SHEET_NAME);
  }
  if (followUps.getLastRow() === 0) {
    followUps.appendRow(FOLLOWUP_FIELDS);
    followUps.setFrozenRows(1);
  }
}

/**
 * Handles GET requests.
 *   ?action=dashboard&username=...         -> { visits, users, role, status } in one call
 *   ?action=visits&username=...            -> visits (all for admin, own for user)
 *   ?action=listUsers&requestedBy=...      -> all users (admin only)
 *   ?action=activityLog&requestedBy=...    -> activity log rows (admin only)
 *   ?action=followups&visit_id=...&requestedBy=...  -> follow-up history for one visit
 *   ?action=followupdashboard&username=...  -> every follow-up the caller may see, joined with its visit
 */
function doGet(e) {
  resetInvocationCache();
  const action = (e.parameter.action || "").toLowerCase();

  if (action === "dashboard") {
    return jsonResponse(handleGetDashboard(e));
  }

  if (action === "visits") {
    return jsonResponse({ success: true, data: handleGetVisits(e) });
  }

  if (action === "listusers") {
    return jsonResponse(handleListUsers(e));
  }

  if (action === "activitylog") {
    return jsonResponse(handleGetActivityLog(e));
  }

  if (action === "followups") {
    return jsonResponse(handleGetFollowUps(e));
  }

  if (action === "followupdashboard") {
    return jsonResponse(handleGetFollowUpDashboard(e));
  }

  return jsonResponse({ success: true, message: "School Visit Tracker API is running." });
}

/**
 * Handles POST requests. The body is sent as text/plain JSON from the
 * Next.js app (to avoid CORS pre-flight) and parsed manually here.
 */
function doPost(e) {
  resetInvocationCache();

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
    case "logout":
      logActivity(body.username, "logged out", "");
      return jsonResponse({ success: true });
    case "addvisit":
      return jsonResponse(handleAddVisit(body));
    case "updatevisit":
      return jsonResponse(handleUpdateVisit(body));
    case "deletevisit":
      return jsonResponse(handleDeleteVisit(body));
    case "addfollowup":
      return jsonResponse(handleAddFollowUp(body));
    case "updatefollowup":
      return jsonResponse(handleUpdateFollowUp(body));
    case "deletefollowup":
      return jsonResponse(handleDeleteFollowUp(body));
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
// Cross-request cache helpers (CacheService)
// ---------------------------------------------------------------------

function getCache_() {
  return CacheService.getScriptCache();
}

/** Reads + JSON.parses a cache entry. Never throws — a cache miss/error just returns null. */
function cacheGetJson_(key) {
  try {
    const raw = getCache_().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Writes a JSON-serialized cache entry. Never throws: CacheService
 * rejects values over 100KB, which would otherwise break the request
 * that triggered the (fresh, still-valid) sheet read.
 */
function cachePutJson_(key, obj) {
  try {
    getCache_().put(key, JSON.stringify(obj), CACHE_TTL_SECONDS);
  } catch (err) {
    // Too large for the cache or the cache is temporarily unavailable —
    // safe to skip, the caller already has the fresh data it needs.
  }
}

function cacheRemove_(key) {
  try {
    getCache_().remove(key);
  } catch (err) {
    // Best-effort invalidation; a stale hit will still self-heal once the TTL expires.
  }
}

/** Invalidates the visits cache. Call after any visit or follow-up write. */
function invalidateVisitsCache() {
  delete _sheetCache.allVisitsComputed;
  delete _sheetCache.visitsRaw;
  delete _sheetCache.followUpsRaw;
  cacheRemove_(VISITS_CACHE_KEY);
}

/** Invalidates the Users cache. Call after any user-management write. */
function invalidateUsersCache() {
  delete _sheetCache.usersRaw;
  cacheRemove_(USERS_RAW_CACHE_KEY);
}

// ---------------------------------------------------------------------
// Sheet access + schema migration helpers
// ---------------------------------------------------------------------

/**
 * Returns the Visits sheet. Schema migration is checked (and memoized)
 * at most once per request, no matter how many times this is called.
 */
function getVisitsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VISITS_SHEET_NAME);
  if (sheet && !_sheetCache.visitsSchemaEnsured) {
    ensureVisitsSheetSchema(sheet);
    _sheetCache.visitsSchemaEnsured = true;
  }
  return sheet;
}

/**
 * Returns the Users sheet. Schema migration is checked (and memoized)
 * at most once per request, no matter how many times this is called.
 */
function getUsersSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  if (sheet && !_sheetCache.usersSchemaEnsured) {
    ensureUsersSheetSchema(sheet);
    _sheetCache.usersSchemaEnsured = true;
  }
  return sheet;
}

/**
 * Returns the ActivityLog sheet, creating it on first use so existing
 * deployments don't need to re-run setup() to get logging.
 */
function getActivityLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
    sheet.appendRow(ACTIVITY_LOG_FIELDS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Returns the FollowUps sheet, creating it on first use so existing
 * deployments don't need to re-run setup() to get follow-up support.
 */
function getFollowUpsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FOLLOWUPS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FOLLOWUPS_SHEET_NAME);
    sheet.appendRow(FOLLOWUP_FIELDS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Returns this request's memoized full values (header row + data rows)
 * for the Visits sheet, reading it from the sheet at most once.
 */
function getVisitsRawValues(sheet) {
  if (!_sheetCache.visitsRaw) {
    _sheetCache.visitsRaw = sheet.getLastRow() === 0 ? [] : sheet.getDataRange().getValues();
  }
  return _sheetCache.visitsRaw;
}

/**
 * Returns this request's memoized full values (header row + data rows)
 * for the FollowUps sheet, reading it from the sheet at most once.
 */
function getFollowUpsRawValues(sheet) {
  if (!_sheetCache.followUpsRaw) {
    _sheetCache.followUpsRaw = sheet.getLastRow() === 0 ? [] : sheet.getDataRange().getValues();
  }
  return _sheetCache.followUpsRaw;
}

/**
 * Returns the Users sheet's full values, memoized for this request AND
 * cached cross-request via CacheService (Users rows are plain strings,
 * so there's no Date-serialization ambiguity in round-tripping them
 * through JSON, unlike Visits/FollowUps which contain real Date cells).
 */
function getUsersRawValues(sheet) {
  if (_sheetCache.usersRaw) return _sheetCache.usersRaw;

  let values = cacheGetJson_(USERS_RAW_CACHE_KEY);
  if (!values) {
    values = sheet.getLastRow() === 0 ? [] : sheet.getDataRange().getValues();
    cachePutJson_(USERS_RAW_CACHE_KEY, values);
  }
  _sheetCache.usersRaw = values;
  return values;
}

/**
 * Adds any missing Visits columns (username, timeline/system fields)
 * to an existing sheet without touching existing data.
 */
function ensureVisitsSheetSchema(sheet) {
  ensureColumns(sheet, ["timestamp"].concat(VISIT_FIELDS).concat(VISIT_SYSTEM_FIELDS), {
    visit_id: function () {
      return Utilities.getUuid();
    },
    created_by: function (rowNum, headers) {
      const usernameCol = headers.indexOf("username");
      return usernameCol === -1 ? "" : sheet.getRange(rowNum, usernameCol + 1).getValue();
    },
  });
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
 * using `defaults[header]` (a static value or a function(rowNumber, headersAtThatPoint)).
 *
 * Reads the header row exactly ONCE (not once per required header —
 * that was previously the single biggest source of Sheets API calls,
 * since it ran unconditionally on every request via getVisitsSheet()/
 * getUsersSheet()). The in-memory `headers` array is kept in sync as
 * columns are appended, so no re-read is ever needed.
 */
function ensureColumns(sheet, requiredHeaders, defaults) {
  if (sheet.getLastRow() === 0) return;

  let headers = getHeaders(sheet);

  requiredHeaders.forEach(function (header) {
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
          typeof defaultSpec === "function"
            ? defaultSpec(rowNum, headers)
            : defaultSpec !== undefined
            ? defaultSpec
            : "";
        values.push([value]);
      }
      sheet.getRange(2, newColIndex, numRows, 1).setValues(values);
    }

    headers = headers.concat([header]);
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
  const values = getUsersRawValues(sheet);
  if (values.length === 0) return null;
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
 * Finds a Visits row by its system-generated visit_id.
 */
function findVisitRow(sheet, visitId) {
  if (!sheet || !visitId) return null;
  const values = getVisitsRawValues(sheet);
  if (values.length === 0) return null;
  const headers = values[0];
  const idCol = headers.indexOf("visit_id");
  if (idCol === -1) return null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(visitId)) {
      return { rowIndex: i + 1, headers: headers, values: values[i] };
    }
  }
  return null;
}

/**
 * Finds a FollowUps row by its system-generated followup_id.
 */
function findFollowUpRow(sheet, followupId) {
  if (!sheet || !followupId) return null;
  const values = getFollowUpsRawValues(sheet);
  if (values.length === 0) return null;
  const headers = values[0];
  const idCol = headers.indexOf("followup_id");
  if (idCol === -1) return null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(followupId)) {
      return { rowIndex: i + 1, headers: headers, values: values[i] };
    }
  }
  return null;
}

/**
 * Authoritatively resolves a username's current role/status from the
 * Users sheet. Every permission check must go through this — a role
 * or status claimed by the client is never trusted directly.
 */
function resolveRequester(username) {
  const sheet = getUsersSheet();
  const found = findUserRow(sheet, username);
  if (!found) return { exists: false, role: "user", status: "disabled" };
  const headers = found.headers;
  return {
    exists: true,
    role: found.values[headers.indexOf("role")] || "user",
    status: found.values[headers.indexOf("status")] || "active",
  };
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

  logActivity(username, "logged in", "");

  return {
    success: true,
    name: found.values[nameIdx] || username,
    role: role,
    status: status,
  };
}

// ---------------------------------------------------------------------
// Dashboard (merged endpoint)
// ---------------------------------------------------------------------

/**
 * Combines the visits list + (for admins) the users list into a single
 * response, so pages that need both no longer have to make two
 * separate Apps Script requests (each of which spins up its own
 * execution and re-authenticates the caller from scratch).
 */
function handleGetDashboard(e) {
  const username = e.parameter.username || "";
  const requester = resolveRequester(username);

  const visits = scopeVisitsForRequester(getAllVisitsCached(), username, requester);

  let users = [];
  if (requester.status === "active" && requester.role === "admin") {
    users = getUsersList();
  }

  return {
    success: true,
    data: {
      visits: visits,
      users: users,
      role: requester.role,
      status: requester.status,
    },
  };
}

// ---------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------

/**
 * Filters the full (cached) visits list down to what `username`/
 * `requester` are allowed to see: every non-deleted row for an active
 * admin, only their own rows for anyone else, nothing for an inactive
 * or unrecognized account.
 */
function scopeVisitsForRequester(allVisits, username, requester) {
  const nonDeleted = allVisits.filter(function (v) {
    return v.deleted !== "true";
  });

  if (requester.status !== "active") return [];
  if (requester.role === "admin") return nonDeleted;
  if (!username) return [];

  return nonDeleted.filter(function (v) {
    return String(v.username || "").trim().toLowerCase() === String(username).trim().toLowerCase();
  });
}

/**
 * Returns visits scoped to the requester: all rows for an admin, only
 * their own rows (matched by username) for anyone else. The caller's
 * role is re-derived from the Users sheet — never trusted from the
 * query string. Soft-deleted visits are always excluded.
 */
function handleGetVisits(e) {
  const username = e.parameter.username || "";
  const requester = resolveRequester(username);
  return scopeVisitsForRequester(getAllVisitsCached(), username, requester);
}

/**
 * Appends a new visit row, rejecting duplicates keyed on
 * school_name + latitude + longitude. Stamps a unique visit_id and
 * created_by so it can be edited/deleted/tracked later.
 */
function handleAddVisit(body) {
  const sheet = getVisitsSheet();
  if (!sheet) {
    return { success: false, message: "Visits sheet not found. Run setup() first." };
  }

  const raw = getVisitsRawValues(sheet);
  const headers = raw.length > 0 ? raw[0] : getHeaders(sheet);

  if (isDuplicateVisit(raw, headers, body.school_name, body.latitude, body.longitude)) {
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
  valueMap.visit_id = Utilities.getUuid();
  valueMap.created_by = body.username || "";

  appendRowByHeaders(sheet, headers, valueMap);
  invalidateVisitsCache();
  logActivity(body.username, "created a visit", String(body.school_name || ""));

  return { success: true, message: "Visit saved." };
}

/**
 * Updates an existing visit row in place (never appends a new row).
 * Admins may edit any visit; everyone else only their own. Only
 * VISIT_EDITABLE_FIELDS can change — username/executive/timeline
 * fields are always read-only from the client.
 */
function handleUpdateVisit(body) {
  const sheet = getVisitsSheet();
  if (!sheet) return { success: false, message: "Visits sheet not found. Run setup() first." };

  const requester = resolveRequester(body.requestedBy);
  if (requester.status !== "active") return { success: false, message: "Your account is disabled." };

  const found = findVisitRow(sheet, body.visit_id);
  if (!found) return { success: false, message: "Visit not found." };

  const headers = found.headers;
  const ownerUsername = String(found.values[headers.indexOf("username")] || "").trim().toLowerCase();
  const isOwner = ownerUsername === String(body.requestedBy || "").trim().toLowerCase();

  if (requester.role !== "admin" && !isOwner) {
    return { success: false, message: "You can only edit your own visits." };
  }
  if (found.values[headers.indexOf("deleted")] === "true") {
    return { success: false, message: "This visit has been deleted and can no longer be edited." };
  }

  const changes = [];
  VISIT_EDITABLE_FIELDS.forEach(function (field) {
    if (body[field] === undefined) return;
    const colIdx = headers.indexOf(field);
    if (colIdx === -1) return;
    const oldValue = found.values[colIdx];
    const newValue = body[field];
    if (String(oldValue !== undefined && oldValue !== null ? oldValue : "") !== String(newValue)) {
      sheet.getRange(found.rowIndex, colIdx + 1).setValue(newValue);
      changes.push(field + ': "' + oldValue + '" -> "' + newValue + '"');
    }
  });

  if (changes.length === 0) {
    return { success: true, message: "No changes to save." };
  }

  const updatedByIdx = headers.indexOf("updated_by");
  const updatedAtIdx = headers.indexOf("updated_at");
  if (updatedByIdx !== -1) sheet.getRange(found.rowIndex, updatedByIdx + 1).setValue(body.requestedBy || "");
  if (updatedAtIdx !== -1) sheet.getRange(found.rowIndex, updatedAtIdx + 1).setValue(new Date());

  invalidateVisitsCache();

  const schoolName = found.values[headers.indexOf("school_name")] || "";
  logActivity(body.requestedBy, "edited a visit", schoolName + " — " + changes.join("; "));

  return { success: true, message: "Visit updated." };
}

/**
 * Soft-deletes a visit: the row is kept (with deleted/deleted_by/
 * deleted_at stamped) so its timeline and audit trail remain
 * inspectable, but it is excluded from every normal visits query.
 * Admin only — ownership does not grant delete rights (unlike edit,
 * which remains owner-or-admin). The requester's role is re-derived
 * from the Users sheet; a role claimed by the client is never trusted.
 */
function handleDeleteVisit(body) {
  const sheet = getVisitsSheet();
  if (!sheet) return { success: false, message: "Visits sheet not found. Run setup() first." };

  const requester = resolveRequester(body.requestedBy);
  if (requester.status !== "active") return { success: false, message: "Your account is disabled." };

  if (requester.role !== "admin") {
    return { success: false, message: "Only administrators can delete visits." };
  }

  const found = findVisitRow(sheet, body.visit_id);
  if (!found) return { success: false, message: "Visit not found." };

  const headers = found.headers;
  const deletedIdx = headers.indexOf("deleted");
  const deletedByIdx = headers.indexOf("deleted_by");
  const deletedAtIdx = headers.indexOf("deleted_at");
  if (deletedIdx !== -1) sheet.getRange(found.rowIndex, deletedIdx + 1).setValue("true");
  if (deletedByIdx !== -1) sheet.getRange(found.rowIndex, deletedByIdx + 1).setValue(body.requestedBy || "");
  if (deletedAtIdx !== -1) sheet.getRange(found.rowIndex, deletedAtIdx + 1).setValue(new Date());

  invalidateVisitsCache();

  const schoolName = found.values[headers.indexOf("school_name")] || "";
  logActivity(body.requestedBy, "deleted a visit", String(schoolName));

  return { success: true, message: "Visit deleted." };
}

// ---------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------

/**
 * Returns the (non-deleted) follow-up history for one visit, sorted
 * oldest-first. Only the visit's owner or an admin may read it.
 */
function handleGetFollowUps(e) {
  const visitId = e.parameter.visit_id || "";
  const requestedBy = e.parameter.requestedBy || "";

  const visitsSheet = getVisitsSheet();
  const visit = findVisitRow(visitsSheet, visitId);
  if (!visit) return { success: false, message: "Visit not found." };

  const requester = resolveRequester(requestedBy);
  if (requester.status !== "active") return { success: false, message: "Your account is disabled." };

  const ownerUsername = String(visit.values[visit.headers.indexOf("username")] || "").trim().toLowerCase();
  const isOwner = ownerUsername === String(requestedBy).trim().toLowerCase();
  if (requester.role !== "admin" && !isOwner) {
    return { success: false, message: "You can only view follow-ups for your own visits." };
  }

  const sheet = getFollowUpsSheet();
  const values = getFollowUpsRawValues(sheet);
  if (values.length < 2) return { success: true, data: [] };

  const headers = values[0];
  const data = values
    .slice(1)
    .map(function (row) {
      const record = {};
      headers.forEach(function (h, i) {
        let v = row[i];
        if (v instanceof Date) v = v.toISOString();
        record[h] = v;
      });
      return record;
    })
    .filter(function (r) {
      return String(r.visit_id) === String(visitId) && r.deleted !== "true";
    })
    .sort(function (a, b) {
      return String(a.followup_date || "").localeCompare(String(b.followup_date || ""));
    });

  return { success: true, data: data };
}

/**
 * Returns every non-deleted follow-up entry the caller may see (all of
 * them for an active admin, only entries on their own visits for
 * anyone else), each joined with its parent visit's fields so the
 * Daily Follow-up Dashboard can render + open a visit without a second
 * request. Permission is enforced by construction: a follow-up is only
 * included if its visit_id is present in the caller's own
 * scopeVisitsForRequester() result — the same scoping already used by
 * handleGetVisits/handleGetDashboard — so a role/username claimed by
 * the client can never widen what comes back.
 *
 * Each entry also gets a server-computed `bucket` (overdue/today/
 * tomorrow/upcoming/completed/cancelled) per the Auto Status rule: a
 * past-due next_followup_date is "overdue" unless the entry's own
 * status is already Completed or Cancelled, in which case that wins.
 */
function handleGetFollowUpDashboard(e) {
  const username = e.parameter.username || e.parameter.requestedBy || "";
  const requester = resolveRequester(username);
  if (requester.status !== "active") {
    return { success: true, data: emptyFollowUpDashboard() };
  }

  const scopedVisits = scopeVisitsForRequester(getAllVisitsCached(), username, requester);
  const visitMap = {};
  scopedVisits.forEach(function (v) {
    if (v.visit_id) visitMap[v.visit_id] = v;
  });

  const sheet = getFollowUpsSheet();
  const raw = getFollowUpsRawValues(sheet);
  if (raw.length < 2) {
    return { success: true, data: emptyFollowUpDashboard() };
  }

  const headers = raw[0];
  const now = new Date();
  const todayStr = formatDate(now);
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);
  const tomorrowStr = formatDate(tomorrowDate);

  const counts = { today: 0, tomorrow: 0, overdue: 0, upcoming: 0, completed: 0, cancelled: 0, all: 0 };
  const followups = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const record = {};
    headers.forEach(function (h, idx) {
      let v = row[idx];
      if (v instanceof Date) v = v.toISOString();
      record[h] = v;
    });

    if (record.deleted === "true") continue;
    const visit = visitMap[record.visit_id];
    if (!visit) continue;

    const bucket = computeFollowUpBucket(record, todayStr, tomorrowStr);
    counts[bucket] = (counts[bucket] || 0) + 1;
    counts.all += 1;

    followups.push({
      followup_id: record.followup_id,
      visit_id: record.visit_id,
      followup_date: record.followup_date,
      next_followup_date: record.next_followup_date || "",
      type: record.type,
      status: record.status,
      notes: record.notes || "",
      created_by: record.created_by,
      created_at: record.created_at,
      updated_by: record.updated_by,
      updated_at: record.updated_at,
      bucket: bucket,
      visit: visit,
    });
  }

  followups.sort(function (a, b) {
    return String(a.next_followup_date || "").localeCompare(String(b.next_followup_date || ""));
  });

  return {
    success: true,
    data: {
      followups: followups,
      counts: counts,
      today: todayStr,
      tomorrow: tomorrowStr,
    },
  };
}

function emptyFollowUpDashboard() {
  return {
    followups: [],
    counts: { today: 0, tomorrow: 0, overdue: 0, upcoming: 0, completed: 0, cancelled: 0, all: 0 },
    today: formatDate(new Date()),
    tomorrow: formatDate(new Date(Date.now() + 86400000)),
  };
}

/**
 * "completed"/"cancelled" always win (a finished follow-up never shows
 * as overdue). Otherwise the bucket is purely a function of
 * next_followup_date vs. today/tomorrow — a missing next date falls
 * back to "upcoming" since there's nothing due to compare against.
 */
function computeFollowUpBucket(record, todayStr, tomorrowStr) {
  if (record.status === "Completed") return "completed";
  if (record.status === "Cancelled") return "cancelled";

  const next = String(record.next_followup_date || "");
  if (!next) return "upcoming";
  if (next < todayStr) return "overdue";
  if (next === todayStr) return "today";
  if (next === tomorrowStr) return "tomorrow";
  return "upcoming";
}

/**
 * Adds a follow-up entry to a visit. The requester must be an admin
 * or the visit's owner (adding is tied to visit ownership, unlike
 * edit/delete below which are tied to who created the entry itself).
 */
function handleAddFollowUp(body) {
  const visitsSheet = getVisitsSheet();
  const visit = findVisitRow(visitsSheet, body.visit_id);
  if (!visit) return { success: false, message: "Visit not found." };

  const requester = resolveRequester(body.requestedBy);
  if (requester.status !== "active") return { success: false, message: "Your account is disabled." };

  const ownerUsername = String(visit.values[visit.headers.indexOf("username")] || "").trim().toLowerCase();
  const isOwner = ownerUsername === String(body.requestedBy || "").trim().toLowerCase();
  if (requester.role !== "admin" && !isOwner) {
    return { success: false, message: "You can only add follow-ups to your own visits." };
  }

  if (!body.followup_date || !body.type || !body.status) {
    return { success: false, message: "Follow-up date, type, and status are required." };
  }

  const sheet = getFollowUpsSheet();
  const headers = getHeaders(sheet);
  const now = new Date();
  const followupId = Utilities.getUuid();

  appendRowByHeaders(sheet, headers, {
    followup_id: followupId,
    visit_id: body.visit_id,
    followup_date: body.followup_date,
    next_followup_date: body.next_followup_date || "",
    type: body.type,
    status: body.status,
    notes: body.notes || "",
    created_by: body.requestedBy,
    created_at: now,
  });

  invalidateVisitsCache();

  const schoolName = visit.values[visit.headers.indexOf("school_name")] || "";
  logActivity(body.requestedBy, "added a follow-up", String(schoolName) + " — " + body.type + " / " + body.status);

  return {
    success: true,
    message: "Follow-up added.",
    data: {
      followup_id: followupId,
      visit_id: body.visit_id,
      followup_date: body.followup_date,
      next_followup_date: body.next_followup_date || "",
      type: body.type,
      status: body.status,
      notes: body.notes || "",
      created_by: body.requestedBy,
      created_at: now.toISOString(),
    },
  };
}

/**
 * Updates a follow-up entry in place. The requester must be an admin
 * or whoever created that specific entry — not merely the parent
 * visit's owner, so a rep can't alter a note an admin added.
 */
function handleUpdateFollowUp(body) {
  const sheet = getFollowUpsSheet();
  const found = findFollowUpRow(sheet, body.followup_id);
  if (!found) return { success: false, message: "Follow-up not found." };

  const requester = resolveRequester(body.requestedBy);
  if (requester.status !== "active") return { success: false, message: "Your account is disabled." };

  const headers = found.headers;
  const createdBy = String(found.values[headers.indexOf("created_by")] || "").trim().toLowerCase();
  const isCreator = createdBy === String(body.requestedBy || "").trim().toLowerCase();
  if (requester.role !== "admin" && !isCreator) {
    return { success: false, message: "You can only edit your own follow-ups." };
  }
  if (found.values[headers.indexOf("deleted")] === "true") {
    return { success: false, message: "This follow-up has been deleted." };
  }

  const editableFields = ["followup_date", "next_followup_date", "type", "status", "notes"];
  editableFields.forEach(function (field) {
    if (body[field] === undefined) return;
    const colIdx = headers.indexOf(field);
    if (colIdx === -1) return;
    sheet.getRange(found.rowIndex, colIdx + 1).setValue(body[field]);
  });

  const updatedByIdx = headers.indexOf("updated_by");
  const updatedAtIdx = headers.indexOf("updated_at");
  if (updatedByIdx !== -1) sheet.getRange(found.rowIndex, updatedByIdx + 1).setValue(body.requestedBy || "");
  if (updatedAtIdx !== -1) sheet.getRange(found.rowIndex, updatedAtIdx + 1).setValue(new Date());

  invalidateVisitsCache();

  logActivity(body.requestedBy, "edited a follow-up", String(body.followup_id || ""));
  return { success: true, message: "Follow-up updated." };
}

/**
 * Soft-deletes a follow-up entry (kept for history, excluded from
 * getFollowUps/getLatestFollowUpMap). Admin or its creator only.
 */
function handleDeleteFollowUp(body) {
  const sheet = getFollowUpsSheet();
  const found = findFollowUpRow(sheet, body.followup_id);
  if (!found) return { success: false, message: "Follow-up not found." };

  const requester = resolveRequester(body.requestedBy);
  if (requester.status !== "active") return { success: false, message: "Your account is disabled." };

  const headers = found.headers;
  const createdBy = String(found.values[headers.indexOf("created_by")] || "").trim().toLowerCase();
  const isCreator = createdBy === String(body.requestedBy || "").trim().toLowerCase();
  if (requester.role !== "admin" && !isCreator) {
    return { success: false, message: "You can only delete your own follow-ups." };
  }

  const deletedIdx = headers.indexOf("deleted");
  const deletedByIdx = headers.indexOf("deleted_by");
  const deletedAtIdx = headers.indexOf("deleted_at");
  if (deletedIdx !== -1) sheet.getRange(found.rowIndex, deletedIdx + 1).setValue("true");
  if (deletedByIdx !== -1) sheet.getRange(found.rowIndex, deletedByIdx + 1).setValue(body.requestedBy || "");
  if (deletedAtIdx !== -1) sheet.getRange(found.rowIndex, deletedAtIdx + 1).setValue(new Date());

  invalidateVisitsCache();

  logActivity(body.requestedBy, "deleted a follow-up", String(body.followup_id || ""));
  return { success: true, message: "Follow-up deleted." };
}

/**
 * True if a visit with the same school_name (case-insensitive) and
 * the same latitude/longitude already exists in the sheet. Takes the
 * already-read raw values so callers don't trigger a second read of
 * the same sheet within one request.
 */
function isDuplicateVisit(raw, headers, schoolName, lat, lng) {
  if (!schoolName || !lat || !lng) return false;

  const schoolIdx = headers.indexOf("school_name");
  const latIdx = headers.indexOf("latitude");
  const lngIdx = headers.indexOf("longitude");
  if (schoolIdx === -1 || latIdx === -1 || lngIdx === -1) return false;
  if (raw.length < 2) return false;

  const normSchool = String(schoolName).trim().toLowerCase();
  const normLat = String(lat).trim();
  const normLng = String(lng).trim();

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const rowSchool = String(row[schoolIdx] || "").trim().toLowerCase();
    const rowLat = String(row[latIdx] || "").trim();
    const rowLng = String(row[lngIdx] || "").trim();
    if (rowSchool === normSchool && rowLat === normLat && rowLng === normLng) {
      return true;
    }
  }
  return false;
}

/**
 * Returns every visit (cross-request cached — see VISITS_CACHE_KEY),
 * as an array of plain objects keyed by the sheet's actual header row
 * (plus a timestamp). Each visit's "followup" field is transparently
 * kept in sync with its Follow-up Timeline: if the visit has follow-up
 * entries, "followup" reflects the most recent entry's
 * next_followup_date instead of the static value captured at visit
 * creation — so every existing consumer of v.followup (dashboards,
 * follow-up buckets) keeps working unchanged while automatically
 * reflecting the richer follow-up system.
 *
 * On a cache hit this skips reading the Visits AND FollowUps sheets
 * entirely, since the cached value is the fully-merged, already-
 * stringified result (no further Date handling is ever needed on it).
 */
function getAllVisitsCached() {
  if (_sheetCache.allVisitsComputed) return _sheetCache.allVisitsComputed;

  let data = cacheGetJson_(VISITS_CACHE_KEY);
  if (!data) {
    data = computeAllVisits();
    cachePutJson_(VISITS_CACHE_KEY, data);
  }
  _sheetCache.allVisitsComputed = data;
  return data;
}

function computeAllVisits() {
  const sheet = getVisitsSheet();
  const raw = sheet ? getVisitsRawValues(sheet) : [];
  if (raw.length < 2) return [];

  const headers = raw[0];
  const rows = raw.slice(1);
  const latestFollowUpByVisit = getLatestFollowUpMap();

  return rows.map((row) => {
    const record = {};
    headers.forEach((header, idx) => {
      let value = row[idx];
      if (value instanceof Date) {
        value = header === "timestamp" || header === "updated_at" || header === "deleted_at"
          ? value.toISOString()
          : formatDate(value);
      }
      record[header] = value;
    });

    const latest = latestFollowUpByVisit[record.visit_id];
    if (latest) {
      record.followup = latest.next_followup_date || record.followup || "";
      record.latest_followup_status = latest.status || "";
    }
    return record;
  });
}

/**
 * Builds a map of visit_id -> most recent (by followup_date) non-
 * deleted follow-up entry, read from the FollowUps sheet in one pass.
 */
function getLatestFollowUpMap() {
  const sheet = getFollowUpsSheet();
  const values = getFollowUpsRawValues(sheet);
  if (values.length < 2) return {};

  const headers = values[0];
  const visitIdIdx = headers.indexOf("visit_id");
  const dateIdx = headers.indexOf("followup_date");
  const nextIdx = headers.indexOf("next_followup_date");
  const statusIdx = headers.indexOf("status");
  const deletedIdx = headers.indexOf("deleted");

  const map = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (deletedIdx !== -1 && row[deletedIdx] === "true") continue;

    const visitId = row[visitIdIdx];
    const dateVal = String(row[dateIdx] || "");
    const existing = map[visitId];
    if (!existing || dateVal > existing.followup_date) {
      map[visitId] = {
        followup_date: dateVal,
        next_followup_date: row[nextIdx],
        status: row[statusIdx],
      };
    }
  }
  return map;
}

// ---------------------------------------------------------------------
// User management (admin only)
// ---------------------------------------------------------------------

/** Sanitized (no password) users list, shared by handleListUsers and the dashboard endpoint. */
function getUsersList() {
  const sheet = getUsersSheet();
  if (!sheet) return [];
  const values = getUsersRawValues(sheet);
  if (values.length < 2) return [];

  const headers = values[0];
  const usernameIdx = headers.indexOf("username");
  const nameIdx = headers.indexOf("name");
  const roleIdx = headers.indexOf("role");
  const statusIdx = headers.indexOf("status");

  return values.slice(1).map(function (row) {
    return {
      username: row[usernameIdx],
      name: row[nameIdx],
      role: row[roleIdx] || "user",
      status: row[statusIdx] || "active",
    };
  });
}

function handleListUsers(e) {
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, message: "Users sheet not found. Run setup() first." };

  const guard = requireAdmin(sheet, e.parameter.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  return { success: true, data: getUsersList() };
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

  invalidateUsersCache();
  logActivity(body.requestedBy, "created a user", username);
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

  invalidateUsersCache();
  logActivity(body.requestedBy, "edited a user", String(body.username || ""));
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

  invalidateUsersCache();
  logActivity(body.requestedBy, status === "disabled" ? "disabled a user" : "enabled a user", String(body.username || ""));
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

  invalidateUsersCache();
  logActivity(body.requestedBy, "deleted a user", String(body.username || ""));
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

  invalidateUsersCache();
  logActivity(body.requestedBy, "changed a password", String(body.username || ""));
  return { success: true, message: "Password reset." };
}

// ---------------------------------------------------------------------
// Activity log (admin only)
// ---------------------------------------------------------------------

/**
 * Best-effort append to the ActivityLog sheet. IP is not available on
 * Apps Script web apps (doGet/doPost expose no caller IP), so it is
 * always recorded as "N/A" rather than faked.
 */
function logActivity(username, action, details) {
  try {
    const sheet = getActivityLogSheet();
    const now = new Date();
    sheet.appendRow([
      now,
      username || "",
      action || "",
      details || "",
      formatDate(now),
      Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss"),
      "N/A",
    ]);
  } catch (err) {
    // Logging must never break the primary action it's attached to.
  }
}

function handleGetActivityLog(e) {
  const guard = requireAdmin(getUsersSheet(), e.parameter.requestedBy);
  if (!guard.ok) return { success: false, message: guard.message };

  const sheet = getActivityLogSheet();
  if (sheet.getLastRow() < 2) return { success: true, data: [] };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const data = values.slice(1).map(function (row) {
    const record = {};
    headers.forEach(function (h, i) {
      let v = row[i];
      if (v instanceof Date) v = v.toISOString();
      record[h] = v;
    });
    return record;
  });

  return { success: true, data: data };
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
