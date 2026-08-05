export function createInspectorHandlers(deps) {
  const {
    state,
    clampWidth,
    clampSplitWidth,
    normalizeBitString,
    clampRomAddressWidth,
    normalizeRomProgram,
    getCurrentWorkspace,
    pushUndo,
    deleteNode,
    removeWire,
    renderWorkspace,
  } = deps;

  function handleInspectorFocusIn(event) {
    const input = event.target.closest("[data-config-key]");
    if (!input) return;
    if (!state.inspectorUndoPushed) {
      pushUndo();
      state.inspectorUndoPushed = true;
    }
  }

  function handleInspectorInput(event) {
    const input = event.target.closest("[data-config-key]");
    if (!input) {
      return;
    }
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    if (!node) {
      return;
    }

    const key = input.dataset.configKey;
    node.config[key] = input.value;

    if (key === "width") {
      const width = clampWidth(input.value);
      node.config.width = width;
      if (node.type === "switch") {
        node.config.value = normalizeBitString(node.config.value, width);
      }
      if (node.type === "input-pin") {
        node.config.previewValue = normalizeBitString(node.config.previewValue, width);
      }
      if (node.type === "register") {
        node.config.resetValue = normalizeBitString(node.config.resetValue, width);
      }
      if (node.type === "splitter" || node.type === "joiner") {
        node.config.width = Math.max(2, width);
        node.config.highWidth = clampSplitWidth(node.config.highWidth, node.config.width);
      }
    }

    if (node.type === "switch" && key === "value") {
      node.config.value = normalizeBitString(node.config.value, node.config.width);
    }
    if (node.type === "input-pin" && key === "previewValue") {
      node.config.previewValue = normalizeBitString(node.config.previewValue, node.config.width);
    }
    if (node.type === "clock" && key === "value") {
      node.config.value = normalizeBitString(node.config.value, 1);
    }
    if (node.type === "register" && key === "resetValue") {
      node.config.resetValue = normalizeBitString(node.config.resetValue, node.config.width);
    }
    if (node.type === "rom" && key === "addressWidth") {
      node.config.addressWidth = clampRomAddressWidth(input.value);
    }
    if (node.type === "rom" && key === "program") {
      const lines = String(input.value ?? "").split(/\r?\n/);
      node.config.program = normalizeRomProgram(lines);
    }
    if (node.type === "keyboard" && key === "keyCode") {
      node.config.keyCode = normalizeBitString(node.config.keyCode, 16);
    }
    if ((node.type === "splitter" || node.type === "joiner") && key === "highWidth") {
      node.config.highWidth = clampSplitWidth(node.config.highWidth, node.config.width);
    }
    if (node.type === "gate" && key === "gateType") {
      node.config.label = node.config.gateType;
    }

    renderWorkspace();
  }

  function handleInspectorClick(event) {
    const deleteButton = event.target.closest("[data-delete-node]");
    if (deleteButton) {
      deleteNode(deleteButton.dataset.deleteNode);
      return;
    }

    const removeWireButton = event.target.closest("[data-remove-wire]");
    if (removeWireButton) {
      removeWire(removeWireButton.dataset.removeWire);
    }
  }

  return { handleInspectorFocusIn, handleInspectorInput, handleInspectorClick };
}
