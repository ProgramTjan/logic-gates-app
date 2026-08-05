import {
  createDefaultLearner,
  deriveCompletedChallengeIds,
  normalizeLearner,
} from "../data/curriculum.js";
import { CHALLENGES } from "../data/challenges.js";

export const STORAGE_KEY = "forge-logic-project-v2";
export const BACKUP_KEYS = [
  "forge-logic-backup-1",
  "forge-logic-backup-2",
  "forge-logic-backup-3",
];
export const BACKUP_META_KEY = "forge-logic-backup-meta";
/** Rotate a new backup slot at most once per 2 minutes (debounced saves stay cheap). */
export const BACKUP_INTERVAL_MS = 2 * 60 * 1000;

export function createProject(deps) {
  const project = {
    nextId: 1,
    currentWorkspaceId: null,
    workspaces: [],
    chipSeries: [],
    chipDefinitions: [],
    runtime: { registerStates: {} },
    learner: createDefaultLearner(),
  };

  const workspace = deps.createWorkspace(project, "Main Workspace");
  project.workspaces.push(workspace);
  project.currentWorkspaceId = workspace.id;
  deps.ensureStarterChips(project);
  return project;
}

export function loadProject(deps, storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return createProject(deps);
    }
    return normalizeProject(JSON.parse(raw), deps);
  } catch (error) {
    console.warn("Kon projectstate niet laden, fallback naar nieuw project.", error);
    return createProject(deps);
  }
}

export function isQuotaExceededError(error) {
  if (!error) {
    return false;
  }
  return (
    error.name === "QuotaExceededError" ||
    error.code === 22 ||
    error.code === 1014 ||
    /quota/i.test(String(error.message || ""))
  );
}

/**
 * Save project to STORAGE_KEY. Optionally rotates backups (max 1× / BACKUP_INTERVAL_MS).
 * @returns {{ ok: true } | { ok: false, reason: "quota" }}
 */
export function saveProject(project, storage, options = {}) {
  const now = typeof options.now === "number" ? options.now : Date.now();
  const payload = JSON.stringify(project);

  try {
    try {
      maybeRotateBackups(storage, project, now);
    } catch (backupError) {
      if (!isQuotaExceededError(backupError)) {
        throw backupError;
      }
    }
    storage.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return { ok: false, reason: "quota" };
    }
    throw error;
  }
}

export function maybeRotateBackups(storage, project, now = Date.now()) {
  const lastRotatedAt = readLastRotatedAt(storage);
  if (lastRotatedAt > 0 && now - lastRotatedAt < BACKUP_INTERVAL_MS) {
    return false;
  }

  const entry = JSON.stringify({
    savedAt: new Date(now).toISOString(),
    workspaceCount: Array.isArray(project.workspaces) ? project.workspaces.length : 0,
    project,
  });

  const previous1 = storage.getItem(BACKUP_KEYS[0]);
  const previous2 = storage.getItem(BACKUP_KEYS[1]);
  if (previous2 != null) {
    storage.setItem(BACKUP_KEYS[2], previous2);
  }
  if (previous1 != null) {
    storage.setItem(BACKUP_KEYS[1], previous1);
  }
  storage.setItem(BACKUP_KEYS[0], entry);
  storage.setItem(BACKUP_META_KEY, JSON.stringify({ lastRotatedAt: now }));
  return true;
}

export function listBackups(storage) {
  const backups = [];
  for (let index = 0; index < BACKUP_KEYS.length; index += 1) {
    const key = BACKUP_KEYS[index];
    const raw = storage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.project) {
        continue;
      }
      backups.push({
        slot: index + 1,
        key,
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
        workspaceCount: Number.isFinite(Number(parsed.workspaceCount))
          ? Number(parsed.workspaceCount)
          : Array.isArray(parsed.project.workspaces)
            ? parsed.project.workspaces.length
            : 0,
      });
    } catch {
      // skip corrupt slot
    }
  }
  return backups;
}

export function readBackupProject(storage, slot) {
  const key = BACKUP_KEYS[slot - 1];
  if (!key) {
    return null;
  }
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed.project : null;
  } catch {
    return null;
  }
}

/**
 * Restore backup slot into STORAGE_KEY (does not rotate backups).
 * @returns {object|null} normalized project
 */
export function restoreBackup(storage, slot, deps) {
  const project = readBackupProject(storage, slot);
  if (!project) {
    return null;
  }
  const normalized = normalizeProject(project, deps);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function readLastRotatedAt(storage) {
  try {
    const raw = storage.getItem(BACKUP_META_KEY);
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw);
    return Number.isFinite(Number(parsed?.lastRotatedAt)) ? Number(parsed.lastRotatedAt) : 0;
  } catch {
    return 0;
  }
}

export function normalizeProject(project, deps) {
  if (!project || typeof project !== "object") {
    return createProject(deps);
  }

  const normalized = {
    nextId: Number.isInteger(project.nextId) && project.nextId > 0 ? project.nextId : 1,
    currentWorkspaceId: project.currentWorkspaceId || null,
    workspaces: [],
    chipSeries: [],
    chipDefinitions: [],
    runtime: { registerStates: {} },
    learner: createDefaultLearner(),
  };

  normalized.workspaces = Array.isArray(project.workspaces)
    ? project.workspaces.map((workspace) => normalizeWorkspace(workspace, deps))
    : [];

  if (!normalized.workspaces.length) {
    const workspace = deps.createWorkspace(normalized, "Main Workspace");
    normalized.workspaces.push(workspace);
    normalized.currentWorkspaceId = workspace.id;
  }

  if (!normalized.currentWorkspaceId) {
    normalized.currentWorkspaceId = normalized.workspaces[0].id;
  } else if (!normalized.workspaces.some((workspace) => workspace.id === normalized.currentWorkspaceId)) {
    normalized.currentWorkspaceId = normalized.workspaces[0].id;
  }

  normalized.chipSeries = Array.isArray(project.chipSeries)
    ? project.chipSeries
        .filter((series) => series && series.id)
        .map((series) => ({
          id: String(series.id),
          name: String(series.name || "Untitled Chip"),
          definitionIds: Array.isArray(series.definitionIds)
            ? series.definitionIds.map((definitionId) => String(definitionId))
            : [],
        }))
    : [];

  normalized.chipDefinitions = Array.isArray(project.chipDefinitions)
    ? project.chipDefinitions
        .filter((definition) => definition && definition.id)
        .map((definition) => ({
          id: String(definition.id),
          seriesId: String(definition.seriesId || ""),
          name: String(definition.name || "Untitled Chip"),
          version: Number.isInteger(definition.version) && definition.version > 0 ? definition.version : 1,
          description: String(definition.description || ""),
          inputs: normalizePins(definition.inputs),
          outputs: normalizePins(definition.outputs),
          createdAt: definition.createdAt || new Date().toISOString(),
          circuitSnapshot: normalizeWorkspace(definition.circuitSnapshot, deps),
        }))
    : [];

  const registerStates =
    project.runtime && project.runtime.registerStates && typeof project.runtime.registerStates === "object"
      ? project.runtime.registerStates
      : {};
  normalized.runtime.registerStates = { ...registerStates };

  deps.ensureStarterChips(normalized);

  normalized.learner = normalizeLearner(project.learner, {
    deriveCompletedChallengeIds: () => {
      if (typeof deps.deriveCompletedChallengeIds === "function") {
        return deps.deriveCompletedChallengeIds(normalized);
      }
      if (typeof deps.evaluateChallengeResult !== "function") {
        return [];
      }
      const isStarter =
        typeof deps.isStarterDefinition === "function"
          ? deps.isStarterDefinition
          : () => false;
      const userDefinitions = normalized.chipDefinitions.filter((definition) => !isStarter(definition));
      return deriveCompletedChallengeIds(CHALLENGES, userDefinitions, deps.evaluateChallengeResult);
    },
  });

  return normalized;
}

export function normalizeWorkspace(workspace, deps) {
  const value = workspace && typeof workspace === "object" ? workspace : {};
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const wires = Array.isArray(value.wires) ? value.wires : [];
  return {
    id: value.id ? String(value.id) : `ws-${Date.now()}`,
    name: String(value.name || "Workspace"),
    nodes: nodes.map((node) => deps.normalizeNode(node)),
    wires: wires
      .filter((wire) => wire && wire.id && wire.fromNodeId && wire.toNodeId && wire.fromPin && wire.toPin)
      .map((wire) => ({
        id: String(wire.id),
        fromNodeId: String(wire.fromNodeId),
        fromPin: String(wire.fromPin),
        toNodeId: String(wire.toNodeId),
        toPin: String(wire.toPin),
      })),
    createdAt: value.createdAt || new Date().toISOString(),
    meta: normalizeWorkspaceMeta(value.meta),
  };
}

export function normalizeWorkspaceMeta(meta) {
  const source = meta && typeof meta === "object" ? { ...meta } : {};
  if (source.challengeId != null) {
    source.challengeId = String(source.challengeId);
  }
  if (source.sourceDefinitionId != null) {
    source.sourceDefinitionId = String(source.sourceDefinitionId);
  }
  source.isStarter = Boolean(source.isStarter);
  return source;
}

function normalizePins(pins) {
  if (!Array.isArray(pins)) {
    return [];
  }
  return pins
    .filter((pin) => pin && pin.key)
    .map((pin) => ({
      key: String(pin.key),
      name: String(pin.name || pin.key),
      width: Number.isFinite(Number(pin.width)) ? Number(pin.width) : 1,
    }));
}
