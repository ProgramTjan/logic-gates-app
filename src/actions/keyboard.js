import { t } from "../i18n/index.js";

export function createKeyboardHandlers(deps) {
  const {
    state,
    getCurrentWorkspace,
    pushUndo,
    undo,
    redo,
    duplicateSelectedNode,
    deleteNode,
    copySelection,
    pasteClipboard,
    setSelection,
    setStatus,
    renderWorkspace,
    clamp,
    normalizeBitString,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
  } = deps;

  function handleKeyboardShortcuts(event) {
    const tagName = document.activeElement ? document.activeElement.tagName : "";
    const inInput = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";

    const ctrl = event.ctrlKey || event.metaKey;

    if (event.key === "Escape" && state.keyboardCaptureNodeId) {
      event.preventDefault();
      state.keyboardCaptureNodeId = null;
      renderWorkspace();
      return;
    }

    if (event.key === "Escape" && state.pendingConnection) {
      event.preventDefault();
      state.pendingConnection = null;
      renderWorkspace();
      return;
    }

    if (state.keyboardCaptureNodeId && !inInput && !ctrl) {
      const workspace = getCurrentWorkspace();
      const node = workspace.nodes.find((item) => item.id === state.keyboardCaptureNodeId);
      if (node && node.type === "keyboard") {
        if (event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta") {
          return;
        }
        event.preventDefault();
        const code =
          event.key.length === 1 ? event.key.charCodeAt(0) : Number(event.keyCode) || 0;
        node.config.keyCode = normalizeBitString(Number(code).toString(2), 16);
        renderWorkspace();
        return;
      }
    }

    if (ctrl && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }

    if (ctrl && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
      event.preventDefault();
      redo();
      return;
    }

    if (inInput) return;

    if (ctrl && (event.key === "a" || event.key === "A")) {
      event.preventDefault();
      const workspace = getCurrentWorkspace();
      const ids = workspace.nodes.map((node) => node.id);
      setSelection(ids);
      setStatus(
        ids.length
          ? t("status.selectedAll", { n: ids.length })
          : t("status.noNodes")
      );
      renderWorkspace();
      return;
    }

    if (ctrl && (event.key === "c" || event.key === "C")) {
      event.preventDefault();
      copySelection();
      return;
    }

    if (ctrl && (event.key === "v" || event.key === "V")) {
      event.preventDefault();
      pasteClipboard();
      return;
    }

    if (ctrl && (event.key === "d" || event.key === "D")) {
      event.preventDefault();
      duplicateSelectedNode();
      return;
    }

    const step = event.shiftKey ? 16 : 8;
    const arrowDx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const arrowDy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if ((arrowDx || arrowDy) && state.selectedNodeId) {
      event.preventDefault();
      const workspace = getCurrentWorkspace();
      const node = workspace.nodes.find((item) => item.id === state.selectedNodeId);
      if (node) {
        pushUndo();
        node.x = clamp((Number(node.x) || 0) + arrowDx, 24, WORKSPACE_BASE_WIDTH - 140);
        node.y = clamp((Number(node.y) || 0) + arrowDy, 24, WORKSPACE_BASE_HEIGHT - 110);
        renderWorkspace();
      }
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      if (state.selectedNodeId) {
        deleteNode(state.selectedNodeId);
      }
    }
  }

  return { handleKeyboardShortcuts };
}
