export function createAppModals(deps) {
  const { dom } = deps;

  function ensureOverlay() {
    if (dom.appModalOverlay) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.id = "app-modal-overlay";
    overlay.className = "app-modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="app-modal-card panel" role="dialog" aria-labelledby="app-modal-title">
        <h2 id="app-modal-title"></h2>
        <p class="app-modal-lead" id="app-modal-lead"></p>
        <div id="app-modal-fields"></div>
        <p class="app-modal-error" id="app-modal-error" hidden></p>
        <div class="app-modal-actions">
          <button type="button" class="ghost-button" id="app-modal-cancel">Annuleren</button>
          <button type="button" class="primary-button" id="app-modal-confirm"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    dom.appModalOverlay = overlay;
    dom.appModalTitle = overlay.querySelector("#app-modal-title");
    dom.appModalLead = overlay.querySelector("#app-modal-lead");
    dom.appModalFields = overlay.querySelector("#app-modal-fields");
    dom.appModalError = overlay.querySelector("#app-modal-error");
    dom.appModalCancel = overlay.querySelector("#app-modal-cancel");
    dom.appModalConfirm = overlay.querySelector("#app-modal-confirm");
  }

  function showFormModal({
    title,
    lead = "",
    confirmLabel = "Opslaan",
    fields = [],
  }) {
    ensureOverlay();
    return new Promise((resolve) => {
      dom.appModalTitle.textContent = title;
      dom.appModalLead.textContent = lead;
      dom.appModalConfirm.textContent = confirmLabel;
      dom.appModalError.hidden = true;
      dom.appModalError.textContent = "";

      dom.appModalFields.innerHTML = fields
        .map((field) => {
          if (field.type === "select") {
            const options = (field.options || [])
              .map((option) => {
                const selected = String(option.value) === String(field.value || "") ? " selected" : "";
                return `<option value="${escapeFieldValue(option.value)}"${selected}>${escapeFieldValue(option.label)}</option>`;
              })
              .join("");
            return `<label class="app-modal-field"><span>${field.label}</span><select id="app-modal-field-${field.id}">${options}</select></label>`;
          }
          const inputTag =
            field.type === "textarea"
              ? `<textarea id="app-modal-field-${field.id}" rows="${field.rows || 3}">${escapeFieldValue(field.value)}</textarea>`
              : `<input id="app-modal-field-${field.id}" type="text" autocomplete="off" value="${escapeFieldValue(field.value)}" />`;
          return `<label class="app-modal-field"><span>${field.label}</span>${inputTag}</label>`;
        })
        .join("");

      dom.appModalOverlay.hidden = false;
      const firstInput = dom.appModalFields.querySelector("input, textarea, select");
      if (firstInput) {
        firstInput.focus();
        if (firstInput.tagName === "INPUT") {
          firstInput.select();
        }
      }

      function readValues() {
        const values = {};
        for (const field of fields) {
          const el = dom.appModalFields.querySelector(`#app-modal-field-${field.id}`);
          values[field.id] = el ? el.value.trim() : "";
        }
        return values;
      }

      function cleanup(result) {
        dom.appModalOverlay.hidden = true;
        dom.appModalCancel.removeEventListener("click", onCancel);
        dom.appModalConfirm.removeEventListener("click", onConfirm);
        dom.appModalOverlay.removeEventListener("click", onOverlay);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }

      function onCancel() {
        cleanup(null);
      }

      function onConfirm() {
        const values = readValues();
        for (const field of fields) {
          if (field.required && !values[field.id]) {
            dom.appModalError.textContent = field.requiredMessage || `Vul ${field.label} in.`;
            dom.appModalError.hidden = false;
            const el = dom.appModalFields.querySelector(`#app-modal-field-${field.id}`);
            if (el) el.focus();
            return;
          }
        }
        cleanup(values);
      }

      function onOverlay(event) {
        if (event.target === dom.appModalOverlay) {
          onCancel();
        }
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
        if (event.key === "Enter" && (event.target.tagName === "INPUT" || event.target.tagName === "SELECT")) {
          event.preventDefault();
          onConfirm();
        }
      }

      dom.appModalCancel.addEventListener("click", onCancel);
      dom.appModalConfirm.addEventListener("click", onConfirm);
      dom.appModalOverlay.addEventListener("click", onOverlay);
      document.addEventListener("keydown", onKeydown);
    });
  }

  function escapeFieldValue(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  }

  function showChipSaveModal({ suggestedName, suggestedDescription, lead = "" }) {
    return showFormModal({
      title: "Chip snapshot",
      lead,
      confirmLabel: "Opslaan",
      fields: [
        {
          id: "name",
          label: "Chipnaam",
          value: suggestedName,
          required: true,
          requiredMessage: "Voer een chipnaam in.",
        },
        {
          id: "description",
          label: "Beschrijving",
          type: "textarea",
          value: suggestedDescription,
        },
      ],
    }).then((result) => {
      if (!result) {
        return null;
      }
      return { name: result.name, description: result.description };
    });
  }

  function showWorkspaceNameModal({ suggestedName, lead = "" }) {
    return showFormModal({
      title: "Nieuwe workspace",
      lead,
      confirmLabel: "Aanmaken",
      fields: [
        {
          id: "name",
          label: "Workspace naam",
          value: suggestedName,
          required: true,
          requiredMessage: "Voer een workspace naam in.",
        },
      ],
    }).then((result) => {
      if (!result) {
        return null;
      }
      return result.name;
    });
  }

  return { showChipSaveModal, showWorkspaceNameModal, showFormModal };
}
