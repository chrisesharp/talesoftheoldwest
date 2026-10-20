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
	return '_' + Math.random().toString(36).slice(2, 11);
};

export function localStringToNumber(s) {
	return Number(String(s).replace(/[^0-9.-]+/g, ""));
}

export function formatCurrencyInput(e) {
	const value = localStringToNumber(e.target.value);
	if (game.settings.get("talesoftheoldwest", "dollar"))
		e.target.value = value ? Intl.NumberFormat("en-EN", { style: "currency", currency: "USD" }).format(value) : "$0.00";
	else
		e.target.value = value
			? Intl.NumberFormat("en-EN", { style: "decimal", useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
			: "0.00";
}

export const stripHtml = (s) => (s ? s.replace(/<[^>]*>?/gm, "") : "");

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

function buildLabel(mod, action) {
	if (action) {
		return `${mod.itemname} — ${capitalize(mod.modtype)} - ${action}`;
	}
	const typePart = mod.modtype ? `${capitalize(mod.modtype)} - ` : '';
	const sep      = typePart ? ` — ${typePart}` : '';
	return `${mod.itemname}${sep}${mod.itemDescription}`;
}

function getActiveTalent(mod) {
	if (mod.basicisActive) return { action: mod.basicAction };
	if (mod.advisActive)   return { action: mod.advAction };
	return null;
}

function pushConditional(conditionalMods, kind, mod, label) {
	const prefix = kind === 'feature' ? 'f' : 'i';
	conditionalMods.push({ id: `${prefix}_${conditionalMods.length}`, name: mod.name, label, value: mod.value, kind });
}

function pushTalent(talentMods, mod, action) {
	talentMods.push({ itemname: mod.itemname, modtype: capitalize(mod.modtype), action });
}

/**
 * Construct a normalized modifier entry from a raw modifier descriptor and its parent item.
 *
 * @param {object} mod         - Raw modifier object from system.itemModifiers.
 * @param {Item}   i           - Parent item.
 * @param {object} [overrides] - Property overrides or extra tier metadata.
 * @returns {object}
 */
export function createMod(mod, i, overrides = {}) {
	return {
		name: mod.name,
		itemname: i.name,
		itemtype: i.type,
		modtype: mod.modtype ?? null,
		state: mod.state,
		itemDescription: mod.description,
		value: mod.value,
		stored: i.system?.stored ?? false,
		...overrides,
	};
}

/**
 * Scan a single item's itemModifiers (and featureModifiers) and push
 * normalised modifier objects into the provided itemMods array.
 * Shared between the actor sheet's _prepareItems and getRollData.
 *
 * @param {Item} i          The item to scan.
 * @param {Array} itemMods  The accumulator array to push into.
 */
export function findMods(i, itemMods) {
	const system = i?.system;
	if (!system?.itemModifiers) return;

	const { type: itemtype } = i;
	const { basicisActive = false, advisActive = false } = system;
	const basicAction = stripHtml(system.basicAction);
	const advAction = stripHtml(system.advAction);

	// 1. Process direct itemModifiers
	for (const mod of Object.values(system.itemModifiers)) {
		processItemMods(mod);
	}

	// 2. Process nested featureModifiers
	if (system.featureModifiers) {
		for (const feature of Object.values(system.featureModifiers).filter((f) => f.itemModifiers)) {
			for (const mod of Object.values(feature.itemModifiers)) {
				itemMods.push(createMod(mod, i, {
					name: feature.name,
					modtype: mod.name,
					itemDescription: feature.description,
					feature: feature.feature ?? false,
					basicisActive,
					advisActive,
					basicAction,
					advAction,
				}));
			}
		}
	}

	function processItemMods(mod) {
		if (itemtype === "talent") {
			if (mod.modtype === "basic" && basicisActive) {
				itemMods.push(createMod(mod, i, { basicisActive: true, basicAction }));
			} else if (mod.modtype === "advanced" && advisActive) {
				itemMods.push(createMod(mod, i, { advisActive: true, advAction }));
			}
		} else {
			const isCrit = itemtype === "crit";
			// Preserves legacy DB key 'imediateeffect' alongside getter 'immediateeffect'
			const itemDescription = isCrit
				? stripHtml(system.immediateeffect || system.imediateeffect || system.longtermeffect || i.name)
				: mod.description;

			itemMods.push(createMod(mod, i, {
				modtype: isCrit ? null : mod.modtype,
				itemDescription,
				basicisActive,
				advisActive,
				basicAction,
				advAction,
			}));
		}
	}
}



export async function prepModOutput(rollType, rollData, dataset) {
	const conditionalMods = [];
	const talentMods      = [];
	const feature = game.i18n.localize('TALESOFTHEOLDWEST.Item.General.feature');
	if (rollType === 'Items') {
		prepFeatureMods();

		prepItemMods();

		switch (dataset.subtype) {
			case 'shootin':
				prepShootinMods();
				break;
			case 'fightin':
				prepFightinMods();
				break;
		}
	} else {
		// it's an Attribute or Ability; dataset.key is the raw key (e.g. "quick" or "move").
		const resolvedKey = dataset.key?.trim() ?? '';
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

	function prepFightinMods() {
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
	}

	function prepShootinMods() {
		for (const akey in rollData.actor.itemMods) {
			switch (akey) {
				case 'shootin':
					rollData.expertFanning = rollData.actor.itemMods[akey].some((a) => a.itemname === 'Expert Fanning' && a.basicisActive);
					modifiers(rollData.actor.itemMods, conditionalMods, talentMods, dataset, akey);
					break;
				case 'quick':
					modifiers(rollData.actor.itemMods, conditionalMods, talentMods, dataset, akey);
					break;

				default:
					break;
			}
		}
	}

	function prepItemMods() {
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
	}

	function prepFeatureMods() {
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
	}
}

const ITEM_TYPES = new Set(['item', 'animalquality', 'crit']);

export function modifiers(itemModspath, conditionalMods, talentMods, dataset, akey) {
	for (const mod of itemModspath[akey]) {
		if (mod.state === 'Active') continue;

		const talent = getActiveTalent(mod);
		if (talent) {
			if (mod.state === 'Conditional') pushConditional(conditionalMods, 'feature', mod, buildLabel(mod, talent.action));
			else if (mod.state === 'Chat')   pushTalent(talentMods, mod, talent.action);
			continue;
		}

		if (!ITEM_TYPES.has(mod.itemtype) || mod.stored) continue;

		if (mod.state === 'Conditional' || (mod.state === 'onPC' && dataset.myHorse === 'true')) {
			pushConditional(conditionalMods, 'item', mod, buildLabel(mod));
		} else if (mod.state === 'Chat') {
			pushTalent(talentMods, mod, mod.itemDescription);
		}
	}
}

export function parents(el, selector) {
	const myParents = [];
	el = el.parentNode;
	while (el && el !== document) {
		if (!selector || el.matches(selector)) myParents.push(el);
		el = el.parentNode;
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
	element.dataset.collapsed = 'true';
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
	element.dataset.collapsed = 'false';
}

function isPassiveMod(item, mod, state) {
	if (mod.state !== state) return false;
	if (item.type !== 'talent') return true;
	const { basicisActive, advisActive } = item.system;
	return (mod.modtype === 'basic' && basicisActive) || (mod.modtype === 'advanced' && advisActive);
}

/**
 * Accumulate passive attribute and ability modifiers from an actor's items.
 * Weapons are skipped (their modifiers only apply when that weapon is rolled),
 * as are stored items. Talent modifiers count only while the matching
 * basic/advanced mode is switched on.
 *
 * @param {Iterable<Item>} items  The actor's items.
 * @param {object} attrMod        Accumulator keyed by attribute name.
 * @param {object} sklMod         Accumulator keyed by ability name.
 * @param {string} state          Modifier state to apply (e.g. 'Active', 'onAnimal').
 */
export function calculateMods(items, attrMod, sklMod, state) {
	for (const item of items) {
		const system = item.system;
		if (item.type === 'weapon' || !system?.itemModifiers || system.stored) continue;
		for (const mod of Object.values(system.itemModifiers)) {
			if (!isPassiveMod(item, mod, state)) continue;
			const val = Number(mod.value) || 0;
			const target = mod.name?.toLowerCase();
			if (target in attrMod) attrMod[target] += val;
			else sklMod[target] = (sklMod[target] ?? 0) + val;
		}
	}
}