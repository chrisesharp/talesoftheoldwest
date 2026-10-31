import totowItemBase from './item-base.mjs';

export default class totowWagonTrain extends totowItemBase {
    static defineSchema() {
        const fields = foundry.data.fields;
        const requiredInteger = { required: true, nullable: false, integer: true };
        const schema = super.defineSchema();

        schema.roles = new fields.SchemaField({
            trailboss: new fields.StringField({ required: true, blank: true }),
            quartermaster: new fields.StringField({ required: true, blank: true }),
            wrangler: new fields.StringField({ required: true, blank: true }),
            agent: new fields.StringField({ required: true, blank: true }),
            cowboys: new fields.ArrayField(new fields.StringField({ required: true, blank: true })),
            scouts: new fields.ArrayField(new fields.StringField({ required: true, blank: true })),
        });

        schema.moralepoints = new fields.SchemaField({
            value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
            max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
        });

        schema.resources = new fields.SchemaField({
            food: new fields.SchemaField({
                value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
                max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
            }),
            water: new fields.SchemaField({
                value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
                max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
            }),
            medicine: new fields.SchemaField({
                value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
                max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
            }),
            ammunition: new fields.SchemaField({
                value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
                max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 30 }),
            }),
            money: new fields.SchemaField({
                value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
                initial: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
            }),
            cattle: new fields.SchemaField({
                value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
                initial: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
            }),
        });

        return schema;
    }

    prepareDerivedData() {
        const dotResources = ['food', 'water', 'medicine', 'ammunition'];
        dotResources.forEach(key => this.resources[key].max = 30 - this.resources[key].value);
        this.moralepoints.max = 10 - this.moralepoints.value;
    }
}