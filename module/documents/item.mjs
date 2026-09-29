import { TOTWBuyOffDialog } from '../helpers/chatmodifier.mjs';
import { rollAttrib } from '../helpers/diceroll.mjs';
import * as argpUtils from '../helpers/utils.mjs';

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class totowItem extends Item {
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
		let qualityMod = 0;
		switch (dataset.rollType) {
			// case 'item':

			// case 'talent':
			// 	return;

			case 'weapon':
				if (item.system.featureModifiers.length > 0) {
					for (let [key, feature] of Object.entries(item.system.featureModifiers)) {
						for (let [key, mods] of Object.entries(feature.itemModifiers)) {
							if (mods.state === 'Active') {
								qualityMod = await _switchMods(qualityMod, mods);
							}
						}
					}
				}
				// TODO  if item knife or tomahawk check if it's being thrown or used in melee.
				//  tested an it can be spoofed by:
				// set dataset.subtype to 'fightin' and dataset.itemammo to 1

				switch (dataset.subtype) {
					case 'shootin':
						dataset.mod = rollData.actor.abilities[`${dataset.subtype}`].mod + rollData.attackbonus;
						dataset.stunts = dataset.subtype;

						if (rollData.action === 'single' && rollData.ammo >= 4) {
							dataset.canFan = true;
						}
						return await shootin(dataset, rollData, item);
					case 'fightin':
						dataset.mod = rollData.actor.abilities[`${dataset.subtype}`].mod + rollData.attackbonus;
						dataset.stunts = dataset.subtype;
						return await fightin(dataset, rollData, item);

					default:
						break;
				}

			default:
				break;
		}

		async function _switchMods(qualityMod, mods) {
			switch (mods.name) {
				case 'docity':
				case 'quick':
				case 'cunning':
				case 'grit':
				case 'labor':
				case 'presence':
				case 'fightin':
				case 'resilience':
				case 'move':
				case 'operate':
				case 'shootin':
				case 'lightfingered':
				case 'hawkeye':
				case 'nature':
				case 'insight':
				case 'animalhandlin':
				case 'performin':
				case 'makin':
				case 'doctorin':
				case 'booklearnin':
					// case 'flight':
					qualityMod += Number(mods.value);
					break;
				default:
					break;
			}
			return qualityMod;
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

		async function fightin(dataset, rollData, item) {
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

		async function shootin(dataset, rollData, item) {
			const config = CONFIG.TALESOFTHEOLDWEST;
			const actor = game.actors.get(dataset.myActor);
			if (dataset.itemAmmo <= 0) {
				const chatMessage =
					`<div class="chatBG ${actor.id}"><span class="warnblink" style="font-weight:bold;font-size:larger">` +
					game.i18n.localize('TALESOFTHEOLDWEST.General.noAmmo') +
					'</span></div>';
				actor.createChatMessage(chatMessage, actor.id);
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

			dataset.successMod        = 0;
			dataset.troubleMod        = 0;
			dataset.shootrangeMod     = Number(response.rangeChoice);
			dataset.shootcalledShotsMod = Number(response.calledShots);
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
	}
}
