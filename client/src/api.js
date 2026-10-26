/**
 * PocketGravity API Client v2.0
 * Zero-configuration auto-token capture from URL query parameters.
 */

const STORAGE_KEYS = {
  HOST: "pocketgravity_host",
  TOKEN: "pocketgravity_token",
};

export const DEFAULT_TOKEN = "";

// AUTO-EXTRACT TOKEN FROM URL QUERY IF PRESENT (?token=...)
export function autoCaptureTokenFromUrl() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    if (tokenParam) {
      saveStoredConfig("", tokenParam);
      // Clean URL so token isn't visible in mobile address bar
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return tokenParam;
    }
  } catch (_) {}
  return null;
}

// Run auto-capture immediately on load
autoCaptureTokenFromUrl();

export function getStoredConfig() {
  const host = localStorage.getItem(STORAGE_KEYS.HOST) || "";
  let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) {
    token = DEFAULT_TOKEN;
    if (token) saveStoredConfig(host, token);
  }
  return { host, token: token || "" };
}

export function saveStoredConfig(host, token) {
  if (host !== undefined && host !== null) localStorage.setItem(STORAGE_KEYS.HOST, host.trim());
  if (token !== undefined && token !== null) localStorage.setItem(STORAGE_KEYS.TOKEN, token.trim());
}

export function getBaseApiUrl() {
  const { host } = getStoredConfig();
  if (!host) {
    return ""; // Same origin (e.g. served directly by FastAPI daemon)
  }
  return host.replace(/\/+$/, "");
}

export function getWsUrl() {
  const { host, token } = getStoredConfig();
  let baseWs = "";
  if (host) {
    baseWs = host.replace(/^http/, "ws").replace(/\/+$/, "");
  } else {
    const loc = window.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    baseWs = `${proto}//${loc.host}`;
  }
  return `${baseWs}/ws/terminal?token=${encodeURIComponent(token)}`;
}

async function request(endpoint, options = {}) {
  const { token } = getStoredConfig();
  const url = `${getBaseApiUrl()}${endpoint}`;
  
  const headers = {
    "Accept": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function verifyAuth(testToken, testHost) {
  const host = (testHost !== undefined ? testHost : getBaseApiUrl()).replace(/\/+$/, "");
  const token = testToken !== undefined ? testToken : getStoredConfig().token;
  const url = `${host}/api/auth/verify`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!resp.ok) {
    throw new Error(`Authentication check failed (${resp.status})`);
  }
  return resp.json();
}

export async function getConnectInfo() {
  return request("/api/connect/info");
}

export async function getSystemStatus() {
  return request("/api/system/status");
}

export async function getWorkspaceTree(subpath = "", depth = 4) {
  const params = new URLSearchParams({ subpath, depth: depth.toString() });
  return request(`/api/workspace/tree?${params.toString()}`);
}

export async function getFileContent(filePath) {
  const params = new URLSearchParams({ path: filePath });
  return request(`/api/workspace/file?${params.toString()}`);
}

export async function saveFileContent(filePath, content, createBackup = true) {
  return request("/api/workspace/file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content, create_backup: createBackup }),
  });
}

export function getDownloadUrl(filePath) {
  const { token } = getStoredConfig();
  const params = new URLSearchParams({ path: filePath, token });
  return `${getBaseApiUrl()}/api/workspace/download?${params.toString()}`;
}

export async function getWorkspaceDiff() {
  return request("/api/workspace/diff");
}

export async function executeWorkspaceAction(action, path, newPath = null, content = "") {
  return request("/api/workspace/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, path, new_path: newPath, content }),
  });
}

// --- ANTIGRAVITY CONTROL & LAPTOP DEEP CONTROL APIs ---

export async function getAntigravityStatus() {
  return request("/api/antigravity/status");
}

export async function getAntigravityTranscript(conversationId = null, limit = 30) {
  const params = new URLSearchParams();
  if (conversationId) params.append("conversation_id", conversationId);
  params.append("limit", limit.toString());
  return request(`/api/antigravity/transcript?${params.toString()}`);
}

export async function getAntigravityArtifacts(conversationId = null) {
  const params = new URLSearchParams();
  if (conversationId) params.append("conversation_id", conversationId);
  return request(`/api/antigravity/artifacts?${params.toString()}`);
}

export async function getArtifactContent(name, conversationId = null) {
  const params = new URLSearchParams({ name });
  if (conversationId) params.append("conversation_id", conversationId);
  return request(`/api/antigravity/artifact-content?${params.toString()}`);
}

export async function executeRemoteAction(action, target = null) {
  return request("/api/antigravity/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, target }),
  });
}

export async function launchAntigravityOnLaptop(folder = null) {
  return request("/api/antigravity/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
}

export async function closeAntigravityOnLaptop(folder = null, closeAll = false) {
  return request("/api/antigravity/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, close_all: closeAll }),
  });
}

export async function getActiveDevPorts() {
  return request("/api/proxy/ports");
}

export function getLocalhostProxyUrl(port, path = "") {
  const cleanPath = path.replace(/^\/+/, "");
  return `${getBaseApiUrl()}/api/proxy/${port}/${cleanPath}`;
}

export async function getClaudeStatus() {
  return request("/api/claude/status");
}



export function getClaudeWsUrl() {
  const { host, token } = getStoredConfig();
  let baseWs = "";
  if (host) {
    baseWs = host.replace(/^http/, "ws").replace(/\/+$/, "");
  } else {
    const loc = window.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    baseWs = `${proto}//${loc.host}`;
  }
  return `${baseWs}/api/claude/ws?token=${encodeURIComponent(token)}`;
}

export async function getAvailableFolders() {
  return request("/api/workspace/folders");
}

export async function getCurrentFolder() {
  return request("/api/workspace/current");
}

export async function openProjectFolder(path, launchAntigravity = true) {
  return request("/api/workspace/open-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, launch_antigravity: launchAntigravity }),
  });
}

export async function getAgentOptions() {
  return request("/api/antigravity/options");
}


export function getScreenshotUrl(quality = 65) {
  const { token } = getStoredConfig();
  const base = getBaseApiUrl();
  return `${base}/api/desktop/screenshot?quality=${quality}&token=${encodeURIComponent(token)}`;
}

export async function getClaudeConversation(limit = 40, folder = null) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (folder) params.append("folder", folder);
  return request(`/api/claude/conversation?${params.toString()}`);
}

export async function runClaudePrompt(prompt, folder = null, dangerouslySkipPermissions = false) {
  return request("/api/claude/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, folder, dangerously_skip_permissions: dangerouslySkipPermissions, inject_window: true }),
  });
}

export async function getAgentConversation(limitOrConvId = 40, conversationId = null, folder = null) {
  let limit = 40;
  let convId = null;
  let targetFolder = folder;

  if (typeof limitOrConvId === "number") {
    limit = limitOrConvId;
    convId = conversationId;
  } else if (typeof limitOrConvId === "string") {
    if (limitOrConvId.length > 25) {
      convId = limitOrConvId;
    } else {
      targetFolder = limitOrConvId;
    }
    if (typeof conversationId === "number") limit = conversationId;
  }

  const params = new URLSearchParams({ limit: limit.toString() });
  if (convId) params.append("conversation_id", convId);
  if (targetFolder) params.append("folder", targetFolder);

  return request(`/api/antigravity/conversation?${params.toString()}`);
}

export async function dispatchAntigravityPrompt(prompt, mode = "agent", model = "Gemini 3.8 Flash (High)", effort = "High", folder = null) {
  return request("/api/antigravity/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, mode, model, effort, folder }),
  });
}


