import totowActorBase from './actor-base.mjs';

export default class totowANIMAL extends totowActorBase {
	static defineSchema() {
		const fields = foundry.data.fields;
		const requiredInteger = { required: true, nullable: false, integer: true };
		const schema = super.defineSchema();

		schema.attributes = new fields.SchemaField({
			grit: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				label: new fields.StringField({ required: true, blank: true }),
			}),
			quick: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				label: new fields.StringField({ required: true, blank: true }),
			}),
			cunning: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				label: new fields.StringField({ required: true, blank: true }),
			}),
		});
		schema.abilities = new fields.SchemaField({
			resilience: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				label: new fields.StringField({ required: true, blank: true }),
				total: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				upper: new fields.StringField({ required: true, blank: true }),
				attr: new fields.StringField({ required: true, blank: true }),
			}),
			fightin: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				label: new fields.StringField({ required: true, blank: true }),
				total: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				upper: new fields.StringField({ required: true, blank: true }),
				attr: new fields.StringField({ required: true, blank: true }),
			}),
			move: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				label: new fields.StringField({ required: true, blank: true }),
				total: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				upper: new fields.StringField({ required: true, blank: true }),
				attr: new fields.StringField({ required: true, blank: true }),
			}),
			hawkeye: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				mod: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 5 }),
				label: new fields.StringField({ required: true, blank: true }),
				total: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
				upper: new fields.StringField({ required: true, blank: true }),
				attr: new fields.StringField({ required: true, blank: true }),
			}),
		});

		schema.damage = new fields.SchemaField({
			hurts: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
			}),
			shakes: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
			}),
			vexes: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
				max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
			}),
		});

		schema.conditions = new fields.SchemaField({
			broken: new fields.BooleanField({ initial: false }),
		});

		schema.general = new fields.SchemaField({
			breed: new fields.StringField({ required: true, blank: true }),
			cost: new fields.StringField({ initial: '0', min: 0, required: false, blank: true }),
			attacks: new fields.HTMLField(),
			subtype: new fields.StringField({ required: false, blank: true, initial: 'horse' }),
			mounted: new fields.BooleanField({ initial: false }),

			ridingmodifier: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
			}),
		});
		return schema;
	}

	prepareDerivedData() {
		for (const akey in this.attributes) {
			this.attributes[akey].label = game.i18n.localize(CONFIG.TALESOFTHEOLDWEST.attributes[akey].name) ?? akey;
		}

		for (const key in this.abilities) {
			this.abilities[key].attr = game.i18n.localize(CONFIG.TALESOFTHEOLDWEST.animalabilities[key].atob) ?? key;

			// Handle ability label localization.
			this.abilities[key].label = game.i18n.localize(CONFIG.TALESOFTHEOLDWEST.animalabilities[key].name) ?? key;
			this.abilities[key].upper = game.i18n.localize(CONFIG.TALESOFTHEOLDWEST.animalabilities[key].name).toUpperCase() ?? key;
		}

		this.damage.hurts.max  = this.attributes.grit.max    - this.damage.hurts.value;
		this.damage.shakes.max = this.attributes.quick.max   - this.damage.shakes.value;
		this.damage.vexes.max  = this.attributes.cunning.max - this.damage.vexes.value;
		if (!this.damage.hurts.max || !this.damage.shakes.max || !this.damage.vexes.max) {
			this.conditions.broken = true;
		} else {
			this.conditions.broken = false;
		}

		// --- Attribute and ability mod calculation from active items ---
		const attrMod = { grit: 0, quick: 0, cunning: 0 };
		const sklMod = {};

		if (this.parent?.items?.size) {
			for (const item of this.parent.items) {
				if (!item.system?.itemModifiers || item.system.stored) continue;
				for (const mod of Object.values(item.system.itemModifiers)) {
					if (mod.state !== 'onAnimal') continue;
					const val = Number(mod.value) || 0;
					const target = mod.name?.toLowerCase();
					if (target in attrMod) attrMod[target] += val;
					else if (!mod.feature) sklMod[target] = (sklMod[target] ?? 0) + val;
				}
			}
		}

		for (const [a, abl] of Object.entries(this.attributes)) {
			this.attributes[a].mod = Number(abl.value) + Number(attrMod[a] ?? 0);
		}
		for (const [s, skl] of Object.entries(this.abilities)) {
			const attrBase = this.attributes[skl.attr]?.mod ?? 0;
			this.abilities[s].mod = Number(skl.value) + Number(attrBase) + Number(sklMod[s] ?? 0);
		}
	}
	getRollData() {
		const data = {};

		// Copy the ability scores to the top level, so that rolls can use
		// formulas like `@str.mod + 4`.
		if (this.abilities) {
			for (let [k, v] of Object.entries(this.abilities)) {
				data[k] = foundry.utils.deepClone(v);
			}
		}
		if (this.attributes) {
			for (let [k, v] of Object.entries(this.attributes)) {
				data[k] = foundry.utils.deepClone(v);
			}
		}

		return data;
	}
}
