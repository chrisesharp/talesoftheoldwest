import { preloadHandlebarsTemplates } from "./templates.mjs";

export const initializeHandlebars = () => {
	registerHandlebarsHelpers();
	void preloadHandlebarsTemplates();
};

function registerHandlebarsHelpers() {
	/* -------------------------------------------- */
	/*  Handlebars Helpers                          */
	/* -------------------------------------------- */

	// If you need to add Handlebars helpers, here is a useful example:
	Handlebars.registerHelper('toLowerCase', function (str) {
		return str.toLowerCase();
	});

	Handlebars.registerHelper('toUpperCase', function (str) {
		return str.toUpperCase();
	});

	Handlebars.registerHelper('capitalise', function (str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	});

	/*
	 * Repeat given markup with n times
	 */
	Handlebars.registerHelper('times', function (n, block) {
		let result = '';
		for (let i = 0; i < n; ++i) {
			result += block.fn(i);
		}
		return result;
	});

	Handlebars.registerHelper('keepMarkup', function (text) {
		return new Handlebars.SafeString(text);
	});

	Handlebars.registerHelper('removeMarkup', function (text) {
		const doc = new DOMParser().parseFromString(text, 'text/html');
		return new Handlebars.SafeString(doc.body.textContent ?? '');
	});

	Handlebars.registerHelper('ifSetting', function (v1, options) {
		if (game.settings.get('talesoftheoldwest', v1)) return options.fn(this);
		else return options.inverse(this);
	});

	Handlebars.registerHelper('striptags', function (txt) {
		if (txt === undefined) return;
		const doc = new DOMParser().parseFromString(txt, 'text/html');
		return doc.body.textContent ?? '';
	});

	Handlebars.registerHelper('addstats', function (v1, v2) {
		return v1 + v2;
	});

	Handlebars.registerHelper('totowConcat', function () {
		let outStr = '';
		for (const arg in arguments) {
			if (typeof arguments[arg] != 'object') {
				outStr += arguments[arg];
			}
		}
		return outStr;
	});
}
