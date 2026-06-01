// daw-api.jsx — Centralised fetch wrapper for the DAW RPG backend.
// Exposes a single window.DAW_API object whose methods map 1-to-1 to backend
// REST endpoints. All communication goes through the internal apiCall helper,
// which handles JSON serialisation, error normalisation, and 204 No-Content
// responses. This file must be loaded before any other game script that
// needs to reach the server.

// Base URL for every API request.
// In production the frontend and API are served from the same origin,
// so an empty string makes all requests relative (no CORS, no port juggling).
// Override with a full URL for local development against a separate API server.
const DAW_API_BASE = (typeof window !== 'undefined' && window.DAW_API_BASE_OVERRIDE)
  ? window.DAW_API_BASE_OVERRIDE
  : '';

// Internal helper that performs every fetch request.
// method  — HTTP verb string ('GET', 'POST', 'PUT', 'PATCH', 'DELETE').
// path    — URL path (and query string) appended to DAW_API_BASE.
// body    — optional JS value serialised as JSON; omit for GET/DELETE.
// Returns the parsed JSON response, or null for 204 No-Content.
// Throws an Error with .status and .data set for any non-2xx response.
async function apiCall(method, path, body) {
  // Build fetch options; only attach a body when the caller supplied one.
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(DAW_API_BASE + path, opts);

  // 204 means success with no response body — return null instead of trying to parse.
  if (res.status === 204) return null;

  // Try to parse JSON; fall back to a plain error object if the body is not valid JSON.
  const json = await res.json().catch(() => ({ error: res.statusText }));

  // Treat any non-2xx status as an exception so callers can use try/catch.
  if (!res.ok) {
    const err = new Error(json.error || res.statusText);
    err.status = res.status; // attach the HTTP status code for programmatic handling
    err.data = json;         // attach the full response body for richer error messages
    throw err;
  }
  return json;
}

// Public API surface. Each property is a thin wrapper around apiCall that
// names the correct HTTP verb and endpoint path for a specific domain operation.
const DAW_API = {
  // ── Auth ──────────────────────────────────────────────────────

  // Create a new account; email is optional and sent as null when omitted.
  register(username, email, password) {
    return apiCall('POST', '/api/auth/register', { username, email: email || null, password });
  },

  // Authenticate an existing account and receive session credentials.
  login(username, password) {
    return apiCall('POST', '/api/auth/login', { username, password });
  },

  // Re-trigger the email verification message for an account that never verified.
  resendVerification(accountId) {
    return apiCall('POST', `/api/auth/resend-verification?accountId=${accountId}`);
  },

  // ── Admin ─────────────────────────────────────────────────────

  // Fetch the full list of registered users; requesterId must be an admin account.
  adminGetUsers(requesterId) {
    return apiCall('GET', `/api/admin/users?requesterId=${requesterId}`);
  },

  // Fetch a single user by their id; requesterId must be an admin account.
  adminGetUser(id, requesterId) {
    return apiCall('GET', `/api/admin/users/${id}?requesterId=${requesterId}`);
  },

  // Partially update a user record (e.g. role, verified flag); requesterId must be admin.
  adminUpdateUser(id, requesterId, data) {
    return apiCall('PATCH', `/api/admin/users/${id}?requesterId=${requesterId}`, data);
  },

  // Seed initial game data for a specific username; requesterId must be admin.
  adminSeed(requesterId, username) {
    return apiCall('POST', `/api/admin/seed?requesterId=${requesterId}&username=${encodeURIComponent(username)}`);
  },

  // ── Player progress ───────────────────────────────────────────

  // Retrieve a player's full profile and progress snapshot by account id.
  getPlayer(accountId) {
    return apiCall('GET', `/api/players/${accountId}`);
  },

  // Check whether an account holds admin privileges.
  getAdminStatus(accountId) {
    return apiCall('GET', `/api/admin/status?id=${accountId}`);
  },

  // Persist the player's current game state (inventory, level, flags, etc.).
  saveProgress(accountId, data) {
    return apiCall('PUT', `/api/players/${accountId}/progress`, data);
  },

  // ── Reference data ────────────────────────────────────────────

  // Load the full enemy catalogue used to populate battles and the bestiary.
  getEnemies() {
    return apiCall('GET', '/api/enemies');
  },

  // ── Community mods ────────────────────────────────────────────

  // Return a paginated list of published community mods.
  listMods(page = 1, pageSize = 100) {
    return apiCall('GET', `/api/mods?page=${page}&pageSize=${pageSize}`);
  },

  // Fetch a single mod's full definition by its id.
  getMod(id) {
    return apiCall('GET', `/api/mods/${id}`);
  },

  // Publish a new mod on behalf of authorId; data contains the mod payload.
  createMod(authorId, data) {
    return apiCall('POST', `/api/mods?authorId=${authorId}`, data);
  },

  // Replace a mod's definition; requesterId must be the author or an admin.
  updateMod(id, requesterId, data) {
    return apiCall('PUT', `/api/mods/${id}?requesterId=${requesterId}`, data);
  },

  // Permanently delete a mod; requesterId must be the author or an admin.
  deleteMod(id, requesterId) {
    return apiCall('DELETE', `/api/mods/${id}?requesterId=${requesterId}`);
  },

  // Increment the play-count counter for a mod (called when a player starts it).
  recordPlay(id) {
    return apiCall('POST', `/api/mods/${id}/play`);
  },

  // Submit a numeric rating (1–5) for a mod from a specific account.
  rateMod(id, accountId, rating) {
    return apiCall('POST', `/api/mods/${id}/rate?accountId=${accountId}`, { rating });
  },

  // ── Sprite overrides ─────────────────────────────────────────

  // Retrieve the current admin-defined sprite palette/grid overrides.
  getSprites() {
    return apiCall('GET', '/api/admin/sprites');
  },

  // Replace all sprite overrides in one shot; requesterId must be admin.
  updateSprites(requesterId, data) {
    return apiCall('PUT', `/api/admin/sprites?requesterId=${requesterId}`, data);
  },

  // ── Social (follow / followers) ───────────────────────────────

  // Create a follow relationship from followerId to targetId.
  follow(followerId, targetId) {
    return apiCall('POST', `/api/social/follow?followerId=${followerId}&targetId=${targetId}`);
  },

  // Remove an existing follow relationship.
  unfollow(followerId, targetId) {
    return apiCall('DELETE', `/api/social/unfollow?followerId=${followerId}&targetId=${targetId}`);
  },

  // Return the full profiles of accounts that accountId is following.
  getFollowing(accountId) {
    return apiCall('GET', `/api/social/following/${accountId}`);
  },

  // Return the full profiles of accounts that follow accountId.
  getFollowers(accountId) {
    return apiCall('GET', `/api/social/followers/${accountId}`);
  },

  // Return only the ids of accounts that accountId is following (lighter payload).
  getFollowingIds(accountId) {
    return apiCall('GET', `/api/social/following-ids/${accountId}`);
  },

  // Check whether followerId is currently following targetId; returns a boolean result.
  isFollowing(followerId, targetId) {
    return apiCall('GET', `/api/social/is-following?followerId=${followerId}&targetId=${targetId}`);
  },
};

// Attach DAW_API to the global window so every game module can access it without imports.
Object.assign(window, { DAW_API });
