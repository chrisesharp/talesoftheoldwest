export class TOTWBuyOffDialog extends FormApplication {
	constructor(chatMessage, results) {
		super();
		this.chatMessage = chatMessage;
		this.origRollData = results;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['form'],
			popOut: true,
			template: 'systems/talesoftheoldwest/templates/dialog/buy-off.html',
			id: 'TOTWBuyOffDialog',
			title: game.i18n.localize('TALESOFTHEOLDWEST.dialog.Buy-OffTrouble'),
			height: 'auto',
			width: 'auto',
			minimizable: false,
			resizable: true,
			closeOnSubmit: true,
			submitOnClose: false,
			submitOnChange: false,
		});
	}

	getData() {
		// Send data to the template
		let messageResultsFlag = this.chatMessage.getFlag('talesoftheoldwest', 'results');
		const rd = Array.isArray(messageResultsFlag) ? messageResultsFlag[1] : messageResultsFlag.result;
		const myActor = game.actors.get(rd.myActor);
		const trouble = rd.trouble;
		const faith = myActor.system.general.faithpoints.value;
		let maxMod = 0;
		if (trouble >= faith) {
			maxMod = faith;
		} else {
			maxMod = trouble;
		}
		return {
			trouble,
			faith,
			maxMod,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
	}

	async _onChangeInput(event) {
		if (event.currentTarget.name.match(/^si_.*$/)) {
			this.itemModifiers[event.currentTarget.name].checked = event.currentTarget.checked;
		}
		this.render();
	}

	async _updateObject(event, formData) {
		await buyOff(this.chatMessage, this.origRollData, this.origRoll, event);
	}
}

export class TOTWWhichTroubleDialog extends FormApplication {
	constructor(results, messageId, message) {
		super();
		this.origRollData = results;
		this.messageId = messageId;
		this.message = message;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['form'],
			popOut: true,
			template: 'systems/talesoftheoldwest/templates/dialog/which-trouble-dialog.hbs',
			id: 'TOTWWhichTroubleDialog',
			title: game.i18n.localize('TALESOFTHEOLDWEST.dialog.WhichTroubleTable'),
			height: 'auto',
			width: 'auto',
			minimizable: false,
			resizable: true,
			closeOnSubmit: true,
			submitOnClose: false,
			submitOnChange: false,
		});
	}

	async _updateObject(event, formData, messageId) {
		return rollTrouble(this.origRollData, event, this.messageId, this.message);
	}
}
export class TOTWManualTroubleDialog extends TOTWWhichTroubleDialog {

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['form'],
			popOut: true,
			template: 'systems/talesoftheoldwest/templates/dialog/manual-trouble-dialog.hbs',
			id: 'TOTWWhichTroubleDialog',
			title: game.i18n.localize('TALESOFTHEOLDWEST.dialog.WhichTroubleTable'),
			height: 'auto',
			width: 'auto',
			minimizable: false,
			resizable: true,
			closeOnSubmit: true,
			submitOnClose: false,
			submitOnChange: false,
		});
	}

	async _updateObject(event, formData, messageId) {
		return rollTrouble(this.origRollData, event, this.messageId, this.message, formData);
	}
}

async function buyOff(chatMessage, origRollData, origRoll, event) {
	const troubleMod = Number(event.submitter.value);
	const rd = Array.isArray(origRollData) ? origRollData[1] : origRollData.result;

	// remove a faith point from the actor
	const myActor = game.actors.get(rd.myActor);
	await myActor.update({ 'system.general.faithpoints.value': myActor.system.general.faithpoints.value - troubleMod });

	rd.trouble -= troubleMod;
	rd.troubleRest += troubleMod;
	rd.troubleBlank += troubleMod;
	rd.faithpoints = myActor.system.general.faithpoints.value;
	rd.buyoff -= troubleMod > 0 ? 1 : 0;
	// await chatMessage.setFlag('talesoftheoldwest', 'results', origRollData.results);
	await updateChatMessage(chatMessage, origRoll, origRollData);
}

async function rollTrouble(results, ev, messageId, message, formData) {
	let table = '';
	let displayText = '';
	let rollAgainst = '';
	const troubleTable = Number(ev.submitter.value);
	const rd = Array.isArray(results) ? results[1] : results.result;
	let trouble = 0;
	if (Number(rd.trouble) > 4) {
		trouble = 4;
	} else {
		trouble = Number(rd.trouble);
	}

	if (formData && formData.manMod !== undefined) {
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

	// console.log('Trouble Roll =>',roll);
	const TroubleTableResult = await table.draw({ displayChat: false, recursive: true });
	console.log('TroubleTableResult =>', TroubleTableResult);
	// Prepare the data for the chat message
	//

	switch (TroubleTableResult.results.length) {
		case 1:
			displayText = TroubleTableResult.results[0].text;
			break;
		case 2:
			displayText = TroubleTableResult.results[0].text + '<br />' + '<br />' + TroubleTableResult.results[1].text;
			break;
		case 3:
			displayText = TroubleTableResult.results[0].text + '<br />' + '<br />' + TroubleTableResult.results[2].text;
			break;
		case 4:
			displayText = TroubleTableResult.results[0].text + '<br />' + '<br />' + TroubleTableResult.results[3].text;
			break;

		default:
			break;
	}

	const actorName = game.messages.get(message).speaker.alias;
	const actorId = game.messages.get(message).speaker.actor;
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

	// remove the Roll Trouble Button
	rd.totalTrouble = 'rolledTrouble';

	let aMessage = game.messages.get(rd.messageNo);
	aMessage.setFlag('talesoftheoldwest', 'results', results);
	messageId.target.remove();
	ChatMessage.applyRollMode(chatData, game.settings.get('core', 'rollMode'));
	return ChatMessage.create(chatData);
	// return;

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
	const rd = Array.isArray(newRoleData) ? newRoleData[1] : newRoleData.result;
	return foundry.applications.handlebars.renderTemplate('systems/talesoftheoldwest/templates/chat/roll.hbs', rd).then((html) => {
		chatMessage['content'] = html;
		return chatMessage
			.update({
				content: html,
				['flags.data']: { results: newRoleData.results },
			});
	});
}

