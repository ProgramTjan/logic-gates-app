export function createCanvasRenderers(deps) {
  const {
    dom,
    state,
    getCurrentWorkspace,
    getNodeSpec,
    getPinWidth,
    makeRegisterStateKey,
    formatBits,
    parseBits,
    escapeHtml,
    escapeAttribute,
  } = deps;

  function renderNode(node, signalState, invalid) {
    const spec = getNodeSpec(node);
    const selected = node.id === state.selectedNodeId;
    const quickDeleteVisible = node.id === state.quickDeleteNodeId;
    const typeClass = `node-${node.type}`;
    const gateClass =
      node.type === "gate" && node.config.gateType
        ? `gate-${String(node.config.gateType).toLowerCase()}`
        : "";
    const lampValue =
      signalState && signalState.inputs && signalState.inputs.IN
        ? formatBits(signalState.inputs.IN, getPinWidth(spec.inputs, "IN"))
        : "0";
    const registerKey = makeRegisterStateKey(`workspace:${getCurrentWorkspace().id}`, node.id);
    const registerState = state.project.runtime.registerStates[registerKey];
    const registerText =
      node.type === "register"
        ? formatBits(
            registerState ? registerState.bits : parseBits(node.config.resetValue, node.config.width),
            node.config.width
          )
        : "";
    const body = renderNodeBody(node, spec, lampValue, registerText);

    return `<article class="node ${typeClass} ${gateClass} ${selected ? "selected" : ""} ${
      invalid ? "invalid" : ""
    }" data-node-id="${node.id}" style="left:${node.x}px; top:${node.y}px;">
      ${
        quickDeleteVisible
          ? `<button class="node-quick-delete" type="button" data-quick-delete-node="${node.id}" aria-label="Delete ${escapeAttribute(
              spec.title
            )}">x</button>`
          : ""
      }
      <div class="node-shell" data-drag-surface="true" data-node-id="${node.id}">
        <div class="node-caption">
          <span class="node-label">${escapeHtml(spec.title)}</span>
          <span class="node-state-pill">${escapeHtml(getNodeTag(node))}</span>
        </div>
        <div class="node-core">
          <div class="pin-stack">
            ${spec.inputs
              .map((pin) =>
                renderPin(
                  node.id,
                  pin,
                  "input",
                  signalState && signalState.inputs ? signalState.inputs[pin.key] : null
                )
              )
              .join("")}
          </div>
          ${body}
          <div class="pin-stack right">
            ${spec.outputs
              .map((pin) =>
                renderPin(
                  node.id,
                  pin,
                  "output",
                  signalState && signalState.outputs ? signalState.outputs[pin.key] : null
                )
              )
              .join("")}
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderNodeBody(node, spec, lampValue, registerText) {
    const symbol = getNodeSymbol(node);
    if (node.type === "switch") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta">
        <span>${escapeHtml(node.config.value)}</span>
        <button class="ghost-button node-mini-button" type="button" data-node-action="toggle-switch" data-node-id="${node.id}">toggle</button>
      </div></div>`;
    }
    if (node.type === "input-pin") {
      const isOn = /1/.test(node.config.previewValue);
      return `<div class="node-center"><div class="gate-face">
        <span class="lamp-indicator ${isOn ? "on" : ""}"></span>
      </div>
      <div class="gate-meta">
        <span>${escapeHtml(node.config.previewValue)}</span>
        <button class="ghost-button node-mini-button" type="button" data-node-action="toggle-input-pin" data-node-id="${node.id}">toggle</button>
      </div></div>`;
    }
    if (node.type === "clock") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta">
        <span>${escapeHtml(node.config.value)}</span>
        <button class="ghost-button node-mini-button" type="button" data-node-action="toggle-clock" data-node-id="${node.id}">toggle</button>
      </div></div>`;
    }
    if (node.type === "lamp") {
      const isOn = /1/.test(lampValue);
      return `<div class="node-center"><div class="gate-face">
        <span class="lamp-indicator ${isOn ? "on" : ""}"></span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(lampValue)}</span></div></div>`;
    }
    if (node.type === "register") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span class="register-readout">${escapeHtml(registerText)}</span></div></div>`;
    }
    if (node.type === "splitter" || node.type === "joiner") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(
        `${node.config.highWidth}/${node.config.width - node.config.highWidth}`
      )}</span></div></div>`;
    }
    if (node.type === "chip-instance") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(
        `${spec.inputs.length}:${spec.outputs.length}`
      )}</span></div></div>`;
    }
    if (node.type === "output-pin") {
      const isOn = /1/.test(lampValue);
      return `<div class="node-center"><div class="gate-face">
        <span class="lamp-indicator ${isOn ? "on" : ""}"></span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(lampValue)}</span></div></div>`;
    }
    return `<div class="node-center"><div class="gate-face">
      <span class="gate-symbol">${escapeHtml(symbol)}</span>
    </div>
    <div class="gate-meta"><span>${escapeHtml(node.config.width)}b</span></div></div>`;
  }

  function renderPin(nodeId, pin, direction, bits) {
    const bitString = bits ? formatBits(bits, pin.width) : "0".padStart(pin.width, "0");
    const signalClass = /1/.test(bitString) ? "high" : "low";
    const pending =
      state.pendingConnection &&
      state.pendingConnection.nodeId === nodeId &&
      state.pendingConnection.pinKey === pin.key &&
      state.pendingConnection.direction === direction;

    return `<button class="pin direction-${direction} ${signalClass} ${pending ? "pending" : ""}" type="button"
      data-pin-direction="${direction}"
      data-node-id="${nodeId}"
      data-pin-key="${pin.key}">
      ${direction === "input" ? `<span class="pin-label">${escapeHtml(pin.name)}</span>` : ""}
      <span class="pin-badge"></span>
      ${direction === "output" ? `<span class="pin-label">${escapeHtml(pin.name)}</span>` : ""}
    </button>`;
  }

  function getNodeTag(node) {
    if (node.type === "gate") {
      return node.config.gateType;
    }
    if (node.type === "chip-instance") {
      return "CHIP";
    }
    if (node.type === "input-pin") {
      return "IN";
    }
    if (node.type === "output-pin") {
      return "OUT";
    }
    if (node.type === "switch") {
      return "SW";
    }
    if (node.type === "lamp") {
      return "L";
    }
    if (node.type === "clock") {
      return "CLK";
    }
    if (node.type === "register") {
      return "REG";
    }
    if (node.type === "splitter") {
      return "SPLIT";
    }
    if (node.type === "joiner") {
      return "JOIN";
    }
    return node.type.toUpperCase();
  }

  function getNodeSymbol(node) {
    if (node.type === "gate") {
      return {
        NOT: "!",
        AND: "&",
        OR: "1+",
        XOR: "=1",
        NAND: "!&",
        NOR: "!|",
      }[node.config.gateType] || node.config.gateType;
    }
    if (node.type === "switch") {
      return "S";
    }
    if (node.type === "lamp") {
      return "O";
    }
    if (node.type === "clock") {
      return "CLK";
    }
    if (node.type === "register") {
      return "D";
    }
    if (node.type === "splitter") {
      return "/\\";
    }
    if (node.type === "joiner") {
      return "\\/";
    }
    if (node.type === "input-pin") {
      return ">";
    }
    if (node.type === "output-pin") {
      return "<";
    }
    if (node.type === "chip-instance") {
      return "[]";
    }
    return "?";
  }

  function renderWires(workspace, evaluation) {
    const nodeLookup = new Map(workspace.nodes.map((node) => [node.id, node]));

    dom.wireLayer.innerHTML = workspace.wires
      .map((wire) => {
        const fromElement = dom.nodeLayer.querySelector(
          `[data-node-id="${wire.fromNodeId}"][data-pin-key="${wire.fromPin}"][data-pin-direction="output"]`
        );
        const toElement = dom.nodeLayer.querySelector(
          `[data-node-id="${wire.toNodeId}"][data-pin-key="${wire.toPin}"][data-pin-direction="input"]`
        );

        if (!fromElement || !toElement) {
          return "";
        }

        const fromPoint = getElementOffsetCenter(fromElement, dom.nodeLayer);
        const toPoint = getElementOffsetCenter(toElement, dom.nodeLayer);
        const x1 = fromPoint.x;
        const y1 = fromPoint.y;
        const x2 = toPoint.x;
        const y2 = toPoint.y;
        const delta = Math.max(60, Math.abs(x2 - x1) * 0.55);
        const path = `M ${x1} ${y1} C ${x1 + delta} ${y1}, ${x2 - delta} ${y2}, ${x2} ${y2}`;
        const wireSignal = evaluation.wireSignals[wire.id];
        const wireClass = wireSignal ? (wireSignal.invalid ? "invalid" : wireSignal.high ? "high" : "low") : "";
        const invalidNode = !nodeLookup.has(wire.fromNodeId) || !nodeLookup.has(wire.toNodeId);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const showDelete = state.quickDeleteWireId === wire.id;

        return [
          `<path class="wire-hit" data-wire-id="${wire.id}" d="${path}" />`,
          `<path class="wire ${wireClass} ${invalidNode ? "invalid" : ""}" d="${path}" />`,
          showDelete
            ? `<g class="wire-delete-btn" data-quick-delete-wire="${wire.id}">` +
              `<circle cx="${mx}" cy="${my}" r="9"/>` +
              `<text x="${mx}" y="${my}" dy="0.35em" text-anchor="middle">×</text>` +
              `</g>`
            : "",
        ].join("");
      })
      .join("");
  }

  function getElementOffsetCenter(element, boundary) {
    let x = element.offsetLeft + element.offsetWidth / 2;
    let y = element.offsetTop + element.offsetHeight / 2;
    let current = element.offsetParent;
    while (current && current !== boundary) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }
    return { x, y };
  }

  function updateConnectionStatus(message) {
    if (message) {
      dom.connectionStatus.textContent = message;
      return;
    }
    if (!state.pendingConnection) {
      dom.connectionStatus.textContent = "Klik output, klik input.";
      return;
    }
    const workspace = getCurrentWorkspace();
    const sourceNode = workspace.nodes.find((node) => node.id === state.pendingConnection.nodeId);
    dom.connectionStatus.textContent = sourceNode
      ? `Verbind ${sourceNode.config.label || sourceNode.type}.${state.pendingConnection.pinKey} met een input.`
      : "Klik op een input-pin om te verbinden.";
  }

  return {
    renderNode,
    renderWires,
    updateConnectionStatus,
  };
}
