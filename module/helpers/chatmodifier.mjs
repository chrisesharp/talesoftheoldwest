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
		const myActor = game.actors.get(messageResultsFlag[1].myActor);
		const trouble = this.chatMessage.flags.talesoftheoldwest.results[1].trouble;
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
		buyOff(this.chatMessage, this.origRollData, this.origRoll, event);
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

	// remove a faith point from the actor
	const myActor = game.actors.get(origRollData[1].myActor);
	await myActor.update({ 'system.general.faithpoints.value': myActor.system.general.faithpoints.value - troubleMod });

	origRollData[1].trouble -= troubleMod;
	origRollData[1].troubleRest += troubleMod;
	origRollData[1].troubleBlank += troubleMod;
	origRollData[1].faithpoints = myActor.system.general.faithpoints.value;
	origRollData[1].buyoff -= troubleMod > 0 ? 1 : 0;
	await chatMessage.setFlag('talesoftheoldwest', 'results', origRollData);

	await updateChatMessage(chatMessage, origRoll, origRollData);
}

async function rollTrouble(results, ev, messageId, message, formData) {
	let table = '';
	let displayText = '';
	let rollAgainst = '';
	const troubleTable = Number(ev.submitter.value);
	let trouble = 0;
	if (Number(results[1].trouble) > 4) {
		trouble = 4;
	} else {
		trouble = Number(results[1].trouble);
	}

	if (formData) {
		trouble = Number(formData.manMod) || 1;
		console.log('trouble', manMod);
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
	let html = '';
	if (game.version && foundry.utils.isNewerVersion(game.version, '12.343')) {
		html = await foundry.applications.handlebars.renderTemplate(`systems/talesoftheoldwest/templates/chat/trouble-roll.hbs`, htmlData);
	} else {
		// For Foundry versions before 11, use the old renderTemplate method
		html = await renderTemplate(`systems/talesoftheoldwest/templates/chat/trouble-roll.hbs`, htmlData);
	}
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
	results[1].totalTrouble = 'rolledTrouble';

	let aMessage = game.messages.get(results[1].messageNo);
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

window.TOTWBuyOffDialog = TOTWBuyOffDialog;
window.TOTWWhichTroubleDialog = TOTWWhichTroubleDialog;
window.TOTWManualTroubleDialog = TOTWManualTroubleDialog;
