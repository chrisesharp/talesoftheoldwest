const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TOTWBuyOffDialog extends HandlebarsApplicationMixin(ApplicationV2) {
	constructor(chatMessage, results, options = {}) {
		super(options);
		this.chatMessage = chatMessage;
		this.origRollData = results;
	}

	/** @override */
	static DEFAULT_OPTIONS = {
		id: 'TOTWBuyOffDialog',
		classes: ['talesoftheoldwest', 'form'],
		window: {
			title: 'TALESOFTHEOLDWEST.dialog.Buy-OffTrouble',
			minimizable: false,
			resizable: true,
		},
		position: { width: 'auto', height: 'auto' },
		actions: {
			buyOff: TOTWBuyOffDialog.#onBuyOff,
		},
	};

	/** @override */
	static PARTS = {
		form: {
			template: 'systems/talesoftheoldwest/templates/dialog/buy-off.hbs',
		},
	};

	/** @override */
	async _prepareContext(options) {
		const messageResultsFlag = this.chatMessage.getFlag('talesoftheoldwest', 'results');
		const rd = Array.isArray(messageResultsFlag) ? messageResultsFlag[1] : messageResultsFlag.result;
		const myActor = game.actors.get(rd.myActor);
		const trouble = rd.trouble;
		const faith = myActor.system.general.faithpoints.value;
		const maxMod = Math.min(trouble, faith);
		return { trouble, faith, maxMod };
	}

	/** @this {TOTWBuyOffDialog} */
	static async #onBuyOff(event, target) {
		const troubleMod = Number(target.dataset.value);
		await buyOff(this.chatMessage, this.origRollData, troubleMod);
		this.close();
	}
}

export class TOTWWhichTroubleDialog extends HandlebarsApplicationMixin(ApplicationV2) {
	constructor(chatMessage, rollState, options = {}) {
		super(options);
		this.chatMessage = chatMessage;
		this.origRollData = rollState;
	}

	/** @override */
	static DEFAULT_OPTIONS = {
		id: 'TOTWWhichTroubleDialog',
		classes: ['talesoftheoldwest', 'form'],
		window: {
			title: 'TALESOFTHEOLDWEST.dialog.WhichTroubleTable',
			minimizable: false,
			resizable: true,
		},
		position: { width: 'auto', height: 'auto' },
		actions: {
			rollTrouble: TOTWWhichTroubleDialog.#onRollTrouble,
		},
	};

	/** @override */
	static PARTS = {
		form: {
			template: 'systems/talesoftheoldwest/templates/dialog/which-trouble-dialog.hbs',
		},
	};

	/** @override */
	async _prepareContext(options) {
		return {};
	}

	/** @this {TOTWWhichTroubleDialog} */
	static async #onRollTrouble(event, target) {
		const tableChoice = Number(target.dataset.value);
		await rollTrouble(this.origRollData, tableChoice, this.chatMessage, undefined);
		this.close();
	}
}

export class TOTWManualTroubleDialog extends TOTWWhichTroubleDialog {

	/** @override */
	static DEFAULT_OPTIONS = foundry.utils.mergeObject(
		TOTWWhichTroubleDialog.DEFAULT_OPTIONS,
		{
			actions: {
				rollTrouble: TOTWManualTroubleDialog.#onRollTroubleManual,
			},
		},
		{ inplace: false },
	);

	/** @override */
	static PARTS = {
		form: {
			template: 'systems/talesoftheoldwest/templates/dialog/manual-trouble-dialog.hbs',
		},
	};

	/** @this {TOTWManualTroubleDialog} */
	static async #onRollTroubleManual(event, target) {
		const tableChoice = Number(target.dataset.value);
		const form = target.closest('form') ?? target.closest('.application');
		const manModInput = form?.querySelector('[name="manMod"]');
		const formData = manModInput ? { manMod: manModInput.value } : undefined;
		await rollTrouble(this.origRollData, tableChoice, this.chatMessage, formData);
		this.close();
	}
}

async function buyOff(chatMessage, origRollData, troubleMod) {
	const rollState = Array.isArray(origRollData)
		? { roll: origRollData[0], result: origRollData[1] }
		: origRollData;
	const rd = rollState.result;

	// deduct faith points from actor
	const myActor = game.actors.get(rd.myActor);
	const newFaith = Math.max(0, myActor.system.general.faithpoints.value - troubleMod);
	await myActor.update({ 'system.general.faithpoints.value': newFaith });
	rd.trouble = Math.max(0, rd.trouble - troubleMod);
	rd.troubleRest += troubleMod;
	rd.troubleBlank += troubleMod;
	rd.faithpoints = newFaith;
	rd.buyoff = false;
	await updateChatMessage(chatMessage, null, rollState);
}

async function rollTrouble(results, tableChoice, chatMessage, formData) {
	let table = '';
	let displayText = '';
	let rollAgainst = '';
	const troubleTable = Number(tableChoice);
	const rollState = Array.isArray(results)
		? { roll: results[0], result: results[1] }
		: results;
	const rd = rollState.result;
	let trouble = 0;
	if (Number(rd.trouble) > 4) {
		trouble = 4;
	} else {
		trouble = Number(rd.trouble);
	}

	if (formData?.manMod !== undefined) {
		const parsed = Number(formData.manMod);
		trouble = Math.min(Math.max(Number.isFinite(parsed) && parsed > 0 ? parsed : 1, 1), 4);
	}

	switch (troubleTable) {
		case 1:
			table = await checkTables('CONFLICT / PHYSICAL', trouble);
			rollAgainst = 'CONFLICT / PHYSICAL';
			break;
		case 2:
			table = await checkTables('MENTAL / SOCIAL', trouble);
			rollAgainst = 'MENTAL / SOCIAL';
			break;
	}

	const TroubleTableResult = await table.draw({ displayChat: false, recursive: true });
	// Prepare the data for the chat message
	//

	switch (TroubleTableResult.results.length) {
		case 1:
			displayText = TroubleTableResult.results[0].description;
			break;
		case 2:
			displayText = TroubleTableResult.results[0].description + '<br />' + '<br />' + TroubleTableResult.results[1].description;
			break;
		case 3:
			displayText = TroubleTableResult.results[0].description + '<br />' + '<br />' + TroubleTableResult.results[2].description;
			break;
		case 4:
			displayText = TroubleTableResult.results[0].description + '<br />' + '<br />' + TroubleTableResult.results[3].description;
			break;

		default:
			break;
	}

	const actorName = chatMessage.speaker.alias;
	const actorId = chatMessage.speaker.actor;
	const htmlData = {
		actorname: actorName,
		actorId: actorId,
		img: TroubleTableResult.results[0].img,
		rollAgainst: rollAgainst,
		// textMessage: TroubleTableResult.results[0].description,
		textMessage: displayText,
	};
	// Now push the correct chat message
	const html = await foundry.applications.handlebars.renderTemplate(`systems/talesoftheoldwest/templates/chat/trouble-roll.hbs`, htmlData);
	let chatData = {
		user: game.user.id,
		speaker: {
			actor: actorId,
		},
		content: html,
		other: game.users.contents.filter((u) => u.isGM).map((u) => u.id),
		sound: CONFIG.sounds.dice,
	};

	// Mark trouble as rolled and update the original chat card
	rd.totalTrouble = 'rolledTrouble';
	await updateChatMessage(chatMessage, null, rollState);

	ChatMessage.applyMode(chatData, game.settings.get('core', 'rollMode'));
	return ChatMessage.create(chatData);
}
async function checkTables(type, trouble) {
	let tTable = `(${trouble}) TROUBLE OUTCOME TABLE - ${type}`;
	let table = game.tables.getName(`${tTable}`);
	if (table) {
		return table;
	} else {
		ui.notifications.error(game.i18n.localize('TALESOFTHEOLDWEST.General.ErrorTroubleTable'));
	}
}

export async function updateChatMessage(chatMessage, result, newRoleData) {
	const rollState = Array.isArray(newRoleData)
		? { roll: newRoleData[0], result: newRoleData[1] }
		: newRoleData;
	const rd = rollState.result;
	const html = await foundry.applications.handlebars.renderTemplate(
		'systems/talesoftheoldwest/templates/chat/roll.hbs',
		rd,
	);
	return chatMessage.update({
		content: html,
		'flags.talesoftheoldwest.results': rollState,
	});
}
