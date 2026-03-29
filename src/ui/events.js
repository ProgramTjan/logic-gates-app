export function createInteractionHandlers(deps) {
  const {
    dom,
    state,
    render,
    pushUndo,
    getCurrentWorkspace,
    deleteNode,
    removeWire,
    toggleSwitchNode,
    toggleClockNode,
    toggleInputPinNode,
    handlePinClick,
    evaluateWorkspace,
    canvasRenderers,
    longPressDelay,
    longPressMoveThreshold,
  } = deps;

  function startNodeLongPress(nodeId, pointerId, clientX, clientY) {
    clearLongPress();
    state.longPress = {
      nodeId,
      pointerId,
      startClientX: clientX,
      startClientY: clientY,
      timerId: window.setTimeout(() => {
        if (!state.longPress || state.longPress.nodeId !== nodeId || state.longPress.pointerId !== pointerId) {
          return;
        }
        state.quickDeleteNodeId = nodeId;
        state.dragging = null;
        state.longPress = null;
        render();
      }, longPressDelay),
    };
  }

  function clearLongPress(pointerId) {
    if (!state.longPress) {
      return;
    }
    if (pointerId != null && state.longPress.pointerId !== pointerId) {
      return;
    }
    window.clearTimeout(state.longPress.timerId);
    state.longPress = null;
  }

  function handleNodeLayerClick(event) {
    const quickDeleteButton = event.target.closest("[data-quick-delete-node]");
    if (quickDeleteButton) {
      deleteNode(quickDeleteButton.dataset.quickDeleteNode);
      return;
    }

    const actionButton = event.target.closest("[data-node-action]");
    if (actionButton) {
      const node = getCurrentWorkspace().nodes.find((item) => item.id === actionButton.dataset.nodeId);
      if (!node) {
        return;
      }
      if (actionButton.dataset.nodeAction === "toggle-switch") {
        toggleSwitchNode(node);
      } else if (actionButton.dataset.nodeAction === "toggle-clock") {
        toggleClockNode(node);
      } else if (actionButton.dataset.nodeAction === "toggle-input-pin") {
        toggleInputPinNode(node);
      }
      render();
      return;
    }

    const pin = event.target.closest("[data-pin-direction]");
    if (pin) {
      handlePinClick(pin);
      return;
    }

    const nodeElement = event.target.closest("[data-node-id]");
    if (nodeElement) {
      state.selectedNodeId = nodeElement.dataset.nodeId;
      if (state.quickDeleteNodeId && state.quickDeleteNodeId !== nodeElement.dataset.nodeId) {
        state.quickDeleteNodeId = null;
      }
      render();
      return;
    }

    state.selectedNodeId = null;
    state.quickDeleteNodeId = null;
    render();
  }

  function handleNodeLayerPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (
      event.target.closest("[data-pin-direction]") ||
      event.target.closest("[data-node-action]") ||
      event.target.closest("[data-quick-delete-node]")
    ) {
      return;
    }
    const surface = event.target.closest("[data-drag-surface]");
    if (!surface) {
      return;
    }
    const nodeId = surface.dataset.nodeId;
    const node = getCurrentWorkspace().nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    state.selectedNodeId = nodeId;
    state.quickDeleteNodeId = null;
    pushUndo();
    state.dragging = {
      nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    };
    if (surface.setPointerCapture) {
      surface.setPointerCapture(event.pointerId);
    }
    startNodeLongPress(nodeId, event.pointerId, event.clientX, event.clientY);
  }

  function handleCanvasPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest("[data-node-id]") || event.target.closest("[data-pin-direction]")) {
      return;
    }
    event.preventDefault();
    clearLongPress();
    const hadQuickDelete = Boolean(state.quickDeleteNodeId);
    state.quickDeleteNodeId = null;
    state.panningCanvas = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: dom.canvas.scrollLeft,
      startScrollTop: dom.canvas.scrollTop,
    };
    if (hadQuickDelete) {
      render();
    }
  }

  function handleDragMove(event) {
    if (state.longPressWire && event.pointerId === state.longPressWire.pointerId) {
      const distance = Math.hypot(
        event.clientX - state.longPressWire.startClientX,
        event.clientY - state.longPressWire.startClientY
      );
      if (distance > longPressMoveThreshold) {
        clearWireLongPress(event.pointerId);
      }
    }

    if (state.dragging && event.pointerId === state.dragging.pointerId) {
      const workspace = getCurrentWorkspace();
      const node = workspace.nodes.find((item) => item.id === state.dragging.nodeId);
      if (!node) {
        return;
      }
      event.preventDefault();
      const deltaX = event.clientX - state.dragging.startClientX;
      const deltaY = event.clientY - state.dragging.startClientY;
      if (state.longPress && state.longPress.pointerId === event.pointerId) {
        const distance = Math.hypot(
          event.clientX - state.longPress.startClientX,
          event.clientY - state.longPress.startClientY
        );
        if (distance <= longPressMoveThreshold) {
          return;
        }
        clearLongPress(event.pointerId);
      }
      node.x = Math.max(20, state.dragging.startNodeX + deltaX / state.zoom);
      node.y = Math.max(20, state.dragging.startNodeY + deltaY / state.zoom);
      syncDraggedNodePosition(node);
      canvasRenderers.renderWires(
        getCurrentWorkspace(),
        state.lastEvaluation || evaluateWorkspace(getCurrentWorkspace())
      );
      return;
    }

    if (state.panningCanvas && event.pointerId === state.panningCanvas.pointerId) {
      event.preventDefault();
      const deltaX = event.clientX - state.panningCanvas.startClientX;
      const deltaY = event.clientY - state.panningCanvas.startClientY;
      dom.canvas.scrollLeft = state.panningCanvas.startScrollLeft - deltaX;
      dom.canvas.scrollTop = state.panningCanvas.startScrollTop - deltaY;
    }
  }

  function stopDragging(event) {
    clearWireLongPress(event ? event.pointerId : null);

    if (state.dragging) {
      if (event && event.pointerId != null && event.pointerId !== state.dragging.pointerId) {
        return;
      }
      const wasMoved =
        event &&
        (Math.abs(event.clientX - state.dragging.startClientX) > 2 ||
          Math.abs(event.clientY - state.dragging.startClientY) > 2);
      if (!wasMoved && state.undoStack.length) {
        state.undoStack.pop();
      }
      clearLongPress(event ? event.pointerId : null);
      state.dragging = null;
      render();
      return;
    }

    if (state.panningCanvas) {
      if (event && event.pointerId != null && event.pointerId !== state.panningCanvas.pointerId) {
        return;
      }
      state.panningCanvas = null;
    }
    clearLongPress(event ? event.pointerId : null);
  }

  function startWireLongPress(wireId, pointerId, clientX, clientY) {
    clearWireLongPress();
    state.longPressWire = {
      wireId,
      pointerId,
      startClientX: clientX,
      startClientY: clientY,
      timerId: window.setTimeout(() => {
        if (!state.longPressWire || state.longPressWire.wireId !== wireId) {
          return;
        }
        state.quickDeleteWireId = wireId;
        state.longPressWire = null;
        render();
      }, longPressDelay),
    };
  }

  function clearWireLongPress(pointerId) {
    if (!state.longPressWire) {
      return;
    }
    if (pointerId != null && state.longPressWire.pointerId !== pointerId) {
      return;
    }
    window.clearTimeout(state.longPressWire.timerId);
    state.longPressWire = null;
  }

  function handleWirePointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest("[data-quick-delete-wire]")) {
      return;
    }
    const wireEl = event.target.closest("[data-wire-id]");
    if (!wireEl) {
      return;
    }
    event.stopPropagation();
    startWireLongPress(wireEl.dataset.wireId, event.pointerId, event.clientX, event.clientY);
  }

  function handleWireClick(event) {
    const deleteBtn = event.target.closest("[data-quick-delete-wire]");
    if (deleteBtn) {
      removeWire(deleteBtn.dataset.quickDeleteWire);
      return;
    }
    if (state.quickDeleteWireId) {
      state.quickDeleteWireId = null;
      render();
    }
  }

  function syncDraggedNodePosition(node) {
    const element = dom.nodeLayer.querySelector(`article[data-node-id="${node.id}"]`);
    if (!element) {
      return;
    }
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
  }

  return {
    clearLongPress,
    handleCanvasPointerDown,
    handleDragMove,
    handleNodeLayerClick,
    handleNodeLayerPointerDown,
    handleWirePointerDown,
    handleWireClick,
    stopDragging,
  };
}
