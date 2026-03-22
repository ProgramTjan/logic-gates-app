const STORAGE_KEY = "forge-logic-project-v2";

export function createProject(deps) {
  const project = {
    nextId: 1,
    currentWorkspaceId: null,
    workspaces: [],
    chipSeries: [],
    chipDefinitions: [],
    runtime: { registerStates: {} },
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

export function saveProject(project, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(project));
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
