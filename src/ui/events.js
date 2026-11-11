export function createInteractionHandlers(deps) {
  const {
    dom,
    state,
    renderWorkspace,
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
    selectSingleNode,
    toggleSelectionNode,
    clearSelection,
    setSelection,
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
        renderWorkspace();
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
    // Na een marquee-selectie volgt nog een click op de lege canvas; die mag
    // de zojuist gemaakte selectie niet wissen.
    if (suppressNextLayerClick) {
      suppressNextLayerClick = false;
      return;
    }

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
      renderWorkspace();
      return;
    }

    const pin = event.target.closest("[data-pin-direction]");
    if (pin) {
      handlePinClick(pin);
      return;
    }

    const nodeElement = event.target.closest("[data-node-id]");
    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;
      if (event.shiftKey) {
        toggleSelectionNode(nodeId);
      } else {
        selectSingleNode(nodeId);
      }
      const selected = getCurrentWorkspace().nodes.find((item) => item.id === nodeId);
      state.keyboardCaptureNodeId = selected && selected.type === "keyboard" ? nodeId : null;
      if (state.quickDeleteNodeId && !getSelectedNodeIds().includes(state.quickDeleteNodeId)) {
        state.quickDeleteNodeId = null;
      }
      renderWorkspace();
      return;
    }

    clearSelection();
    state.keyboardCaptureNodeId = null;
    renderWorkspace();
  }

  function getSelectedNodeIds() {
    if (state.selectedNodeIds && state.selectedNodeIds.length) {
      return state.selectedNodeIds;
    }
    return state.selectedNodeId ? [state.selectedNodeId] : [];
  }

  // Draad slepen: pointerdown op een uitgang start een pending verbinding. Onder 8px beweging
  // blijft het een gewone klik (klik-klik werkt nog); verder slepen eindigt op een ingang of annuleert.
  const WIRE_DRAG_THRESHOLD = 8;
  let wireDrag = null;

  function startWireDrag(pin, event) {
    state.pendingConnection = {
      nodeId: pin.dataset.nodeId,
      pinKey: pin.dataset.pinKey,
      direction: "output",
    };
    wireDrag = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, moved: false };
    // Touch legt de pointer impliciet vast op de pin; los laten zodat we boven andere pins uitkomen.
    if (pin.releasePointerCapture && pin.hasPointerCapture && pin.hasPointerCapture(event.pointerId)) {
      pin.releasePointerCapture(event.pointerId);
    }
    canvasRenderers.syncWiringClass();
  }

  function handleNodeLayerPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    // Shift+klik is selectie-toggelen (click-handler); geen drag starten en
    // vooral de bestaande multi-selectie niet resetten.
    if (event.shiftKey) {
      return;
    }
    const outputPin = event.target.closest('[data-pin-direction="output"]');
    if (outputPin) {
      startWireDrag(outputPin, event);
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
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    // Sleep je een node die deel is van een multi-selectie, verplaats dan de
    // hele groep; anders wordt de selectie vervangen door deze ene node.
    const selectedIds = getSelectedNodeIds();
    const isGroupDrag = selectedIds.length > 1 && selectedIds.includes(nodeId);
    if (!isGroupDrag) {
      state.selectedNodeId = nodeId;
      state.selectedNodeIds = [nodeId];
    } else {
      state.selectedNodeId = nodeId;
    }
    state.quickDeleteNodeId = null;
    state.keyboardCaptureNodeId = node.type === "keyboard" ? nodeId : null;
    pushUndo();
    state.dragging = {
      nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      groupStarts: isGroupDrag
        ? selectedIds
            .map((id) => workspace.nodes.find((item) => item.id === id))
            .filter(Boolean)
            .map((item) => ({ nodeId: item.id, startX: item.x, startY: item.y }))
        : null,
    };
    if (surface.setPointerCapture) {
      surface.setPointerCapture(event.pointerId);
    }
    startNodeLongPress(nodeId, event.pointerId, event.clientX, event.clientY);
  }

  let marqueeEl = null;
  let suppressNextLayerClick = false;

  function ensureMarqueeEl() {
    if (!marqueeEl) {
      marqueeEl = document.createElement("div");
      marqueeEl.className = "selection-marquee";
      marqueeEl.hidden = true;
      document.body.appendChild(marqueeEl);
    }
    return marqueeEl;
  }

  function marqueeRect(marquee) {
    const left = Math.min(marquee.startClientX, marquee.curClientX);
    const top = Math.min(marquee.startClientY, marquee.curClientY);
    const width = Math.abs(marquee.curClientX - marquee.startClientX);
    const height = Math.abs(marquee.curClientY - marquee.startClientY);
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  function updateMarqueeVisual(marquee) {
    const el = ensureMarqueeEl();
    const rect = marqueeRect(marquee);
    el.hidden = false;
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }

  function finishMarquee(marquee) {
    const rect = marqueeRect(marquee);
    if (marqueeEl) {
      marqueeEl.hidden = true;
    }
    const ids = [];
    dom.nodeLayer.querySelectorAll("article[data-node-id]").forEach((element) => {
      const nodeRect = element.getBoundingClientRect();
      const overlaps =
        nodeRect.left < rect.right &&
        nodeRect.right > rect.left &&
        nodeRect.top < rect.bottom &&
        nodeRect.bottom > rect.top;
      if (overlaps) {
        ids.push(element.dataset.nodeId);
      }
    });
    if (ids.length) {
      setSelection(ids);
      suppressNextLayerClick = true;
    }
    renderWorkspace();
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

    if (event.shiftKey) {
      state.marquee = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        curClientX: event.clientX,
        curClientY: event.clientY,
      };
      updateMarqueeVisual(state.marquee);
      return;
    }

    state.panningCanvas = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: dom.canvas.scrollLeft,
      startScrollTop: dom.canvas.scrollTop,
    };
    if (hadQuickDelete) {
      renderWorkspace();
    }
  }

  function handleDragMove(event) {
    handleDragMoveInner(event);
    if (wireDrag && event.pointerId === wireDrag.pointerId && !wireDrag.moved) {
      wireDrag.moved =
        Math.hypot(event.clientX - wireDrag.startClientX, event.clientY - wireDrag.startClientY) >=
        WIRE_DRAG_THRESHOLD;
    }
    if (state.pendingConnection) {
      canvasRenderers.updateWirePreview(event.clientX, event.clientY);
    }
  }

  function finishWireDrag(event) {
    const drag = wireDrag;
    wireDrag = null;
    if (event.type === "pointercancel") {
      canvasRenderers.clearWirePreview();
      return;
    }
    if (!drag.moved) {
      return; // gewone klik: pending blijft, de click-handler volgt
    }
    // Na een sleepbeweging volgt een click op een gemeenschappelijke ouder; die negeren.
    suppressNextLayerClick = true;
    window.setTimeout(() => {
      suppressNextLayerClick = false;
    }, 50);
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const inputPin = hit ? hit.closest('[data-pin-direction="input"]') : null;
    if (inputPin) {
      handlePinClick(inputPin);
    } else {
      state.pendingConnection = null;
      renderWorkspace();
    }
  }

  function handleDragMoveInner(event) {
    if (state.longPressWire && event.pointerId === state.longPressWire.pointerId) {
      const distance = Math.hypot(
        event.clientX - state.longPressWire.startClientX,
        event.clientY - state.longPressWire.startClientY
      );
      if (distance > longPressMoveThreshold) {
        clearWireLongPress(event.pointerId);
      }
    }

    if (state.marquee && event.pointerId === state.marquee.pointerId) {
      event.preventDefault();
      state.marquee.curClientX = event.clientX;
      state.marquee.curClientY = event.clientY;
      updateMarqueeVisual(state.marquee);
      return;
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
      if (state.dragging.groupStarts) {
        state.dragging.groupStarts.forEach((entry) => {
          const groupNode = workspace.nodes.find((item) => item.id === entry.nodeId);
          if (!groupNode) {
            return;
          }
          groupNode.x = Math.max(20, entry.startX + deltaX / state.zoom);
          groupNode.y = Math.max(20, entry.startY + deltaY / state.zoom);
          syncDraggedNodePosition(groupNode);
        });
      } else {
        node.x = Math.max(20, state.dragging.startNodeX + deltaX / state.zoom);
        node.y = Math.max(20, state.dragging.startNodeY + deltaY / state.zoom);
        syncDraggedNodePosition(node);
      }
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
    if (wireDrag && event && event.pointerId === wireDrag.pointerId) {
      finishWireDrag(event);
      return;
    }
    clearWireLongPress(event ? event.pointerId : null);

    if (state.marquee) {
      if (event && event.pointerId != null && event.pointerId !== state.marquee.pointerId) {
        return;
      }
      const marquee = state.marquee;
      state.marquee = null;
      finishMarquee(marquee);
      return;
    }

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
      renderWorkspace();
      return;
    }

    if (state.panningCanvas) {
      if (event && event.pointerId != null && event.pointerId !== state.panningCanvas.pointerId) {
        return;
      }
      const pan = state.panningCanvas;
      state.panningCanvas = null;
      // Een tik op leeg canvas (geen pan) annuleert een lopende verbinding.
      const tapped =
        event &&
        event.type === "pointerup" &&
        Math.hypot(event.clientX - pan.startClientX, event.clientY - pan.startClientY) < 4;
      if (tapped && state.pendingConnection) {
        state.pendingConnection = null;
        renderWorkspace();
      }
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
        renderWorkspace();
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
      renderWorkspace();
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
