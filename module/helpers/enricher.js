export function enrichTextEditors() {
	// With permission from @mcglintlock
	// e.g., @DRAW[Compendium.cy-borg-core.random-tables.vX47Buopuq9t0x9r]{Names}
	// optionally add a roll for the draw at the end
	// e.g., @DRAW[Compendium.cy-borg-core.random-tables.vX47Buopuq9t0x9r]{Names}{1d4}
	const DRAW_FROM_TABLE_PATTERN = /@DRAW\[([^\]]+)\]{([^}]*)}(?:{([^}]*)})?/gm;
	const TEXT_DRAW_FROM_TABLE_PATTERN = /@TEXTDRAW\[([^\]]+)\]{([^}]*)}(?:{([^}]*)})?/gm;
	const drawFromTableEnricher = (match, _options) => {
		const uuid = match[1];
		const tableName = match[2];
		const roll = match[3];
		const elem = document.createElement('span');
		elem.className = 'draw-from-table';
		elem.setAttribute('data-tooltip', `Draw from ${tableName}. <br> ${game.i18n.localize('TALESOFTHEOLDWEST.dialog.Tooltip-Rollontable')}`);
		elem.setAttribute('data-uuid', uuid);
		if (roll) {
			elem.setAttribute('data-roll', roll);
		}
		elem.innerHTML = `<i class="fas fa-dice-d20">&nbsp;</i>`;
		return elem;
	};

	const textDrawFromTableEnricher = (match, _options) => {
		const uuid = match[1];
		const tableName = match[2];
		const roll = match[3];
		const elem = document.createElement('span');
		elem.className = 'draw-from-table';
		elem.setAttribute('data-tooltip', `Draw from ${tableName}. <br> ${game.i18n.localize('TALESOFTHEOLDWEST.dialog.Tooltip-Rollontable')}`);
		elem.setAttribute('data-uuid', uuid);
		if (roll) {
			elem.setAttribute('data-roll', roll);
		}
		elem.innerHTML = `<a class='content-link' >${tableName}</a>`;
		return elem;
	};

	CONFIG.TextEditor.enrichers.push(
		...[
			{
				pattern: /@RAW\[(.+?)\]/gm,
				enricher: async (match, options) => {
					const myData = await $.ajax({
						url: match[1],
						type: 'GET',
					});
					const doc = document.createElement('span');
					doc.innerHTML = myData;
					return doc;
				},
			},
			{
				pattern: DRAW_FROM_TABLE_PATTERN,
				enricher: drawFromTableEnricher,
			},
			{
				pattern: TEXT_DRAW_FROM_TABLE_PATTERN,
				enricher: textDrawFromTableEnricher,
			},
			{
				pattern: /@fas\[(.+?)\]/gm,
				enricher: async (match, options) => {
					const doc = document.createElement('span');
					doc.innerHTML = `<i class="fas ${match[1]}"></i>`;
					return doc;
				},
			},
		]
	);

	async function drawFromRollableTable(event) {
		event.preventDefault();
		// const & var = globally defined
		let uuid = event.currentTarget.getAttribute('data-uuid');
		if (!uuid) {
			return;
		}
		let table = await fromUuid(uuid);
		let myF = async function (uuid, modifier) {
			if (table instanceof RollTable) {
				const formula = event.currentTarget.getAttribute('data-roll');
				const roll = formula ? new Roll(formula) : new Roll(`${table.formula} + ${modifier}`);
				await table.draw({ roll });
			}
		};
		// This needs to be something other than CTRL as it conflicts with RMB on macs.
		if (event.shiftKey) {
			const dialog_content = `<p>${game.i18n.format('TALESOFTHEOLDWEST.dialog.Rollontable', {
				tablename: table.name,
			})}</p>
			         <form>
			             <div class="form-group">
			                 <label>${game.i18n.localize('TALESOFTHEOLDWEST.dialog.Modifier')}</label>
			                 <input type="text" id="modifier" name="modifier" value="0" autofocus="autofocus" />
			             </div>
			         </form>`;
			const result = await foundry.applications.api.DialogV2.prompt({
				window: {
					title: game.i18n.format('TALESOFTHEOLDWEST.dialog.Rollontable', {
						tablename: table.name,
					}),
				},
				position: { width: 300 },
				content: dialog_content,
				ok: {
					label: game.i18n.localize('TALESOFTHEOLDWEST.dialog.ok'),
					callback: (event, button, _dialog) => {
						const input = button.form.elements.modifier?.value;
						const modifier = parseInt(input, 10);
						return isNaN(modifier) ? 0 : modifier;
					},
				},
				rejectClose: false,
			});
			if (result !== null && result !== undefined) {
				await myF(uuid, result);
			}
		} else {
			await myF(uuid, 0);
		}
	}
	$(document).on('click', '.draw-from-table', drawFromRollableTable);
}
