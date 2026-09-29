export class TOTOWMacros {
	// constructor() {}

	static async rollOnAllTables() {
		if (game.tables.size === 0) {
			await foundry.applications.api.DialogV2.prompt({
				window: { title: 'TOTOW - Roll on Tables' },
				content: `<div style="text-align: center">There are no tables to draw from!</div><br>`,
				ok: { label: 'OK' },
				rejectClose: false,
			});
			return;
		}

		let options = '';
		game.tables.contents.forEach((t) => {
			if (
				t.folder &&
				(t.folder.name === 'TOTOW System' ||
					t.folder.name === 'TOTOW Core Rules' ||
					t.folder.name === 'Your Town' ||
					t.folder.name === 'Your Tale Begins' ||
					t.folder.name === 'Living Outcome' ||
					t.folder.name === 'Your Upbringing') &&
				t.folder.name != null
			) {
				options = options.concat(`<option value="${t._id}">${t.folder.name} - ${t.name}</option>`);
			}
		});

		const template = `<form>
			<div class="form-group">
				<label>Select Table</label>
				<select name="tableSelect">${options}</select>
			</div>
			<div class="form-group">
				<label style="max-width: 100px">Rolls on table?</label>
				<input class="statnum" type="number" style="max-width: 50px" name="inputNbr" value="1">
			</div>
			<div class="form-group">
				<label style="max-width: 100px">Modifier?</label>
				<input class="statnum" type="number" style="max-width: 50px" name="inputMod" value="0">
			</div>
		</form>`;

		await foundry.applications.api.DialogV2.wait({
			window: { title: 'TOTOW - Roll on Tables' },
			position: { width: 500 },
			content: template,
			buttons: [
				{
					action: 'draw',
					icon: '<i class="fas fa-check"></i>',
					label: 'Draw',
					default: true,
					callback: async (event, button) => {
						const elements = button.form.elements;
						const tableId = elements.tableSelect.value;
						const table = game.tables.get(tableId);
						const drawNumber = Number.parseInt(elements.inputNbr.value || 0);
						const formula = table.formula;
						const modifier = Number.parseInt(elements.inputMod.value || '0');
						for (let i = 0; i < drawNumber; i++) {
							const roll = await new Roll(formula + ' + ' + modifier).evaluate();
							await table.draw({ roll: roll });
						}
					},
				},
				{
					action: 'cancel',
					icon: '<i class="fas fa-times"></i>',
					label: 'Cancel',
				},
			],
			rejectClose: false,
		});
	}
}
