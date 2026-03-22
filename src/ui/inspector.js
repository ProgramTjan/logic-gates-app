export function createInspectorRenderers(deps) {
  const {
    dom,
    state,
    getCurrentWorkspace,
    getNodeSpec,
    getNodeConnections,
    getChipDefinition,
    escapeHtml,
    escapeAttribute,
  } = deps;

  function renderWidthField(node) {
    return `<div class="field-group">
      <label for="node-width-input">Bit width</label>
      <input id="node-width-input" type="number" min="1" max="16" step="1" data-config-key="width" value="${escapeAttribute(
        String(node.config.width || 1)
      )}" />
    </div>`;
  }

  function renderInspectorFields(node) {
    const commonLabel = `<div class="field-group">
      <label for="node-label-input">Label</label>
      <input id="node-label-input" type="text" data-config-key="label" value="${escapeAttribute(node.config.label || "")}" />
    </div>`;

    if (node.type === "switch") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="node-value-input">Bit value</label>
          <input id="node-value-input" type="text" data-config-key="value" value="${escapeAttribute(node.config.value)}" />
        </div>`;
    }

    if (node.type === "lamp") {
      return `${commonLabel}${renderWidthField(node)}`;
    }

    if (node.type === "gate") {
      return `${commonLabel}
        <div class="field-group">
          <label for="gate-type-select">Gate type</label>
          <select id="gate-type-select" data-config-key="gateType">
            ${["NOT", "AND", "OR", "XOR", "NAND", "NOR"]
              .map(
                (option) =>
                  `<option value="${option}" ${node.config.gateType === option ? "selected" : ""}>${option}</option>`
              )
              .join("")}
          </select>
        </div>
        ${renderWidthField(node)}`;
    }

    if (node.type === "input-pin") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="preview-value-input">Preview value</label>
          <input id="preview-value-input" type="text" data-config-key="previewValue" value="${escapeAttribute(
            node.config.previewValue
          )}" />
        </div>`;
    }

    if (node.type === "output-pin") {
      return `${commonLabel}${renderWidthField(node)}`;
    }

    if (node.type === "clock") {
      return `${commonLabel}
        <div class="field-group">
          <label for="clock-level-input">Clock level</label>
          <input id="clock-level-input" type="text" data-config-key="value" value="${escapeAttribute(node.config.value)}" />
        </div>`;
    }

    if (node.type === "register") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="reset-value-input">Reset value</label>
          <input id="reset-value-input" type="text" data-config-key="resetValue" value="${escapeAttribute(
            node.config.resetValue
          )}" />
        </div>`;
    }

    if (node.type === "splitter" || node.type === "joiner") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="split-width-input">High segment width</label>
          <input id="split-width-input" type="number" min="1" max="${escapeAttribute(
            String(Math.max(1, node.config.width - 1))
          )}" step="1" data-config-key="highWidth" value="${escapeAttribute(String(node.config.highWidth))}" />
        </div>`;
    }

    if (node.type === "chip-instance") {
      const definition = getChipDefinition(node.config.definitionId);
      return `${commonLabel}
        <div class="field-group">
          <label>Definition</label>
          <div class="micro-copy">${escapeHtml(
            definition ? `${definition.name} v${definition.version}` : "Missing chip definition"
          )}</div>
        </div>`;
    }

    return commonLabel;
  }

  function renderInspector() {
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    if (!node) {
      dom.inspector.className = "inspector empty";
      dom.inspector.innerHTML = "Selecteer een node om de eigenschappen te bewerken.";
      return;
    }

    const spec = getNodeSpec(node);
    const connections = getNodeConnections(workspace, node.id);
    dom.inspector.className = "inspector";
    dom.inspector.innerHTML = `
      <div>
        <h3>${escapeHtml(spec.title)}</h3>
        <p class="micro-copy">${escapeHtml(spec.subtitle)}</p>
      </div>
      ${renderInspectorFields(node)}
      <div class="inspector-section">
        <h3>Connections</h3>
        ${
          connections.length
            ? connections
                .map(
                  (connection) => `<div class="connection-chip">
                    <span>${escapeHtml(connection.label)}</span>
                    <button class="ghost-button" type="button" data-remove-wire="${connection.wireId}">Remove</button>
                  </div>`
                )
                .join("")
            : '<p class="micro-copy">Nog geen verbindingen voor deze node.</p>'
        }
      </div>
      <div class="inspector-section">
        <button type="button" data-delete-node="${node.id}">Delete Node</button>
      </div>
    `;
  }

  function renderErrors() {
    const errors = state.lastEvaluation ? state.lastEvaluation.errors : [];
    if (!errors.length) {
      dom.errorList.innerHTML = "Geen fouten in de actieve workspace.";
      return;
    }
    dom.errorList.innerHTML = errors
      .map((error) => `<div class="error-item">${escapeHtml(error.message)}</div>`)
      .join("");
  }

  return {
    renderErrors,
    renderInspector,
  };
}
