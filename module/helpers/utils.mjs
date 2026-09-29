/**
 * @typedef {Object} ModifierEntry
 * @property {string}  id            - Stable unique ID (e.g. `f_0`, `i_0`).
 * @property {string}  name          - Modifier key name (for display).
 * @property {string}  label         - Human-readable label shown in the dialog.
 * @property {number}  value         - Numeric modifier value.
 * @property {'feature'|'item'} kind - Source kind, used for icon/colour in template.
 */

export const getID = function () {
	// Math.random should be unique because of its seeding algorithm.
	// Convert it to base 36 (numbers + letters), and grab the first 9 characters
	// after the decimal.
	return '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Scan a single item's itemModifiers (and featureModifiers) and push
 * normalised modifier objects into the provided itemMods array.
 * Shared between the actor sheet's _prepareItems and getRollData.
 *
 * @param {Item} i          The item to scan.
 * @param {Array} itemMods  The accumulator array to push into.
 */
export function findMods(i, itemMods) {
	if (!i.system.itemModifiers) return;

	const stripHtml = (s) => (s ? s.replace(/<[^>]*>?/gm, "") : "");

	if (i.type === "talent") {
		if (i.system.basicisActive) {
			for (let [, mods] of Object.entries(i.system.itemModifiers)) {
				if (mods.modtype === "basic") {
					itemMods.push({
						name: mods.name,
						itemname: i.name,
						itemtype: i.type,
						modtype: mods.modtype,
						state: mods.state,
						itemDescription: mods.description,
						value: mods.value,
						stored: i.system.stored,
						basicisActive: i.system.basicisActive ?? false,
						basicAction: stripHtml(i.system.basicAction),
					});
				}
			}
		}
		if (i.system.advisActive) {
			for (let [, mods] of Object.entries(i.system.itemModifiers)) {
				if (mods.modtype === "advanced") {
					itemMods.push({
						name: mods.name,
						itemname: i.name,
						itemtype: i.type,
						modtype: mods.modtype,
						state: mods.state,
						itemDescription: mods.description,
						value: mods.value,
						stored: i.system.stored,
						advisActive: i.system.advisActive ?? false,
						advAction: stripHtml(i.system.advAction),
					});
				}
			}
		}
	} else {
		// For crit items, use the immediate effect text as the description shown in the
		// conditional roll dialog, since mods.description is the generic item description.
		const isCrit = i.type === 'crit';
		const critDescription = isCrit
			? stripHtml(i.system.immediateeffect || i.system.imediateeffect || i.system.longtermeffect || i.name)
			: null;
		for (let [, mods] of Object.entries(i.system.itemModifiers)) {
			itemMods.push({
				name: mods.name,
				itemname: i.name,
				itemtype: i.type,
				modtype: isCrit ? null : mods.modtype,
				state: mods.state,
				itemDescription: isCrit ? critDescription : mods.description,
				value: mods.value,
				stored: i.system.stored,
				basicisActive: i.system.basicisActive ?? false,
				advisActive: i.system.advisActive ?? false,
				basicAction: stripHtml(i.system.basicAction),
				advAction: stripHtml(i.system.advAction),
			});
		}
	}

	if (i.system.featureModifiers) {
		for (let [, feature] of Object.entries(i.system.featureModifiers)) {
			for (let [, mods] of Object.entries(feature.itemModifiers)) {
				itemMods.push({
					name: feature.name,
					itemname: i.name,
					itemtype: i.type,
					feature: feature.feature ?? false,
					modtype: mods.name,
					state: mods.state,
					itemDescription: feature.description,
					value: mods.value,
					stored: i.system.stored,
					basicisActive: i.system.basicisActive ?? false,
					advisActive: i.system.advisActive ?? false,
					basicAction: stripHtml(i.system.basicAction),
					advAction: stripHtml(i.system.advAction),
				});
			}
		}
	}
}



export async function prepModOutput(rollType, rollData, dataset) {
	const conditionalMods = [];
	const talentMods      = [];
	const feature = game.i18n.localize('TALESOFTHEOLDWEST.Item.General.feature');
	if (rollType === 'Items') {
		for (const fkey in rollData.featureModifiers) {
			for (const ikey in rollData.featureModifiers[fkey].itemModifiers) {
				switch (rollData.featureModifiers[fkey].itemModifiers[ikey].state) {
					case 'Conditional':
						conditionalMods.push({
							id: `f_${conditionalMods.length}`,
							name: rollData.featureModifiers[fkey].itemModifiers[ikey].name,
							label: `${feature} - ${rollData.featureModifiers[fkey].description}`,
							value: rollData.featureModifiers[fkey].itemModifiers[ikey].value,
							kind: 'feature',
						});
						break;

					case 'Chat':
						talentMods.push({
							itemname: rollData.featureModifiers[fkey].name,
							modtype: feature,
							action: rollData.featureModifiers[fkey].description,
						});
						break;
				}
			}
		}

		for (const ikey in rollData.itemModifiers) {
			switch (rollData.itemModifiers[ikey].state) {
				case 'Conditional':
					conditionalMods.push({
						id: `i_${conditionalMods.length}`,
						name: rollData.itemModifiers[ikey].name,
						label: rollData.itemModifiers[ikey].itemDescription,
						value: rollData.itemModifiers[ikey].value,
						kind: 'item',
					});
					break;

				case 'Chat':
					talentMods.push({
						itemname: rollData.itemModifiers[ikey].name,
						modtype: null,
						action: rollData.itemModifiers[ikey].itemDescription,
					});
					break;
			}
		}
		switch (dataset.subtype) {
			case 'shootin':
				for (const akey in rollData.actor.itemMods) {
					switch (akey) {
						case 'shootin':
							rollData.expertFanning = rollData.actor.itemMods[akey].find((a) => a.itemname === 'Expert Fanning')?.basicisActive;
							modifiers(rollData.actor.itemMods, conditionalMods, talentMods, dataset, akey);
							break;
						case 'quick':
							modifiers(rollData.actor.itemMods, conditionalMods, talentMods, dataset, akey);
							break;

						default:
							break;
					}
				}
				break;
			case 'fightin':
				for (const akey in rollData.actor.itemMods) {
					switch (akey) {
						case 'fightin':
							modifiers(rollData.actor.itemMods, conditionalMods, talentMods, dataset, akey);
							break;
						case 'grit':
							modifiers(rollData.actor.itemMods, conditionalMods, talentMods, dataset, akey);
							break;

						default:
							break;
					}
				}
				break;
		}
	} else {
		// it's an Attribute or Ability.
		// dataset.key may be a raw key ("move") or an un-evaluated i18n string
		// ("TALESOFTHEOLDWEST.Attributes.quick.listName") due to a Handlebars
		// quoting bug in the attribute template. Normalise by resolving via i18n if needed.
		const rawKey = dataset.key?.trim() ?? '';
		const resolvedKey = rawKey.startsWith('TALESOFTHEOLDWEST.') ? game.i18n.localize(rawKey) : rawKey;
		// dataset.attr is the parent attribute for an ability roll (e.g. "quick" for "move").
		// Crit modifiers are keyed by attribute, so we match on either the ability key
		// itself OR its parent attribute so that e.g. a "quick" crit modifier surfaces
		// when rolling "move", "shootin", "operate", etc.
		const attrKey = dataset.attr?.trim() ?? '';
		for (const akey in rollData.itemMods) {
			if (akey === resolvedKey || (attrKey && akey === attrKey)) {
				modifiers(rollData.itemMods, conditionalMods, talentMods, dataset, akey);
			}
		}
	}
	// Return the arrays as a plain object — do NOT assign to dataset (a
	// DOMStringMap) which would coerce the arrays to "[object Object]" strings.
	return { conditionalMods, talentMods };
}

export function modifiers(itemModspath, conditionalMods, talentMods, dataset, akey) {
	itemModspath[akey].reduce((acc, akey) => {
		if (akey.state !== 'Active') {
			if (akey.basicisActive) {
				switch (akey.state) {
					case 'Conditional':
						conditionalMods.push({
							id: `f_${conditionalMods.length}`,
							name: akey.name,
							label: `${akey.itemname} — ${akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1)} - ${akey.basicAction}`,
							value: akey.value,
							kind: 'feature',
						});
						break;

					case 'Chat':
						talentMods.push({
							itemname: akey.itemname,
							modtype: akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1),
							action: akey.basicAction,
						});
						break;
				}
			} else if (akey.advisActive) {
				switch (akey.state) {
					case 'Conditional':
						conditionalMods.push({
							id: `f_${conditionalMods.length}`,
							name: akey.name,
							label: `${akey.itemname} — ${akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1)} - ${akey.advAction}`,
							value: akey.value,
							kind: 'feature',
						});
						break;

					case 'Chat':
						talentMods.push({
							itemname: akey.itemname,
							modtype: akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1),
							action: akey.advAction,
						});
						break;
				}
			} else if ((akey.itemtype === 'item' || akey.itemtype === 'animalquality' || akey.itemtype === 'crit') && !akey.stored) {
				switch (akey.state) {
					case 'Conditional': {
						const itemModType = akey.modtype
							? `${akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1)} - `
							: '';
						conditionalMods.push({
							id: `i_${conditionalMods.length}`,
							name: akey.name,
							label: `${akey.itemname}${itemModType ? ` — ${itemModType}` : ''} ${akey.itemDescription}`,
							value: akey.value,
							kind: 'item',
						});
						break;
					}
					case 'onPC':
						if (dataset.myHorse === 'true') {
							const onPcModType = akey.modtype
								? `${akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1)} - `
								: '';
							conditionalMods.push({
								id: `i_${conditionalMods.length}`,
								name: akey.name,
								label: `${akey.itemname}${onPcModType ? ` — ${onPcModType}` : ''} ${akey.itemDescription}`,
								value: akey.value,
								kind: 'item',
							});
						}
						break;

					case 'Chat':
						talentMods.push({
							itemname: akey.itemname,
							modtype: akey.modtype ? akey.modtype.charAt(0).toUpperCase() + akey.modtype.slice(1) : null,
							action: akey.itemDescription,
						});
						break;
				}
			}
		} else return acc;
	}, []);
}

export function parents(el, selector) {
	const myParents = [];
	while ((el = el.parentNode) && el !== document) {
		if (!selector || el.matches(selector)) myParents.push(el);
	}
	return myParents;
}

// This is the important part!
export function collapseSection(element) {
	// get the height of the element's inner content, regardless of its actual size
	let sectionHeight = element.scrollHeight;

	// temporarily disable all css transitions
	let elementTransition = element.style.transition;
	element.style.transition = '';

	// on the next frame (as soon as the previous style change has taken effect),
	// explicitly set the element's height to its current pixel height, so we
	// aren't transitioning out of 'auto'
	requestAnimationFrame(function () {
		element.style.height = sectionHeight + 'px';
		element.style.transition = elementTransition;

		// on the next frame (as soon as the previous style change has taken effect),
		// have the element transition to height: 0
		requestAnimationFrame(function () {
			element.style.height = 0 + 'px';
		});
	});

	// mark the section as "currently collapsed"
	element.setAttribute('data-collapsed', 'true');
}

export function expandSection(element) {
	// get the height of the element's inner content, regardless of its actual size
	let sectionHeight = element.scrollHeight;

	// have the element transition to the height of its inner content
	element.style.height = sectionHeight + 'px';

	// when the next css transition finishes (which should be the one we just triggered)
	element.addEventListener('transitionend', function transitionend(e) {
		// remove this event listener so it only gets triggered once
		element.removeEventListener('transitionend', transitionend);

		// remove "height" from the element's inline styles, so it can return to its initial value
		element.style.height = null;
	});

	// mark the section as "currently not collapsed"
	element.setAttribute('data-collapsed', 'false');
}
