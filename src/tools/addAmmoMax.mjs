/**
 * addAmmoMax.mjs
 *
 * Seeds `system.ammoMax` (= current `system.ammo`) on every weapon document
 * found under `src/packs/` and `packs_backup/`.
 *
 * Usage:
 *   node src/tools/addAmmoMax.mjs [--dry-run]
 *
 * Safety: each file is round-tripped through JSON.stringify before writing to
 * verify it will reproduce byte-for-byte; files that fail are skipped and the
 * script exits non-zero.
 */

import { promises as fs } from 'fs';
import path from 'path';

const dryRun = process.argv.includes('--dry-run');

const SEARCH_DIRS = ['src/packs', 'packs_backup'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectJsonFiles(dir) {
	const results = [];
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return results; // directory does not exist – skip silently
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await collectJsonFiles(full)));
		} else if (entry.isFile() && entry.name.endsWith('.json')) {
			results.push(full);
		}
	}
	return results;
}

/**
 * Inserts `ammoMax` immediately after `ammo` in a system object.
 * Returns a new object; does not mutate the input.
 */
function insertAmmoMax(system) {
	const out = {};
	for (const [k, v] of Object.entries(system)) {
		out[k] = v;
		if (k === 'ammo') {
			out.ammoMax = typeof v === 'number' && Number.isInteger(v) ? v : 0;
		}
	}
	return out;
}

/**
 * Walks a document and patches every weapon without an ammoMax.
 * Returns { patched, alreadyHad, errors }.
 */
function patchDocument(doc) {
	let patched = 0;
	let alreadyHad = 0;
	const errors = [];

	function processWeapon(weapon, context) {
		if (weapon.type !== 'weapon' || !weapon.system || typeof weapon.system !== 'object') return;
		if ('ammoMax' in weapon.system) {
			alreadyHad++;
			return;
		}
		const ammo = weapon.system.ammo;
		if (typeof ammo !== 'number' || !Number.isInteger(ammo)) {
			errors.push(`${context}: ammo is missing or not an integer (got ${JSON.stringify(ammo)})`);
			return;
		}
		weapon.system = insertAmmoMax(weapon.system);
		patched++;
	}

	// Top-level weapon document
	processWeapon(doc, doc.name ?? doc._id ?? '?');

	// Items array (e.g. Adventure.items)
	for (const item of doc.items ?? []) {
		processWeapon(item, `items/${item.name ?? item._id}`);
	}

	// Actors array (e.g. Adventure.actors), each with their own items
	for (const actor of doc.actors ?? []) {
		for (const item of actor.items ?? []) {
			processWeapon(item, `actors/${actor.name ?? actor._id}/items/${item.name ?? item._id}`);
		}
	}

	return { patched, alreadyHad, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let filesScanned = 0;
let filesChanged = 0;
let filesSkipped = 0;
let totalWeapons = 0;
let totalPatched = 0;
let totalAlreadyHad = 0;
let hadErrors = false;

for (const baseDir of SEARCH_DIRS) {
	const files = await collectJsonFiles(baseDir);
	for (const file of files) {
		filesScanned++;
		const original = await fs.readFile(file, 'utf8');

		// Safety: verify the file round-trips cleanly
		let doc;
		try {
			doc = JSON.parse(original);
		} catch (e) {
			console.error(`SKIP (parse error): ${file}: ${e.message}`);
			filesSkipped++;
			hadErrors = true;
			continue;
		}
		const roundTrip = JSON.stringify(doc, null, 2) + '\n';
		if (roundTrip !== original) {
			console.error(`SKIP (round-trip mismatch): ${file}`);
			filesSkipped++;
			hadErrors = true;
			continue;
		}

		const { patched, alreadyHad, errors } = patchDocument(doc);
		totalWeapons += patched + alreadyHad;
		totalPatched += patched;
		totalAlreadyHad += alreadyHad;

		if (errors.length) {
			for (const err of errors) console.error(`ERROR in ${file}: ${err}`);
			hadErrors = true;
		}

		if (patched > 0) {
			filesChanged++;
			if (!dryRun) {
				await fs.writeFile(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
			}
		}
	}
}

console.log('');
console.log(`Files scanned : ${filesScanned}`);
console.log(`Files changed : ${filesChanged}${dryRun ? ' (dry-run; no writes)' : ''}`);
console.log(`Files skipped : ${filesSkipped}`);
console.log(`Weapons found : ${totalWeapons}`);
console.log(`  Updated     : ${totalPatched}`);
console.log(`  Already had ammoMax: ${totalAlreadyHad}`);

if (hadErrors) process.exit(1);
