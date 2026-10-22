import { rollAttrib } from '../helpers/diceroll.mjs';
import * as argpUtils from '../helpers/utils.mjs';

/**
 * Sum the Active feature modifiers on a weapon that target the ability being rolled.
 * @param {Item} item        The weapon being rolled.
 * @param {string} ability   The ability key being rolled (e.g. 'shootin').
 * @returns {number}
 */
function _weaponFeatureMod(item, ability) {
	let total = 0;
	for (const feature of Object.values(item.system.featureModifiers ?? {})) {
		for (const mod of Object.values(feature.itemModifiers ?? {})) {
			if (mod.state === 'Active' && mod.name === ability) total += Number(mod.value) || 0;
		}
	}
	return total;
}

/**
 * Show/hide the Tens-number input in a weapon dialog.
 * Ranged: shown when the selected Called Shot has `fixesTens` and Fanning is not ticked;
 * ticking Fanning resets Called Shots to Normal and disables the dropdown.
 * Melee: shown when the Called Strike checkbox is ticked.
 * DialogV2 content is injected via innerHTML, so inline <script> would not run; this is
 * attached through the DialogV2 `render` callback instead.
 * @param {foundry.applications.api.DialogV2} dialog
 * @param {object} config  CONFIG.TALESOFTHEOLDWEST reference.
 */
function _wireTensInput(dialog, config) {
	const el = dialog.element;
	const group = el.querySelector('#tensfixedgroup');
	if (!group) return;
	const input = group.querySelector('#critTensFixed');
	const shots = el.querySelector('#calledShots');
	const fanning = el.querySelector('#isFanning');
	const strike = el.querySelector('#calledstrike');

	const update = () => {
		let show;
		if (shots) {
			const entry = Object.values(config.called_shots).find((cs) => cs.value === shots.value);
			show = !!entry?.fixesTens && !fanning?.checked;
		} else {
			show = !!strike?.checked;
		}
		group.style.display = show ? '' : 'none';
		if (!show) input.value = '';
	};

	shots?.addEventListener('change', update);
	strike?.addEventListener('change', update);
	fanning?.addEventListener('change', () => {
		if (shots) {
			if (fanning.checked) shots.value = config.called_shots.normalshot.value;
			shots.disabled = fanning.checked;
		}
		update();
	});
	update();
}

/**
 * Render a weapon modifier dialog and return the FormData response object,
 * or the string 'cancelled' if the user dismissed the dialog.
 * @param {string} templatePath  Path to the Handlebars template.
 * @param {string} titleKey      i18n key for the dialog title.
 * @param {object} dataset       Roll dataset (passed to template as context).
 * @param {object} config        CONFIG.TALESOFTHEOLDWEST reference.
 * @returns {Promise<object|'cancelled'>}
 */
async function _renderWeaponDialog(templatePath, titleKey, dataset, config, conditionalMods, talentMods) {
	const content = await foundry.applications.handlebars.renderTemplate(templatePath, { config, dataset, conditionalMods, talentMods });
	const response = await foundry.applications.api.DialogV2.wait({
		window: { title: titleKey },
		position: { width: 500 },
		content,
		rejectClose: false,
		render: (event, dialog) => _wireTensInput(dialog, config),
		buttons: [
			{
				label: 'TALESOFTHEOLDWEST.dialog.roll',
				callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
			},
			{ label: 'TALESOFTHEOLDWEST.dialog.cancel', action: 'cancel' },
		],
	});
	if (!response || response === 'cancel') return 'cancelled';
	// Accumulate checked conditional modifiers (mods.* flat keys from structured partial).
	// FormDataExtended stores dot-notation names as flat string keys, not nested objects,
	// so `response["mods.f_0"]` exists but `response.mods` is undefined.
	const checkboxSum = Object.entries(response)
		.filter(([k]) => k.startsWith('mods.'))
		.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
	response.modifier = (Number(response.modifier) || 0) + checkboxSum;
	return response;
}

async function _fightin(dataset, rollData, item) {
	const config = CONFIG.TALESOFTHEOLDWEST;
	const actor = game.actors.get(dataset.myActor);
	const { conditionalMods, talentMods } = await argpUtils.prepModOutput('Items', rollData, dataset);

	const response = await _renderWeaponDialog(
		'systems/talesoftheoldwest/templates/dialog/fightin-weapon-modifiers.html',
		'TALESOFTHEOLDWEST.fightinmodifiers',
		dataset,
		config,
		conditionalMods,
		talentMods,
	);
	if (response === 'cancelled') return 'cancelled';

	if (response.calledstrike) {
		const val = Number(response.critTensFixed);
		if (!Number.isInteger(val) || val < 1 || val > 6) {
			ui.notifications.warn(game.i18n.localize('TALESOFTHEOLDWEST.dialog.CritTargetAreaRequired'));
			return 'cancelled';
		}
		dataset.critTensFixed = val;
	} else {
		dataset.critTensFixed = null;
	}

	dataset.successMod = 0;
	dataset.troubleMod = 0;
	dataset.fightProneMod          = Number(response.prone          || 0);
	dataset.fightAlloutattackMod   = Number(response.alloutattack   || 0);
	dataset.fightCalledstrikeMod   = Number(response.calledstrike   || 0);
	dataset.fightmodifierMod       = Number(response.modifier);
	dataset.baseMod                = Number(dataset.mod);
	// DOMStringMap stores values as strings; wrap each term in Number()
	// to prevent string concatenation instead of numeric addition.
	dataset.mod = Number(dataset.mod) + Number(dataset.fightProneMod) + Number(dataset.fightAlloutattackMod) + Number(dataset.fightCalledstrikeMod) + Number(dataset.fightmodifierMod);

	const { roll, result } = await rollAttrib(dataset, rollData, actor);
	return { roll, result };
}

async function _shootin(dataset, rollData, item) {
	const config = CONFIG.TALESOFTHEOLDWEST;
	const actor = game.actors.get(dataset.myActor);
	if (dataset.itemAmmo <= 0) {
		const chatMessage =
			`<div class="chatBG ${actor.id}"><span class="warnblink" style="font-weight:bold;font-size:larger">` +
			game.i18n.localize('TALESOFTHEOLDWEST.General.noAmmo') +
			'</span></div>';
		await actor.createChatMessage(chatMessage, actor.id);
		return 'cancelled';
	}
	const { conditionalMods, talentMods } = await argpUtils.prepModOutput('Items', rollData, dataset);

	const response = await _renderWeaponDialog(
		'systems/talesoftheoldwest/templates/dialog/ranged-weapon-modifiers.hbs',
		'TALESOFTHEOLDWEST.shootinmodifiers',
		dataset,
		config,
		conditionalMods,
		talentMods,
	);
	if (response === 'cancelled') return 'cancelled';

	// The Called Shots <select> is disabled while Fanning, and disabled fields are omitted from the form data.
	const calledShotsValue = response.calledShots ?? config.called_shots.normalshot.value;
	const calledShotEntry = Object.values(config.called_shots).find((cs) => cs.value === calledShotsValue);
	if (calledShotEntry?.fixesTens && !response.isFanning) {
		const val = Number(response.critTensFixed);
		if (!Number.isInteger(val) || val < 1 || val > 6) {
			ui.notifications.warn(game.i18n.localize('TALESOFTHEOLDWEST.dialog.CritTargetAreaRequired'));
			return 'cancelled';
		}
		dataset.critTensFixed = val;
	} else {
		dataset.critTensFixed = null;
	}

	dataset.successMod        = 0;
	dataset.troubleMod        = 0;
	dataset.shootrangeMod     = Number(response.rangeChoice);
	dataset.shootcalledShotsMod = Number(calledShotsValue);
	dataset.shootcoverMod     = Number(response.coverChoice);
	dataset.shootsizeMod      = Number(response.sizeChoice);
	dataset.shootvisibilityMod = Number(response.visibilityChoice);
	dataset.shootmodifierMod  = Number(response.modifier);
	dataset.baseMod           = Number(dataset.mod);
	dataset.isFanning         = response.isFanning;
	dataset.numberOfTargets   = Number(response.numberOfTargets);

	const fanningMod = response.isFanning ? (-Math.abs(response.numberOfTargets) - 1) : 0;
	// DOMStringMap stores values as strings; wrap each term in Number()
	// to prevent string concatenation instead of numeric addition.
	dataset.mod = Number(dataset.mod) + Number(dataset.shootrangeMod) + Number(dataset.shootcalledShotsMod) +
		Number(dataset.shootcoverMod) + Number(dataset.shootsizeMod) + Number(dataset.shootvisibilityMod) + fanningMod + Number(dataset.shootmodifierMod);

	const rollState = await rollAttrib(dataset, rollData, actor);

	if (response.isFanning) {
		await item.update({ 'system.ammo': rollData.expertFanning ? 1 : 0 });
	} else {
		await item.update({ 'system.ammo': item.system.ammo - 1 });
	}
	return rollState;
}

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class totowItem extends Item {
	/**
	 * Clamp system.ammo to system.ammoMax when ammoMax > 0.
	 * Skipped when options.totowSkipAmmoClamp is set (used by migration) or
	 * when the world migration version is below 2 (migration not yet run).
	 * @param {object} changes
	 */
	_clampAmmo(changes) {
		if (this.type !== 'weapon') return;
		if (Number(game.settings.get('talesoftheoldwest', 'systemMigrationVersion')) < 2) return;
		const max = Number(foundry.utils.getProperty(changes, 'system.ammoMax') ?? this.system.ammoMax);
		if (!Number.isFinite(max) || max <= 0) return;
		const ammo = Number(foundry.utils.getProperty(changes, 'system.ammo') ?? this.system.ammo);
		if (!Number.isFinite(ammo)) return;
		if (ammo > max) foundry.utils.setProperty(changes, 'system.ammo', max);
	}

	/** @override */
	async _preCreate(data, options, user) {
		const allowed = await super._preCreate(data, options, user);
		if (allowed === false) return false;
		if (!options.totowSkipAmmoClamp) this._clampAmmo(data);
	}

	/** @override */
	async _preUpdate(changes, options, user) {
		const allowed = await super._preUpdate(changes, options, user);
		if (allowed === false) return false;
		if (!options.totowSkipAmmoClamp) this._clampAmmo(changes);
	}

	/**
	 * Augment the basic Item data model with additional dynamic data.
	 */
	prepareData() {
		// As with the actor class, items are documents that can have their data
		// preparation methods overridden (such as prepareBaseData()).
		super.prepareData();
	}

	/**
	 * Prepare a data object which defines the data schema used by dice roll commands against this Item
	 * @override
	 */
	getRollData() {
		// Starts off by populating the roll data with a shallow copy of `this.system`
		const rollData = { ...this.system };

		// Quit early if there's no parent actor
		if (!this.actor) return rollData;

		// If present, add the actor's roll data
		rollData.actor = this.actor.getRollData();
		rollData.actorType = this.actor.type;
		return rollData;
	}
	/**
	 * Handle clickable rolls.
	 * @param {Event} event   The originating click event
	 * @private
	 */
	async roll(dataset, item) {
		const rollData = this.getRollData();
		if (dataset.rollType !== 'weapon') return;

		const qualityMod = _weaponFeatureMod(item, dataset.subtype);

		switch (dataset.subtype) {
			case 'shootin':
				dataset.mod = rollData.actor.abilities[`${dataset.subtype}`].mod + rollData.attackbonus + qualityMod;
				dataset.stunts = dataset.subtype;

				if (rollData.action === 'single' && rollData.ammo >= 4) {
					dataset.canFan = true;
				}
				return await _shootin(dataset, rollData, item);
			case 'fightin':
				dataset.mod = rollData.actor.abilities[`${dataset.subtype}`].mod + rollData.attackbonus + qualityMod;
				dataset.stunts = dataset.subtype;
				return await _fightin(dataset, rollData, item);

			default:
				break;
		}
	}

	/**
		* Reload this weapon to its maximum capacity (ammoMax).
		* If ammoMax is not set (> 0), a warning is shown and ammo is untouched.
		* If the weapon is embedded on an actor, posts a chat notification.
		* @returns {Promise<boolean>} Whether the reload succeeded.
		*/
	async reload() {
		if (this.type !== 'weapon') return false;
		const { ammo, ammoMax } = this.system;
		const max = Number(ammoMax);
		if (!Number.isFinite(max) || max <= 0) {
			ui.notifications.warn(game.i18n.localize('TALESOFTHEOLDWEST.General.noAmmoMax'));
			return false;
		}
		await this.update({ 'system.ammo': max });
		const actor = this.actor ?? (this.parent instanceof Actor ? this.parent : null);
		if (actor) {
			const actorName = Handlebars.Utils.escapeExpression(actor.name);
			const weaponName = Handlebars.Utils.escapeExpression(this.name);
			const message = game.i18n.format('TALESOFTHEOLDWEST.General.reloaded', {
				actor: actorName,
				weapon: weaponName,
				from: ammo,
				to: max,
			});
			const chatMessage = `<div class="chatBG ${actor.id}"><span style="font-weight:bold">${message}</span></div>`;
			await actor.createChatMessage(chatMessage, actor.id);
		}
		return true;
	}
}
