/**
 * Dialog/Application to prompt for selecting a target actor when applying a targeted condition.
 */
export default class TargetedConditionPrompt {
  /**
   * Factory method to prompt the user to select an imposing actor.
   * @param {object} [options]
   * @param {object} [options.context]
   * @param {string} [options.context.statusId]
   * @returns {Promise<string|null>} Resolves with actor UUID or null if cancelled/none.
   */
  static async create({ context = {} } = {}) {
    const statusId = context.statusId || "condition";
    const statusLabel = CONFIG.TALESOFTHEOLDWEST?.conditions?.[statusId]?.label || statusId;
    const localizedLabel = game.i18n ? game.i18n.localize(statusLabel) : statusLabel;

    // Collect available actors from the world and current canvas tokens
    const actors = [];
    if (game.actors) {
      for (const actor of game.actors) {
        actors.push({ uuid: actor.uuid, name: actor.name });
      }
    }

    let optionsHtml = `<option value="">-- ${game.i18n?.localize("None") || "None"} --</option>`;
    for (const a of actors) {
      optionsHtml += `<option value="${a.uuid}">${a.name}</option>`;
    }

    const content = `
      <form class="targeted-condition-prompt">
        <p>${game.i18n?.format("TALESOFTHEOLDWEST.SelectSourceActor", { condition: localizedLabel }) || `Select source actor for ${localizedLabel}:`}</p>
        <div class="form-group">
          <label>${game.i18n?.localize("Actor") || "Actor"}:</label>
          <select name="actorUuid">${optionsHtml}</select>
        </div>
      </form>
    `;

    if (foundry?.applications?.api?.DialogV2) {
      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: localizedLabel },
        content,
        ok: {
          label: game.i18n?.localize("Confirm") || "Confirm",
          callback: (event, button, dialog) => {
            return button.form.elements.actorUuid?.value || null;
          },
        },
        rejectClose: false,
      });
      return result || null;
    }

    // Fallback standard Dialog
    return new Promise((resolve) => {
      new Dialog({
        title: localizedLabel,
        content,
        buttons: {
          ok: {
            label: game.i18n?.localize("Confirm") || "Confirm",
            callback: (html) => {
              const val = html.find('[name="actorUuid"]').val();
              resolve(val || null);
            },
          },
          cancel: {
            label: game.i18n?.localize("Cancel") || "Cancel",
            callback: () => resolve(null),
          },
        },
        default: "ok",
        close: () => resolve(null),
      }).render(true);
    });
  }
}
