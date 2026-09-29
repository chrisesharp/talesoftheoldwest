import { TOTWWhichTroubleDialog, TOTWBuyOffDialog, TOTWManualTroubleDialog, updateChatMessage } from './chatmodifier.mjs';
// import { prepModOutput } from './utils.mjs';

/**
 * @typedef {Object} TOTWRollState
 * @property {Roll}    roll          - The Foundry Roll instance.
 * @property {Object}  result        - The evaluated result data produced by evaluateTOTWRoll.
 * @property {string}  result.myActor
 * @property {string}  result.rollType
 * @property {number}  result.trouble
 * @property {number}  result.troubleSucc
 * @property {number}  result.troubleRest
 * @property {number}  result.normalSucc
 * @property {number}  result.rest
 * @property {number}  result.totalSuccess
 * @property {number}  result.totalTrouble
 * @property {string}  result.canPush    - 'push' | 'pushed' | 'no' | 'fullHouse'
 * @property {boolean} result.buyoff
 * @property {number}  result.faithpoints
 * @property {number}  result.messageNo
 */

export async function totowDiceButtons(message, html, msgContent) {
	const messageId = message.id;

	let buttonArea = html.querySelector('#buttonlist');
	let pcType = message.getFlag('talesoftheoldwest', 'isType');

	if (message && pcType == 'pc') {
		const raw = message.getFlag('talesoftheoldwest', 'results');
		if (raw) {
			const rd = Array.isArray(raw) ? raw[1] : raw.result;
			if (rd.faithpoints >= 1) {
				if ((rd.trouble > 0 && rd.buyoff) || (rd.trouble > 0 && rd.canPush !== 'pushed')) {
					let button = document.createElement('button');
					button.classList.add('dice-formula', 'dice-roll', 'chat-buttons', 'buy-off');
					button.dataset.messageId = messageId;
					button.dataset.rollType = rd.rollType;
					button.dataset.rollButton = 'buy-off';
					button.innerHTML = game.i18n.localize('TALESOFTHEOLDWEST.dialog.Buy-OffTrouble');
					buttonArea.appendChild(button);
				}
				if (rd.trouble > 0 && rd.totalTrouble !== 'rolledTrouble') {
					let button = document.createElement('button');
					button.classList.add('dice-formula', 'dice-roll', 'chat-buttons', 'roll-trouble');
					button.dataset.messageId = messageId;
					button.dataset.rollType = rd.rollType;
					button.dataset.rollButton = 'roll-trouble';
					button.dataset.tooltip = game.i18n.localize('TALESOFTHEOLDWEST.dialog.Tooltip-ManualRoll');
					button.innerHTML = game.i18n.localize('TALESOFTHEOLDWEST.General.rollTrouble');
					buttonArea.appendChild(button);
				}
				if (rd.canPush === 'push' && rd.totalTrouble !== 'rolledTrouble') {
					let button = document.createElement('button');
					button.classList.add('dice-formula', 'dice-roll', 'chat-buttons', 'dice-push');
					button.dataset.messageId = messageId;
					button.dataset.rollType = rd.rollType;
					button.dataset.rollButton = 'push';
					button.innerHTML = game.i18n.localize('TALESOFTHEOLDWEST.General.push');
					buttonArea.appendChild(button);
				}

				if (rd.canPush === 'pushed' && rd.totalTrouble !== 'rolledTrouble') {
					let span = document.createElement('span');
					span.classList.add('dice-formula', 'dice-roll', 'pushed-button');
					span.dataset.messageId = messageId;
					span.dataset.rollType = rd.rollType;
					span.dataset.rollButton = 'pushed';
					span.innerHTML = game.i18n.localize('TALESOFTHEOLDWEST.General.pushed');
					buttonArea.appendChild(span);
				}
			} else if (rd.faithpoints === 0) {
					let span = document.createElement('span');
					span.classList.add('dice-formula', 'dice-roll', 'pushed-button');
					span.dataset.messageId = messageId;
					span.dataset.rollType = rd.rollType;
					span.dataset.rollButton = 'no-faith';
					span.innerHTML = game.i18n.localize('TALESOFTHEOLDWEST.General.lackFaith');
					buttonArea.appendChild(span);
				}
		}
	}
}
let _chatListenersInitialized = false;

export function totowDiceListeners() {
	if (_chatListenersInitialized) return;
	_chatListenersInitialized = true;

	document.addEventListener('click', async (ev) => {
		const button = ev.target.closest('[data-roll-button]');
		if (!button) return;

		const rollButton = button.dataset.rollButton;
		const messageId = button.dataset.messageId;
		if (!rollButton || !messageId) return;

		const message = game.messages?.get(messageId);
		if (!message) return;

		const raw = message.getFlag('talesoftheoldwest', 'results');
		if (!raw) return;
		const rollState = Array.isArray(raw)
			? { roll: raw[0], result: raw[1] }
			: raw;
		if (!rollState.result) return;

		switch (rollButton) {
			case 'push': {
				ev.preventDefault();
				ev.stopPropagation();
				if (!rollState.result.canPush) {
					let errorObj = { error: 'totow.ErrorsAlreadyPushed' };
					return ui.notifications.warn(new Error(game.i18n.localize(errorObj.error)));
				} else {
					return pushRoll(message, rollState);
				}
			}
			case 'buy-off': {
				ev.preventDefault();
				ev.stopPropagation();
				new TOTWBuyOffDialog(message, rollState).render({ force: true });
				break;
			}
			case 'roll-trouble': {
				ev.preventDefault();
				ev.stopPropagation();
				if (ev.shiftKey) {
					new TOTWManualTroubleDialog(rollState, ev, messageId, message).render({ force: true });
				} else {
					new TOTWWhichTroubleDialog(rollState, ev, messageId, message).render({ force: true });
				}
				break;
			}
		}
	});
}

export async function pushRoll(chatMessage, origRollData) {
	// Normalise legacy array-shaped flag to named shape
	const rollState = Array.isArray(origRollData)
		? { roll: origRollData[0], result: origRollData[1] }
		: origRollData;
	const rd = rollState.result;

	const formula = rd.troubleRest + `dt` + '+' + rd.rest + `ds`;
	let roll = await Roll.create(`${formula}`).evaluate();

	// remove a faith point from the actor
	const myActor = game.actors.get(rd.myActor);
	await myActor.update({ 'system.general.faithpoints.value': myActor.system.general.faithpoints.value - 1 });

	rd.canPush = 'pushed';
	let result = await evaluateTOTWRoll(rd, roll, formula);

	const totalRolled = result.troubleSucc + result.trouble + result.troubleRest + result.normalSucc + result.rest <= 0;

	rd.formula = formula;
	rd.troubleSucc += result.troubleSucc;
	rd.troubleFive = result.troubleFive;
	rd.troubleFour = result.troubleFour;
	rd.troubleThree = result.troubleThree;
	rd.troubleTwo = result.troubleTwo;
	rd.trouble += result.trouble;
	rd.totalTrouble += result.totalTrouble;
	rd.troubleBlank = 0;
	rd.troubleRest = result.troubleRest;
	rd.normalSucc += result.normalSucc;
	rd.normalFive = result.normalFive;
	rd.normalFour = result.normalFour;
	rd.normalThree = result.normalThree;
	rd.normalTwo = result.normalTwo;
	rd.normalOne = result.normalOne;
	rd.rest = result.rest;
	rd.totalSuccess += result.totalSuccess;
	rd.faithpoints = myActor.system.general.faithpoints.value;
	const finalSuccesses = rd.totalSuccess;
	rd.criticalSuccess = finalSuccesses >= 3;
	rd.successes = totalRolled ? finalSuccesses === 2 : finalSuccesses > 0 && finalSuccesses < 3;
	rd.failure = totalRolled ? finalSuccesses < 2 : finalSuccesses === 0;
	rd.totalRolled = totalRolled;
	rd.buyoff += result.trouble > 0 ? 1 : 0;

	let msg = game.messages.get(chatMessage.id);
	await msg.setFlag('talesoftheoldwest', 'results', { roll: rollState.roll, result: rd });

	await updateChatMessage(chatMessage, result, { roll: rollState.roll, result: rd });
}

export async function rollAttrib(dataset, rollData, actor) {
	let formula = '';
	let roll = '';
	let result = '';
	if (dataset.mod - 5 <= 0) {
		formula = Number.parseInt(`${dataset.mod}`) + `dt`;
		roll = await Roll.create(`${formula}`).evaluate();
		result = await evaluateTOTWRoll(dataset, roll, formula, rollData);
	} else {
		let troubleDice = `5dt`;
		const extra = Number.parseInt(`${dataset.mod}`) - 5;
		const formula = troubleDice + '+' + `${extra}` + `ds`;
		roll = await Roll.create(`${formula}`).evaluate();
		result = await evaluateTOTWRoll(dataset, roll, formula, rollData);
	}
	if (result.totalSuccess > 2 && actor.type === 'pc') {
		result = await addFaithPoints(result);
	}
	return { roll, result };
}

export async function addFaithPoints(result) {
	const myActor = game.actors.get(result.myActor);
	if (myActor.system.general.faithpoints.value === 0 && result.totalSuccess > 3) {
		await myActor.update({ 'system.general.faithpoints.value': myActor.system.general.faithpoints.value + 1 });
		result.faithpoints = 1;
		result.faithAdded = true;
	} else if (myActor.system.general.faithpoints.value > 0 && myActor.system.general.faithpoints.value < 10) {
			await myActor.update({ 'system.general.faithpoints.value': myActor.system.general.faithpoints.value + 1 });
			result.faithAdded = true;
		}
	return result;
}

export async function evaluateTOTWRoll(dataset, roll, formula, itemData) {
	let troubleSucc = 0; // rolls of 6
	let troubleFive = 0;
	let troubleFour = 0;
	let troubleThree = 0;
	let troubleTwo = 0;
	let trouble = 0; // Rolls of 1
	let troubleRest = 0;
	let normalSucc = 0;
	let normalFive = 0;
	let normalFour = 0;
	let normalThree = 0;
	let normalTwo = 0;
	let normalOne = 0;
	let rest = 0;
	let troubleBlank = 0;
	let totalSuccess = 0;
	let canPush = dataset.canPush;
	let ability = '';
	let stunts = '';
	const tDice = roll.dice[0];

	tDice.results.forEach((r) => {
		switch (r.result) {
			case 6:
				troubleSucc++;
				totalSuccess++;
				break;
			case 5:
				troubleFive++;
				troubleRest++;
				break;
			case 4:
				troubleFour++;
				troubleRest++;

				break;
			case 3:
				troubleThree++;
				troubleRest++;
				break;
			case 2:
				troubleTwo++;
				troubleRest++;
				break;
			case 1:
				trouble++;
				break;
		}
	});
	if (roll.dice.length > 1) {
		const eDice = roll.dice[1];
		eDice.results.forEach((r) => {
			switch (r.result) {
				case 6:
					normalSucc++;
					totalSuccess++;
					break;
				case 5:
					normalFive++;
					rest++;
					break;
				case 4:
					normalFour++;
					rest++;
					break;
				case 3:
					normalThree++;
					rest++;
					break;
				case 2:
					normalTwo++;
					rest++;
					break;
				case 1:
					normalOne++;
					rest++;
					break;
			}
		});
	}

	// This is where the sucess and troupble mods from weapons and talents needs to go.

	const numberOfDice = troubleSucc + trouble + troubleRest + normalSucc + rest;
	const totalRolled = numberOfDice <= 0;
	if (troubleRest + rest + troubleBlank === 0) {
		canPush = 'no';
	} else if (totalSuccess === numberOfDice || trouble === numberOfDice) {
			canPush = 'fullHouse';
		}

	// Attribute = dataset.label;  Do not have stunts
	// Ability = dataset.label;
	// weapon = dataset.ability;

	// Strip out special characters and spaces, convert to lowercase and capitalise the first letter of the String.
	if (canPush != 'pushed') {
		if (dataset.rollType != 'attribute') {
			ability = dataset.stunts
				.replace(/[^A-Z0-9]/gi, '')
				.toLowerCase()
				.replace(/\b[a-z](?=[a-z]{2})/g, function (letter) {
					return letter.toUpperCase();
				});

			stunts = game.i18n.localize('TALESOFTHEOLDWEST.Ability.' + [ability] + '.stunts');
		} else {
			stunts = game.i18n.localize('TALESOFTHEOLDWEST.ItemModifierSelect.none');
		}
	}

	let evalResult = {
		myActor: dataset.myActor,
		itemData: itemData,
		rollType: dataset.rollType,
		formula: roll.formula,
		title: dataset.label,
		troubleSucc: troubleSucc,
		troubleFive: troubleFive,
		troubleFour: troubleFour,
		troubleThree: troubleThree,
		troubleTwo: troubleTwo,
		trouble: trouble,
		troubleRest: troubleRest,
		totalTrouble: trouble,
		normalSucc: normalSucc,
		normalFive: normalFive,
		normalFour: normalFour,
		normalThree: normalThree,
		normalTwo: normalTwo,
		normalOne: normalOne,
		rest: rest,
		totalSuccess: totalSuccess,
		troubleBlank: troubleBlank,
		canPush: canPush,
		faithpoints: Number.parseInt(dataset.faithpoints),
		successes: totalRolled ? totalSuccess === 2 : totalSuccess > 0 && totalSuccess < 3,
		criticalSuccess: totalSuccess >= 3,
		failure: totalRolled ? totalSuccess < 2 : totalSuccess === 0,
		totalRolled: totalRolled,
		oldRoll: roll,
		modifiers: { ...dataset},
		messageNo: 0,
		faithAdded: false,
		ability: ability,
		stunts: stunts,
		buyoff: trouble > 0,
	};
	// console.log('evalResult', evalResult);
	return evalResult;
}
