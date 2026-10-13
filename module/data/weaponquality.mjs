import totowItemBase from './item-base.mjs';

export default class totowWeaponQuality extends totowItemBase {
	static defineSchema() {
		const fields = foundry.data.fields;
		const schema = super.defineSchema();

		schema.feature = new fields.StringField({ required: true, blank: true });
		schema.weapontype = new fields.StringField({ required: true, blank: true, initial: 'ranged' });
		schema.onweapon = new fields.StringField({ required: true, blank: true, initial: 'any' });

		return schema;
	}
}
