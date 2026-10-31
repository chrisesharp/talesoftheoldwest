import { totowActorSheet } from "./actor-sheet.mjs";

const MAX_COWBOYS = 10;
const MAX_SCOUTS = 2;

/**
 * Sheet for the Wagon Train actor type.
 * Extends the standard actor sheet, adding trail roles, morale and supplies.
 * @extends {totowActorSheet}
 */
export class totowWagonTrainSheet extends totowActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      changeMorale: { handler: this._changeMorale, buttons: [0, 2] },
      changeResource: { handler: this._changeResource, buttons: [0, 2] },
      roleView: { handler: this._onRoleView, buttons: [0, 2] },
      roleRemove: { handler: this._onRoleRemove, buttons: [0, 2] },
    },
  };

  /** @override */
  static PARTS = {
    ...totowActorSheet.PARTS,
    wagontrain: {
      template: "systems/talesoftheoldwest/templates/actor/wagontrain.hbs",
      scrollable: [""],
    },
  };

  /* -------------------------------------------- */

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Limited view keeps the base header and tabs only
    if (this.document.limited) return;
    options.parts = ["tcheader", "tabs", "wagontrain"];
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (this.document.img === "icons/svg/mystery-man.svg" && this.document.img !== this.img) {
      this.document.update({ img: "icons/svg/barrel.svg" });
    }
    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    context = await super._preparePartContext(partId, context);
    if (partId === "wagontrain") {
      context.tab = context.tabs[partId];
      context.wagonRoles = this.#prepareRoles();
    }
    return context;
  }

  /**
   * Resolve the actors assigned to each trail role, padding the cowboy and
   * scout lists with one empty slot while there is capacity left.
   * @returns {object}
   */
  #prepareRoles() {
    const roles = this.actor.system.roles ?? {};
    const resolveActor = (id) => (id ? game.actors.get(id) : null);

    const toSlots = (ids, capacity) => {
      const slots = (ids ?? []).filter(Boolean).map((id, index) => ({ index, id, actor: resolveActor(id) }));
      if (slots.length < capacity) slots.push({ index: slots.length, id: "", actor: null });
      return slots;
    };

    return {
      leads: {
        trailboss: { id: roles.trailboss, actor: resolveActor(roles.trailboss) },
        quartermaster: { id: roles.quartermaster, actor: resolveActor(roles.quartermaster) },
        wrangler: { id: roles.wrangler, actor: resolveActor(roles.wrangler) },
        agent: { id: roles.agent, actor: resolveActor(roles.agent) },
      },
      cowboys: toSlots(roles.cowboys, MAX_COWBOYS),
      scouts: toSlots(roles.scouts, MAX_SCOUTS),
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _getTabs(parts) {
    // Default to this sheet's own tab the first time it renders
    this.tabGroups.primary ??= "wagontrain";
    const tabs = super._getTabs(parts);
    if (tabs.wagontrain) {
      Object.assign(tabs.wagontrain, {
        id: "wagontrain",
        label: "TALESOFTHEOLDWEST.Actor.Tabs.WagonTrain",
        cssClass: this.tabGroups.primary === "wagontrain" ? "active" : "",
      });
    }
    return tabs;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async _changeMorale(event, target) {
    return this._changeValue(event, "system.moralepoints");
  }

  static async _changeResource(event, target) {
    return this._changeValue(event, `system.resources.${target.dataset.resource}`);
  }

  static async _onRoleView(event, target) {
    event.preventDefault();
    const actor = game.actors.get(target.dataset.actorId);
    return actor?.sheet?.render({ force: true });
  }

  static async _onRoleRemove(event, target) {
    event.preventDefault();
    const { role, index } = target.dataset;
    if (!role) return;

    if (role === "cowboys" || role === "scouts") {
      const idx = Number.parseInt(index, 10);
      if (Number.isNaN(idx)) return;

      const currentList = Array.from(this.actor.system.roles[role] ?? []).filter(Boolean);
      currentList.splice(idx, 1);

      return await this.actor.update({ [`system.roles.${role}`]: currentList });
    }

    return await this.actor.update({ [`system.roles.${role}`]: "" });
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /**
   * Dropped actors are assigned to the trail role under the drop target.
   * @override
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
    const actor = await fromUuid(data.uuid);
    if (!actor) return;
    return await this._dropTrailMember(event, actor.id);
  }

  async _dropTrailMember(event, actorId) {
    const crew = game.actors.get(actorId);
    if (!(crew?.type === "pc" || crew?.type === "npc")) return;

    const dropTarget = event.target.closest("[data-role]");
    if (!dropTarget) return;

    const { role } = dropTarget.dataset;
    if (!role) return;

    if (role === "cowboys" || role === "scouts") {
      const maxCapacity = role === "cowboys" ? MAX_COWBOYS : MAX_SCOUTS;
      const currentList = Array.from(this.actor.system.roles[role] ?? []).filter(Boolean);

      // An Actor can only appear once in a given list. If already present or full, silently ignore.
      if (currentList.includes(actorId) || currentList.length >= maxCapacity) return;

      currentList.push(actorId);
      return await this.actor.update({ [`system.roles.${role}`]: currentList });
    }

    return await this.actor.update({ [`system.roles.${role}`]: actorId });
  }
}
