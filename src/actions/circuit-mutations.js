import { t } from "../i18n/index.js";

export function createCircuitMutations(deps) {
  const {
    state,
    getCurrentWorkspace,
    getNodeSpec,
    allocateId,
    pushUndo,
    setStatus,
    renderWorkspace,
  } = deps;

  function connectPins(fromNodeId, fromPin, toNodeId, toPin) {
    const workspace = getCurrentWorkspace();
    if (fromNodeId === toNodeId) {
      return { ok: false, message: t("msg.selfConnect") };
    }

    const sourceNode = workspace.nodes.find((node) => node.id === fromNodeId);
    const targetNode = workspace.nodes.find((node) => node.id === toNodeId);
    if (!sourceNode || !targetNode) {
      return { ok: false, message: t("msg.nodesMissing") };
    }

    const sourcePin = getNodeSpec(sourceNode).outputs.find((pin) => pin.key === fromPin);
    const targetPin = getNodeSpec(targetNode).inputs.find((pin) => pin.key === toPin);
    if (!sourcePin || !targetPin) {
      return { ok: false, message: t("msg.invalidPins") };
    }

    if (sourcePin.width !== targetPin.width) {
      return {
        ok: false,
        message: t("msg.widthMismatchWire", { from: sourcePin.width, to: targetPin.width }),
      };
    }

    const existing = workspace.wires.find((wire) => wire.toNodeId === toNodeId && wire.toPin === toPin);
    if (existing) {
      return { ok: false, message: t("msg.pinHasDriver") };
    }

    pushUndo();
    workspace.wires.push({
      id: allocateId(state.project, "wire"),
      fromNodeId,
      fromPin,
      toNodeId,
      toPin,
    });
    const fromLabel = `${sourceNode.config.label || sourceNode.type}.${fromPin}`;
    const toLabel = `${targetNode.config.label || targetNode.type}.${toPin}`;
    return { ok: true, message: t("status.wireConnected", { from: fromLabel, to: toLabel }) };
  }

  function deleteNode(nodeId) {
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    pushUndo();
    workspace.nodes = workspace.nodes.filter((item) => item.id !== nodeId);
    workspace.wires = workspace.wires.filter(
      (wire) => wire.fromNodeId !== nodeId && wire.toNodeId !== nodeId
    );
    state.selectedNodeId = null;
    state.selectedNodeIds = [];
    if (state.quickDeleteNodeId === nodeId) {
      state.quickDeleteNodeId = null;
    }
    state.pendingConnection = null;
    setStatus(t("status.nodeDeleted"));
    renderWorkspace();
  }

  function removeWire(wireId) {
    const workspace = getCurrentWorkspace();
    pushUndo();
    workspace.wires = workspace.wires.filter((wire) => wire.id !== wireId);
    setStatus(t("status.wireRemoved"));
    renderWorkspace();
  }

  function getNodeConnections(workspace, nodeId) {
    return workspace.wires
      .filter((wire) => wire.fromNodeId === nodeId || wire.toNodeId === nodeId)
      .map((wire) => {
        const source = workspace.nodes.find((node) => node.id === wire.fromNodeId);
        const target = workspace.nodes.find((node) => node.id === wire.toNodeId);
        return {
          wireId: wire.id,
          label: `${source ? source.config.label || source.type : wire.fromNodeId}.${wire.fromPin} → ${
            target ? target.config.label || target.type : wire.toNodeId
          }.${wire.toPin}`,
        };
      });
  }

  function handlePinClick(pinElement) {
    const direction = pinElement.dataset.pinDirection;
    const nodeId = pinElement.dataset.nodeId;
    const pinKey = pinElement.dataset.pinKey;

    if (direction === "output") {
      state.pendingConnection = { nodeId, pinKey, direction };
      renderWorkspace();
      return;
    }

    if (direction === "input" && state.pendingConnection) {
      const result = connectPins(
        state.pendingConnection.nodeId,
        state.pendingConnection.pinKey,
        nodeId,
        pinKey
      );
      state.pendingConnection = null;
      setStatus(result.message);
      renderWorkspace();
      return;
    }

    state.pendingConnection = null;
    renderWorkspace();
  }

  return {
    connectPins,
    deleteNode,
    removeWire,
    getNodeConnections,
    handlePinClick,
  };
}
