import { t } from "../i18n/index.js";

export function createUndoManager(deps) {
  const { state, deepClone, getCurrentWorkspace, setStatus, renderWorkspace, dom, limit = 50 } = deps;

  function pushUndo() {
    const workspace = getCurrentWorkspace();
    if (!workspace) return;
    state.undoStack.push({
      workspaceId: workspace.id,
      snapshot: deepClone(workspace),
    });
    if (state.undoStack.length > limit) {
      state.undoStack.shift();
    }
    state.redoStack = [];
    state.inspectorUndoPushed = false;
  }

  function undo() {
    if (!state.undoStack.length) return;
    const entry = state.undoStack.pop();
    const workspace = state.project.workspaces.find((w) => w.id === entry.workspaceId);
    if (!workspace) return;
    state.redoStack.push({
      workspaceId: workspace.id,
      snapshot: deepClone(workspace),
    });
    Object.assign(workspace, entry.snapshot);
    state.selectedNodeId = null;
    state.pendingConnection = null;
    state.quickDeleteNodeId = null;
    state.inspectorUndoPushed = false;
    setStatus(t("status.undo"));
    renderWorkspace();
  }

  function redo() {
    if (!state.redoStack.length) return;
    const entry = state.redoStack.pop();
    const workspace = state.project.workspaces.find((w) => w.id === entry.workspaceId);
    if (!workspace) return;
    state.undoStack.push({
      workspaceId: workspace.id,
      snapshot: deepClone(workspace),
    });
    Object.assign(workspace, entry.snapshot);
    state.selectedNodeId = null;
    state.pendingConnection = null;
    state.quickDeleteNodeId = null;
    state.inspectorUndoPushed = false;
    setStatus(t("status.redo"));
    renderWorkspace();
  }

  function updateUndoRedoButtons() {
    dom.undoButton.disabled = state.undoStack.length === 0;
    dom.redoButton.disabled = state.redoStack.length === 0;
  }

  return { pushUndo, undo, redo, updateUndoRedoButtons };
}
