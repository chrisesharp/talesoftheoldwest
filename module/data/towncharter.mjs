import totowActorBase from "./actor-base.mjs";

export default class totowTownCharter extends totowActorBase {
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, "TALESOFTHEOLDWEST.Actor.TC"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.general = new fields.SchemaField({
      mayor: new fields.StringField({ required: true, blank: true }),
      judge: new fields.StringField({ required: true, blank: true }),
      sheriff: new fields.StringField({ required: true, blank: true }),
      deputy: new fields.StringField({ required: true, blank: true }),
      ons1: new fields.StringField({ required: true, blank: true }),
      ons2: new fields.StringField({ required: true, blank: true }),
      ons3: new fields.StringField({ required: true, blank: true }),
      ons4: new fields.StringField({ required: true, blank: true }),

      settlementponts: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
      }),
      bonussp: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      }),
      businessrollmods: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      personalfortunemods: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      townfortunemods: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      prosperitytotal: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      }),
    });

    schema.aspects = new fields.SchemaField({
      farming: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        score: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
      }),
      farmingrank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      mercantile: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        score: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
      }),
      mercantilerank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      natural: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        score: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
      }),
      naturalrank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      law: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        score: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
      }),
      lawrank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      civic: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        score: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
      }),
      civicrank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
      welfare: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        score: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
      }),
      welfarerank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
    });
    return schema;
  }

  prepareDerivedData() {
    // Calculate aspect modifiers dynamically from completed amenities items
    if (this.parent?.items) {
      let farmingMod = 0;
      let mercantileMod = 0;
      let naturalMod = 0;
      let lawMod = 0;
      let civicMod = 0;
      let welfareMod = 0;

      for (const item of this.parent.items) {
        if (item.type === "amenities" && item.system?.completed && item.system?.modifiers) {
          farmingMod += Number(item.system.modifiers.farming) || 0;
          mercantileMod += Number(item.system.modifiers.mercantile) || 0;
          naturalMod += Number(item.system.modifiers.natural) || 0;
          lawMod += Number(item.system.modifiers.law) || 0;
          civicMod += Number(item.system.modifiers.civic) || 0;
          welfareMod += Number(item.system.modifiers.welfare) || 0;
        }
      }

      this.aspects.farming.mod = farmingMod;
      this.aspects.mercantile.mod = mercantileMod;
      this.aspects.natural.mod = naturalMod;
      this.aspects.law.mod = lawMod;
      this.aspects.civic.mod = civicMod;
      this.aspects.welfare.mod = welfareMod;
    }

    this.aspects.farming.score = this.aspects.farming.value + this.aspects.farming.mod;
    this.aspects.mercantile.score = this.aspects.mercantile.value + this.aspects.mercantile.mod;
    this.aspects.natural.score = this.aspects.natural.value + this.aspects.natural.mod;
    this.aspects.law.score = this.aspects.law.value + this.aspects.law.mod;
    this.aspects.civic.score = this.aspects.civic.value + this.aspects.civic.mod;
    this.aspects.welfare.score = this.aspects.welfare.value + this.aspects.welfare.mod;

    this.aspects.farming.max = 30 - this.aspects.farming.score;
    this.aspects.mercantile.max = 30 - this.aspects.mercantile.score;
    this.aspects.natural.max = 30 - this.aspects.natural.score;
    this.aspects.law.max = 30 - this.aspects.law.score;
    this.aspects.civic.max = 30 - this.aspects.civic.score;
    this.aspects.welfare.max = 30 - this.aspects.welfare.score;

    if (this.aspects.farming.score >= 1 && this.aspects.farming.score < 3) {
      this.aspects.farmingrank.value = 1;
    } else if (this.aspects.farming.score >= 3 && this.aspects.farming.score < 7) {
      this.aspects.farmingrank.value = 2;
    } else if (this.aspects.farming.score >= 7 && this.aspects.farming.score < 13) {
      this.aspects.farmingrank.value = 3;
    } else if (this.aspects.farming.score >= 13 && this.aspects.farming.score < 19) {
      this.aspects.farmingrank.value = 4;
    } else if (this.aspects.farming.score >= 19 && this.aspects.farming.score < 27) {
      this.aspects.farmingrank.value = 5;
    } else if (this.aspects.farming.score >= 27) {
      this.aspects.farmingrank.value = 6;
    }

    if (this.aspects.mercantile.score >= 1 && this.aspects.mercantile.score < 3) {
      this.aspects.mercantilerank.value = 1;
    } else if (this.aspects.mercantile.score >= 3 && this.aspects.mercantile.score < 7) {
      this.aspects.mercantilerank.value = 2;
    } else if (this.aspects.mercantile.score >= 7 && this.aspects.mercantile.score < 13) {
      this.aspects.mercantilerank.value = 3;
    } else if (this.aspects.mercantile.score >= 13 && this.aspects.mercantile.score < 19) {
      this.aspects.mercantilerank.value = 4;
    } else if (this.aspects.mercantile.score >= 19 && this.aspects.mercantile.score < 27) {
      this.aspects.mercantilerank.value = 5;
    } else if (this.aspects.mercantile.score >= 27) {
      this.aspects.mercantilerank.value = 6;
    }
    if (this.aspects.natural.score >= 1 && this.aspects.natural.score < 3) {
      this.aspects.naturalrank.value = 1;
    } else if (this.aspects.natural.score >= 3 && this.aspects.natural.score < 7) {
      this.aspects.naturalrank.value = 2;
    } else if (this.aspects.natural.score >= 7 && this.aspects.natural.score < 13) {
      this.aspects.naturalrank.value = 3;
    } else if (this.aspects.natural.score >= 13 && this.aspects.natural.score < 19) {
      this.aspects.naturalrank.value = 4;
    } else if (this.aspects.natural.score >= 19 && this.aspects.natural.score < 27) {
      this.aspects.naturalrank.value = 5;
    } else if (this.aspects.natural.score >= 27) {
      this.aspects.naturalrank.value = 6;
    }
    if (this.aspects.law.score >= 1 && this.aspects.law.score < 3) {
      this.aspects.lawrank.value = 1;
    } else if (this.aspects.law.score >= 3 && this.aspects.law.score < 7) {
      this.aspects.lawrank.value = 2;
    } else if (this.aspects.law.score >= 7 && this.aspects.law.score < 13) {
      this.aspects.lawrank.value = 3;
    } else if (this.aspects.law.score >= 13 && this.aspects.law.score < 19) {
      this.aspects.lawrank.value = 4;
    } else if (this.aspects.law.score >= 19 && this.aspects.law.score < 27) {
      this.aspects.lawrank.value = 5;
    } else if (this.aspects.law.score >= 27) {
      this.aspects.lawrank.value = 6;
    }
    if (this.aspects.civic.score >= 1 && this.aspects.civic.score < 3) {
      this.aspects.civicrank.value = 1;
    } else if (this.aspects.civic.score >= 3 && this.aspects.civic.score < 7) {
      this.aspects.civicrank.value = 2;
    } else if (this.aspects.civic.score >= 7 && this.aspects.civic.score < 13) {
      this.aspects.civicrank.value = 3;
    } else if (this.aspects.civic.score >= 13 && this.aspects.civic.score < 19) {
      this.aspects.civicrank.value = 4;
    } else if (this.aspects.civic.score >= 19 && this.aspects.civic.score < 27) {
      this.aspects.civicrank.value = 5;
    } else if (this.aspects.civic.score >= 27) {
      this.aspects.civicrank.value = 6;
    }
    if (this.aspects.welfare.score >= 1 && this.aspects.welfare.score < 3) {
      this.aspects.welfarerank.value = 1;
    } else if (this.aspects.welfare.score >= 3 && this.aspects.welfare.score < 7) {
      this.aspects.welfarerank.value = 2;
    } else if (this.aspects.welfare.score >= 7 && this.aspects.welfare.score < 13) {
      this.aspects.welfarerank.value = 3;
    } else if (this.aspects.welfare.score >= 13 && this.aspects.welfare.score < 19) {
      this.aspects.welfarerank.value = 4;
    } else if (this.aspects.welfare.score >= 19 && this.aspects.welfare.score < 27) {
      this.aspects.welfarerank.value = 5;
    } else if (this.aspects.welfare.score >= 27) {
      this.aspects.welfarerank.value = 6;
    }

    this.general.prosperitytotal.value =
      this.aspects.farmingrank.value +
      this.aspects.mercantilerank.value +
      this.aspects.naturalrank.value +
      this.aspects.lawrank.value +
      this.aspects.civicrank.value +
      this.aspects.welfarerank.value;

    this.general.settlementponts.max = 10 - this.general.settlementponts.value;
  }

  getRollData() {}
}
