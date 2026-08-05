import { t } from "../i18n/index.js";

export function createSelectionClipboard(deps) {
  const {
    state,
    getCurrentWorkspace,
    allocateId,
    deepClone,
    pushUndo,
    getSuggestedNodePosition,
    clamp,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
    setStatus,
    renderWorkspace,
  } = deps;

  function getSelectedNodeIds() {
    if (state.selectedNodeIds && state.selectedNodeIds.length) {
      return state.selectedNodeIds;
    }
    return state.selectedNodeId ? [state.selectedNodeId] : [];
  }

  function setSelection(nodeIds) {
    const unique = [...new Set(nodeIds.filter(Boolean))];
    state.selectedNodeIds = unique;
    state.selectedNodeId = unique[0] || null;
  }

  function toggleSelectionNode(nodeId) {
    const current = new Set(getSelectedNodeIds());
    if (current.has(nodeId)) {
      current.delete(nodeId);
    } else {
      current.add(nodeId);
    }
    setSelection([...current]);
  }

  function selectSingleNode(nodeId) {
    setSelection([nodeId]);
  }

  function clearSelection() {
    setSelection([]);
    state.quickDeleteNodeId = null;
  }

  function copySelection() {
    const workspace = getCurrentWorkspace();
    const ids = new Set(getSelectedNodeIds());
    if (!ids.size) {
      setStatus(t("status.needSelectCopy"));
      return;
    }
    const nodes = workspace.nodes.filter((node) => ids.has(node.id));
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    state.clipboard = {
      nodes: nodes.map((node) => ({
        data: deepClone(node),
        relX: node.x - minX,
        relY: node.y - minY,
      })),
      wires: workspace.wires
        .filter((wire) => ids.has(wire.fromNodeId) && ids.has(wire.toNodeId))
        .map((wire) => deepClone(wire)),
    };
    setStatus(t("status.copied", { n: nodes.length }));
  }

  function pasteClipboard() {
    if (!state.clipboard || !state.clipboard.nodes.length) {
      setStatus(t("status.nothingPaste"));
      return;
    }
    const workspace = getCurrentWorkspace();
    const anchor = getSuggestedNodePosition(workspace);
    pushUndo();

    const idMap = {};
    const newIds = [];

    state.clipboard.nodes.forEach((entry) => {
      const node = deepClone(entry.data);
      const oldId = node.id;
      node.id = allocateId(state.project, "node");
      node.x = clamp(anchor.x + entry.relX, 24, WORKSPACE_BASE_WIDTH - 140);
      node.y = clamp(anchor.y + entry.relY, 24, WORKSPACE_BASE_HEIGHT - 110);
      idMap[oldId] = node.id;
      workspace.nodes.push(node);
      newIds.push(node.id);
    });

    state.clipboard.wires.forEach((wire) => {
      workspace.wires.push({
        id: allocateId(state.project, "wire"),
        fromNodeId: idMap[wire.fromNodeId],
        fromPin: wire.fromPin,
        toNodeId: idMap[wire.toNodeId],
        toPin: wire.toPin,
      });
    });

    setSelection(newIds);
    setStatus(t("status.pasted", { n: newIds.length }));
    renderWorkspace();
  }

  return {
    getSelectedNodeIds,
    setSelection,
    toggleSelectionNode,
    selectSingleNode,
    clearSelection,
    copySelection,
    pasteClipboard,
  };
}
