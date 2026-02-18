const knownModelsByLower = new Map(); // lower(modelId) -> canonical modelId

let lastUpdatedAtMs = 0;

function normalizeModelId(value) {
  const raw = typeof value === "string" ? value.trim() : String(value || "").trim();
  if (!raw) return null;
  return raw.startsWith("models/") ? raw.slice("models/".length) : raw;
}

function ingestModelId(value) {
  const normalized = normalizeModelId(value);
  if (!normalized) return;
  knownModelsByLower.set(normalized.toLowerCase(), normalized);
}

/**
 * Update in-memory known upstream model IDs based on Cloud Code fetchAvailableModels() response.
 *
 * @param {any} models - Usually an object map: { [modelId]: { quotaInfo?, ... } }
 */
function updateFromFetchAvailableModels(models) {
  if (!models) return;

  if (Array.isArray(models)) {
    for (const entry of models) {
      ingestModelId(entry);
      ingestModelId(entry?.id);
      ingestModelId(entry?.name);
      ingestModelId(entry?.model);
    }
    lastUpdatedAtMs = Date.now();
    return;
  }

  if (typeof models !== "object") return;

  for (const [modelId, info] of Object.entries(models)) {
    ingestModelId(modelId);
    ingestModelId(info?.id);
    ingestModelId(info?.name);
    ingestModelId(info?.model);
  }

  lastUpdatedAtMs = Date.now();
}

function resolveKnownModelId(modelName) {
  const normalized = normalizeModelId(modelName);
  if (!normalized) return null;
  return knownModelsByLower.get(normalized.toLowerCase()) || null;
}

function getKnownModelCount() {
  return knownModelsByLower.size;
}

function getLastUpdatedAt() {
  return lastUpdatedAtMs;
}

module.exports = {
  updateFromFetchAvailableModels,
  resolveKnownModelId,
  getKnownModelCount,
  getLastUpdatedAt,
};

