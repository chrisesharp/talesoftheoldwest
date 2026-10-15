import { rollAttrib } from "../helpers/diceroll.mjs";
import * as argpUtils from "../helpers/utils.mjs";
import TOTOWActiveEffect from "../documents/active-effect.mjs";

/** Maps a critical injury roll total to the modifiers it applies. */
const CRIT_MODIFIERS = {
  11: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' },
       { name: 'TALESOFTHEOLDWEST.Ability.Fightin.listName',     value: '-1', state: 'Active' }],
  14: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' },
       { name: 'TALESOFTHEOLDWEST.Ability.Fightin.listName',     value: '-1', state: 'Active' }],
  12: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' }],
  21: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' }],
  23: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' }],
  41: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' }],
  51: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-1', state: 'Active' }],
  22: [{ name: 'TALESOFTHEOLDWEST.Ability.Resilience.listName',  value: '-1', state: 'Active' }],
  44: [{ name: 'TALESOFTHEOLDWEST.Ability.Resilience.listName',  value: '-1', state: 'Active' }],
  31: [{ name: 'TALESOFTHEOLDWEST.Ability.Shootin.listName',     value: '-1', state: 'Active' }],
  32: [{ name: 'TALESOFTHEOLDWEST.Ability.Shootin.listName',     value: '-1', state: 'Active' },
       { name: 'TALESOFTHEOLDWEST.Ability.Fightin.listName',     value: '-1', state: 'Active' }],
  52: [{ name: 'TALESOFTHEOLDWEST.Ability.Move.listName',        value: '-2', state: 'Active' }],
  61: [{ name: 'TALESOFTHEOLDWEST.Ability.Performin.listName',   value: '-1', state: 'Active' }],
  62: [{ name: 'TALESOFTHEOLDWEST.Ability.Labor.listName',       value: '-1', state: 'Active' }],
  63: [{ name: 'TALESOFTHEOLDWEST.Ability.Shootin.listName',     value: '-2', state: 'Active' },
       { name: 'TALESOFTHEOLDWEST.Ability.Hawkeye.listName',     value: '-2', state: 'Active' }],
};

/**
 * Presents the conditional-modifiers dialog and accumulates any checked mod values into `dataset.mod`.
 * Returns the roll result, or the string `"cancelled"` if the user dismissed the dialog.
 *
 * @param {string} rollType  - "Attributes" or "Abilities"
 * @param {object} dataset   - The element dataset for the roll (mutated in-place for `mod`).
 * @param {object} rollData  - Actor roll data from `getRollData()`.
 * @param {Actor}  actor     - The owning actor.
 * @returns {Promise<object|"cancelled">}
 */
async function processConditionals(rollType, dataset, rollData, actor) {
  const config = CONFIG.TALESOFTHEOLDWEST;
  const { conditionalMods, talentMods } = await argpUtils.prepModOutput(rollType, rollData, dataset);
  if (conditionalMods?.length || talentMods?.length) {
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/talesoftheoldwest/templates/dialog/conditional-modifiers.html",
      { config, dataset, conditionalMods, talentMods }
    );
    const response = await foundry.applications.api.DialogV2.wait({
      window: { title: "TALESOFTHEOLDWEST.Item.General.roll-modifiers" },
      content,
      rejectClose: false,
      buttons: [
        {
          label: "TALESOFTHEOLDWEST.dialog.roll",
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
        },
        {
          label: "TALESOFTHEOLDWEST.dialog.cancel",
          action: "cancel",
        },
      ],
    });

    if (!response || response === "cancel") return "cancelled";

    // Accumulate checked conditional modifiers (mods.* flat keys from structured partial).
    // FormDataExtended stores dot-notation names as flat string keys, not nested objects,
    // so `response["mods.f_0"]` exists but `response.mods` is undefined.
    const checkboxSum = Object.entries(response)
      .filter(([k]) => k.startsWith('mods.'))
      .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

    dataset.mod = Number.parseInt(dataset.mod || 0) + checkboxSum;
  }

  return rollAttrib(dataset, rollData, actor);
}

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class totowActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data that isn't
   * handled by the actor's DataModel. Data calculated in this step should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    // const actorData = this;
    // const systemData = actorData.system;
    // const flags = actorData.flags.talesoftheoldwest || {};
  }

  /**
   *
   * @override
   * Augment the actor's default getRollData() method by appending the data object
   * generated by the its DataModel's getRollData(), or null. This polymorphic
   * approach is useful when you have actors & items that share a parent Document,
   * but have slightly different data preparation needs.
   */
  getRollData() {
    let spanner = { ...super.getRollData(), ...(this.system.getRollData?.() ?? null) };
    spanner.actorType = this.type;

    // Build itemMods so that prepModOutput can surface Conditional modifiers
    // at roll time. This mirrors what _prepareItems does on the sheet.
    const itemMods = [];
    for (const i of this.items) {
      argpUtils.findMods(i, itemMods);
    }
    spanner.itemMods = Object.groupBy(itemMods, ({ name }) => name);

    return spanner;
  }
  // *************************************************
  // Setupthe prototype token
  // *************************************************
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    let tokenProto = {
      "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      "prototypeToken.name": `${data.name}`,
      "prototypeToken.bar1": { attribute: "header.health" },
      "prototypeToken.bar2": { attribute: "None" },
      "prototypeToken.actorLink": true,
      "prototypeToken.sight.enabled": "true",
      "prototypeToken.sight.range": "12",
    };
    switch (data.type) {
      case "pc":
        tokenProto["prototypeToken.bar2"] = { attribute: "header.stress" };
        break;
      case "npc":
        tokenProto["prototypeToken.actorLink"] = false;
        tokenProto["prototypeToken.disposition"] = CONST.TOKEN_DISPOSITIONS.HOSTILE;
        tokenProto["prototypeToken.sight.enabled"] = false;
        break;
    }

    this.updateSource(tokenProto);
  }

  /**
   * Toggle a configured status effect for the Actor.
   * @param {string} statusId       A status effect ID defined in CONFIG.statusEffects.
   * @param {object} [options={}]   Additional options which modify how the effect is created.
   * @param {boolean} [options.active]          Force the effect to be active or inactive regardless of its current state.
   * @param {boolean} [options.overlay=false]   Display the toggled effect as an overlay.
   * @returns {Promise<ActiveEffect|boolean|undefined>}  A promise which resolves to one of the following values:
   *                                 - ActiveEffect if a new effect need to be created
   *                                 - true if was already an existing effect
   *                                 - false if an existing effect needed to be removed
   *                                 - undefined if no changes need to be made.
   * @override Implementation copied from core.
   */
  async toggleStatusEffect(statusId, { active, overlay = false } = {}) {
    const status = CONFIG.statusEffects.find((e) => e.id === statusId);
    if (!status) throw new Error(`Invalid status ID "${statusId}" provided to Actor#toggleStatusEffect`);
    const existing = [];

    if (status._id) {
      const effect = this.effects.get(status._id);
      if (effect) existing.push(effect.id);
    } else {
      existing.push(
        ...this.effects
          .filter((effect) => effect.statuses.size === 1 && effect.statuses.has(status.id))
          .map((effect) => effect.id)
      );
    }

    if (existing.length) {
      if (active) return true;
      await this.deleteEmbeddedDocuments("ActiveEffect", existing);
      return false;
    }

    if (active === false) return;
    const effect = await TOTOWActiveEffect.fromStatusEffect(statusId);
    if (overlay) effect.updateSource({ "flags.core.overlay": true });
    return TOTOWActiveEffect.create(effect, { parent: this, keepId: true });
  }

  async addCondition(effect) {
    if (typeof effect === "string") {
      effect = foundry.utils.duplicate(CONFIG.TALESOFTHEOLDWEST.conditionEffects.find((e) => e.id == effect));
    }
    if (!effect) return "No Effect Found";
    if (!effect.id) return "Conditions require an id field";

    let existing = await this.hasCondition(effect.id);
    if (!existing) {
      effect.label = game.i18n.localize(effect.label).replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
      effect.name = game.i18n.localize(effect.name).replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
      effect["statuses"] = effect.id;
      delete effect.id;
      return await this.createEmbeddedDocuments("ActiveEffect", [effect]);
    }
  }

  async removeCondition(effect) {
    if (typeof effect === "string") {
      effect = foundry.utils.duplicate(CONFIG.TALESOFTHEOLDWEST.conditionEffects.find((e) => e.id == effect));
    }
    if (!effect) return "No Effect Found";
    if (!effect.id) return "Conditions require an id field";
    let existing = await this.hasCondition(effect.id);
    if (existing) {
      return await this.deleteEmbeddedDocuments("ActiveEffect", [existing._id]);
    }
  }
  async hasCondition(conditionKey) {
    let existing = "";
    existing = this.effects.find((effect) => effect.statuses.has(conditionKey));
    return existing;
  }

  async rollCrit(actor, type, dataset, manCrit) {
    if (type !== "pc") {
      return;
    }
    const critTable = game.tables.getName(game.i18n.localize("TALESOFTHEOLDWEST.CriticalInjuries")) || game.tables.getName("Critical Injuries");
    if (critTable == null) {
      ui.notifications.warn(game.i18n.localize("TALESOFTHEOLDWEST.NoCharCrit"));
      return;
    }

    let diceRoll;
    if (!manCrit) {
      diceRoll = await critTable.draw({ displayChat: false });
    } else {
      const roll = await new Roll(manCrit).evaluate();
      diceRoll = await critTable.draw({ roll: roll, displayChat: false });
    }

    const htmlData = await this.determineCritResults(diceRoll, manCrit);

    // Now push the correct chat message
    const html = await foundry.applications.handlebars.renderTemplate(`systems/talesoftheoldwest/templates/chat/crit-roll-${actor.type}.hbs`, htmlData);
    let chatData = {
      user: game.user.id,
      speaker: {
        actor: actor.id,
      },
      content: html,
      other: game.users.contents.filter((u) => u.isGM).map((u) => u.id),
      sound: CONFIG.sounds.dice,
    };

    // Apply the Active Effect
    if (actor.system.critInj.length === 1) {
      await this.toggleStatusEffect("criticalinj");
    }

    ChatMessage.applyMode(chatData, game.settings.get("core", "rollMode"));
    return ChatMessage.create(chatData);
  }

  async determineCritResults(diceRoll, manCrit) {
    const resultImage = diceRoll.results[0].img;
    const extractField = (label) => {
      const pattern = new RegExp(String.raw`<strong>${label}</strong>:\s*([\s\S]*?)(?=(?:<p><strong>|<\/p>|$))`, "i");
      const match = pattern.exec(diceRoll.results[0].description);
      return match ? match[1].replace(/<[^<>]*>/g, "").trim() : "";
    };

    const location = extractField("Location") || "Body";
    const injury = extractField("Injury") || "Critical Injury";
    const rawFatal = extractField("Fatal") || "No";
    const rawHealingTime = extractField("Healing Time") || "-";
    const immediateEffect = extractField("Immediate Effect") || "None";
    const rawLongTerm = extractField("Long-Term Effect") || extractField("Long Term Effect") || "None";
    let healingTime;

    // Process Fatal
    const { isFatal, fatal, longTermEffect } = await this.determineFatal(rawFatal, rawLongTerm);

    // Process Healing Time
    if (rawHealingTime && rawHealingTime !== "-" && !/instant/i.test(rawFatal)) {
      const healDiceMatch = new RegExp(/\[\[(\d+d\d+)\]\]\s*(.*)/i).exec(rawHealingTime);
      if (healDiceMatch) {
        const rollHeal = healDiceMatch[1];
        const newHealTime = healDiceMatch[2] || "";
        healingTime = (await new Roll(`${rollHeal}`).evaluate()).result + " " + newHealTime;
      } else {
        healingTime = rawHealingTime;
      }
    } else {
      healingTime = game.i18n.localize("TALESOFTHEOLDWEST.ItemModifierSelect.none");
    }

    // Setup Modifiers
    let update = {};
    const critMods = CRIT_MODIFIERS[diceRoll.roll._total];
    if (critMods) {
      critMods.forEach((mod, i) => {
        update[`system.itemModifiers.[${i}]`] = {
          name: game.i18n.localize(mod.name),
          value: mod.value,
          state: mod.state,
        };
      });
    }

    //
    // Now create the Crit item on the sheet
    //

    const rollData = {
      type: "crit",
      img: resultImage,
      name: `#${diceRoll.roll._total} ${location} - ${injury}`,
      "system.location": location.toLowerCase().replace(/\s/g, ""),
      "system.injury": injury,
      "system.healingtime": healingTime,
      "system.fatal": isFatal,
      "system.fatalmessage": fatal[0].replace(/(YES)\s/g, ""),
      // Persisted DB key is 'imediateeffect'; totowCrit provides an 'immediateeffect' getter/setter alias.
      "system.imediateeffect": immediateEffect,
      "system.longtermeffect": longTermEffect,
    };

    const theItem = await this.createEmbeddedDocuments("Item", [rollData]);

    if (critMods) {
      await theItem[0].update(update);
    }

    return {
      actorname: this.name,
      img: resultImage,
      name: `#${diceRoll.roll._total} ${location}`,
      injury,
      fatal: fatal[0],
      healingtime: healingTime,
      imediateeffect: immediateEffect,
      longtermeffect: longTermEffect,
      manCrit,
    };
  }

  async determineFatal(rawFatal, longTermEffect) {
    const isFatal = /^yes/i.test(rawFatal);
    let fatal = [game.i18n.localize("TALESOFTHEOLDWEST.General.no"), ""];
    if (isFatal) {
      if (/instant/i.test(rawFatal)) {
        fatal = ["YES", "Instant"];
        fatal[0] = '<strong style="color: red;">' + fatal[0] + "</strong><br>" + game.i18n.localize("TALESOFTHEOLDWEST.Criticals.endOfTheTrail");
        longTermEffect = '<strong style="color: red;">' + longTermEffect + "</strong>";
      } else {
        const fatalDiceMatch = new RegExp(/\[\[(\d+d\d+)\]\]\s*(.*)/i).exec(rawFatal);
        if (fatalDiceMatch) {
          const rollFatal = fatalDiceMatch[1];
          const newFatalTime = fatalDiceMatch[2] || "";
          const evalRoll = (await new Roll(`${rollFatal}`).evaluate()).result;
          fatal = ["YES", `${evalRoll} ${newFatalTime}`.trim()];
        } else {
          fatal = ["YES", rawFatal];
        }

        const hasPenalty = /[-−]1/i.test(rawFatal);
        if (hasPenalty) {
          fatal[0] =
            '<strong style="color: red;">' +
            game.i18n.localize("TALESOFTHEOLDWEST.General.yes").toUpperCase() +
            "</strong><br>" +
            game.i18n.localize("TALESOFTHEOLDWEST.Criticals.rollResilience") +
            fatal[1] +
            "<br> -1 to <strong>" +
            game.i18n.localize("TALESOFTHEOLDWEST.Ability.Doctorin.long") +
            "</strong> roll.";
        } else {
          fatal[0] =
            '<strong style="color: red;">' +
            game.i18n.localize("TALESOFTHEOLDWEST.General.yes").toUpperCase() +
            "</strong><br>" +
            game.i18n.localize("TALESOFTHEOLDWEST.Criticals.rollResilience") +
            fatal[1];
        }
      }
    }
    return { isFatal, fatal, longTermEffect };
  }

  async rollCritMan(actor, type, dataset) {
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/talesoftheoldwest/templates/dialog/roll-char-manual-crit-dialog.html",
      actor,
      type,
      dataset,
    );
    const response = await foundry.applications.api.DialogV2.wait({
      window: { title: "TALESOFTHEOLDWEST.dialog.RollManCrit" },
      content,
      rejectClose: false,
      buttons: [
        {
          label: "TALESOFTHEOLDWEST.dialog.roll",
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
        },
        {
          label: "TALESOFTHEOLDWEST.dialog.cancel",
          action: "cancel",
        },
      ],
    });
    if (!response || response === "cancel") return "cancelled";
    if (!response.manCrit.match(/^[1-6]?[1-6]$/gm)) {
      ui.notifications.warn(game.i18n.localize("TALESOFTHEOLDWEST.dialog.RollManCharCrit"));
      return;
    }
    await actor.rollCrit(actor, type, dataset, response.manCrit);
  }

  async diceRoll(actor, event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks
    const rollData = this.getRollData();
    const dataset = target.dataset;

    if (!dataset.rollType) return;
    dataset.myHorse = "false";
    dataset.shootmodifiermod = "0";

    if (actor.type === "pc") {
      dataset.faithpoints = actor.system.general.faithpoints.value;
      dataset.canPush = actor.system.general.canPush;
    } else {
      dataset.faithpoints = 0;
      dataset.canPush = false;
    }

    dataset.myActor = actor.id;
    let result = "";

    // Handle item rolls.
    switch (dataset.rollType) {
      case "attribute":
        result = await processConditionals("Attributes", dataset, rollData, actor);
        break;
      case "ability":
        await this.checkIfRiding(dataset, actor);
        result = await processConditionals("Abilities", dataset, rollData, actor);
        break;
      case "item":
      case "weapon": {
        const itemId = target.dataset.itemId;
        const item = actor.items.get(itemId);
        if (dataset.rollType === "item") {
          return item.roll(dataset);
        }
        result = await item.roll(dataset, item);
        break;
      }
      default:
        break;
    }
    if (result !== "cancelled") {
      await this._sendToChat(actor, event, target, result);
      this.render();
    }
  }

  async checkIfRiding(dataset, actor) {
    if (dataset.label === game.i18n.localize("TALESOFTHEOLDWEST.Ability.Animalhandlin.long") && actor.type == "pc") {
      if (actor.system.remuda.remudaMounted !== "false") {
        let horse = await this.getRemuda(actor.system.remuda.remudaMounted);
        const content = await foundry.applications.handlebars.renderTemplate("systems/talesoftheoldwest/templates/dialog/riding-my-horse.hbs", horse);
        const response = await foundry.applications.api.DialogV2.confirm({
          window: { title: "TALESOFTHEOLDWEST.dialog.Ride-My-Horse-Dialog" },
          content,
          modal: true,
        });
        if (response === true) {
          dataset.myHorse = "true";
          dataset.mod = Number(dataset.mod) + Number(horse.actor.system.general.ridingmodifier.value);
        }
      }
    }
  }

  async _sendToChat(actor, event, target, result) {
    const html = await foundry.applications.handlebars.renderTemplate("systems/talesoftheoldwest/templates/chat/roll.hbs", result.result);
    let chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({
        alias: actor.name,
        actor: actor.id,
      }),
      rolls: [result.roll],
      rollMode: game.settings.get("core", "rollMode"),
      content: html,
      sound: CONFIG.sounds.dice,
    };
    if (["gmroll", "blindroll"].includes(chatData.rollMode)) {
      chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    } else if (chatData.rollMode === "selfroll") {
      chatData.whisper = [game.user];
    }
    const msg = await ChatMessage.create(chatData);
    result.result.messageNo = msg.id;
    await msg.setFlag("talesoftheoldwest", "modifiers", result.result.modifiers.mod);
    await msg.setFlag("talesoftheoldwest", "results", result);
    await msg.setFlag("talesoftheoldwest", "isType", actor.type);

    return result;
  }

  async modRoll(actor, event, target) {
    const content = await foundry.applications.handlebars.renderTemplate("systems/talesoftheoldwest/templates/dialog/roll-modifier.html", actor, event, target);
    const response = await foundry.applications.api.DialogV2.wait({
      window: { title: "TALESOFTHEOLDWEST.Item.General.roll-modifiers" },
      content,
      rejectClose: false,
      buttons: [
        {
          label: "TALESOFTHEOLDWEST.dialog.roll",
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
        },
        {
          label: "TALESOFTHEOLDWEST.dialog.cancel",
          action: "cancel",
        },
      ],
    });
    if (!response || response === "cancel") return "cancelled";
    target.dataset.mod = Number.parseInt(target.dataset.mod || 0) + Number.parseInt(response.manMod || 0);

    await actor.diceRoll(actor, event, target);
  }

  async createChatMessage(message, actorID) {
    let chatData = {
      user: game.user.id,
      speaker: {
        actor: actorID,
      },
      content: new Handlebars.SafeString(message),
      other: game.users.contents.filter((u) => u.isGM).map((u) => u.id),
      sound: CONFIG.sounds.lock,
    };

    ChatMessage.applyMode(chatData, game.settings.get("core", "rollMode"));
    return ChatMessage.create(chatData);
  }

  /* ------------------------------------------- */
  /*  linked actors Management                   */
  /* ------------------------------------------- */

  /**
   * @param {string}  compId              The id of the added actor
   * @returns {details}
   */
  async addCompadres(compId) {
    if (this.type !== "pc") return;

    const system = this.system;
    const details = {
      id: compId,
    };
    // Removes duplicates.
    if (system.compadres.details.some((o) => o.id === compId)) this.removeCompadres(compId);
    // Adds the new occupant.
    system.compadres.details.push(details);
    await this.update({ "system.compadres.details": system.compadres.details });

    await this.update({ "system.compadres.compadresQty": system.compadres.details.length });

    return details;
  }

  /* ------------------------------------------- */

  /**
   * @param {string} compId The id of the occupant to remove
   * @return {Compadres[]}
   */
  removeCompadres(compId) {
    if (this.type !== "pc") return;
    const compadres = this.system.compadres;
    compadres.details = compadres.details.filter((o) => o.id !== compId);
    return compadres.details;
  }

  /* ------------------------------------------- */

  /**
   * @param {string} compId The id of the occupant to find
   * @returns {VehicleOccupant|undefined}
   */
  getCompadres(compId) {
    if (this.type !== "pc") return;
    return this.system.compadres.details.find((o) => o.id === compId);
  }

  /* ------------------------------------------- */
  /**
   * @param {string}  compId              The id of the added actor
   * @returns {details}
   */
  async addRemuda(compId) {
    if (this.type !== "pc") return;

    const system = this.system;
    const details = {
      id: compId,
    };
    // Removes duplicates.
    if (system.remuda.details.some((o) => o.id === compId)) this.removeRemuda(compId);
    // Adds the new occupant.
    system.remuda.details.push(details);
    await this.update({ "system.remuda.details": system.remuda.details });

    await this.update({ "system.remuda.remudaQty": system.remuda.details.length });

    return details;
  }

  /* ------------------------------------------- */

  /**
   * @param {string} compId The id of the occupant to remove
   * @return {Remuda[]}
   */
  removeRemuda(compId) {
    if (this.type !== "pc") return;
    const remuda = this.system.remuda;
    remuda.details = remuda.details.filter((o) => o.id !== compId);
    return remuda.details;
  }

  /* ------------------------------------------- */

  /**
   * @param {string} compId The id of the occupant to find
   * @returns {VehicleOccupant|undefined}
   */
  async getRemuda(compId) {
    if (this.type !== "pc") return;
    const entry = this.system.remuda.details.find((o) => o.id === compId);
    if (!entry) return undefined;
    return {
      ...entry,
      actor: game.actors.get(entry.id),
    };
  }

  /**
   * Gets a collection of crewed actors.
   * @returns {Collection<string, Actor>} [id, actor]
   */
  getCrew() {
    if (this.type !== "pc") return undefined;
    const c = new foundry.utils.Collection();
    for (const o of this.system.compadres.details) {
      c.set(o.id, game.actors.get(o.id));
    }
    return c;
  }
}
