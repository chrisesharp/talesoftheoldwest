import totowCreatureBase from './creature-base.mjs';

export default class totowNPC extends totowCreatureBase {
	static defineSchema() {
		const fields = foundry.data.fields;
		const requiredInteger = { required: true, nullable: false, integer: true };
		const schema = super.defineSchema();

		schema.general = new fields.SchemaField({
			archetype: new fields.StringField({ required: true, blank: true }),
			cash: new fields.StringField({ required: false, blank: true }),
			age: new fields.SchemaField({
				value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
			}),
		});
		return schema;
	}
}
