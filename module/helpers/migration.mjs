import { logger } from './logger.mjs';

const PIERCING_IDS = new Set(['P2YHIFEDTDoemyfX', 'SRgN7rY8PBjlZI7M']);

const CRIT_UNITS_MODIFIER = {
  "0": {
    description: "",
    attribute: "critunits",
    value: 1,
    state: "Active",
    name: "critunits",
  }
};

const PIERCING_DESCRIPTION =
  "The weapon is renowned for being deadly in the hands of an expert. " +
  "Grants +1 to the Units die on critical injury rolls.";

/** Ordered list of world migrations. Each step stores its version once it completes. */
const MIGRATIONS = [
  { version: 1, run: migrateCrits },
  { version: 2, run: migrateAmmoMax },
];

/** Maximum number of `Actor.<id>.Item.<id>` hops followed when resolving an ammo reference. */
const MAX_SOURCE_DEPTH = 3;

/**
 * Run any world migrations that have not yet been applied.
 * Must be called after the 'ready' hook, GM only.
 */
export async function runMigrationIfNeeded() {
  if (!game.user.isGM || game.users.activeGM?.isSelf === false) return;

  for (const { version, run } of MIGRATIONS) {
    const stored = Number(game.settings.get('talesoftheoldwest', 'systemMigrationVersion') ?? 0);
    if (stored >= version) continue;

    logger.info(`Running migration to version ${version}…`);
    try {
      await run();
    } catch (err) {
      logger.error(`Migration to version ${version} failed`, err);
      return;
    }
    await game.settings.set('talesoftheoldwest', 'systemMigrationVersion', String(version));
  }
}

/**
 * Actors that can own items: world actors plus the synthetic actors of unlinked tokens.
 * @returns {Actor[]}
 */
function _collectActors() {
  const actors = [...game.actors.contents];
  for (const scene of game.scenes.contents) {
    for (const token of scene.tokens.contents) {
      if (!token.actorLink && token.actor) actors.push(token.actor);
    }
  }
  return actors;
}

/**
 * World items plus the items of every actor from {@link _collectActors}.
 * @returns {Item[]}
 */
function _collectAllItems() {
  const items = [...game.items.contents];
  for (const actor of _collectActors()) items.push(...actor.items.contents);
  return items;
}

/* ------------------------------------------- */
/*  Version 1: critical injury                  */
/* ------------------------------------------- */

async function migrateCrits() {
  const itemSources = _collectAllItems();

  const weaponResults = await Promise.all(
    itemSources.filter(item => item.type === 'weapon').map(_migratePiercing)
  );
  const talentResults = await Promise.all(
    itemSources.filter(item => item.type === 'talent').map(_migrateLucky)
  );

  const weaponCount = weaponResults.filter(Boolean).length;
  const talentCount = talentResults.filter(Boolean).length;

  if (weaponCount > 0 || talentCount > 0) {
    const msg = game.i18n.format('TALESOFTHEOLDWEST.Migration.critUpdated', {
      count: weaponCount,
      talentCount,
    });
    ui.notifications.info(msg);
    logger.info(msg);
  } else {
    logger.info(game.i18n.localize('TALESOFTHEOLDWEST.Migration.critNoop'));
  }
}

async function _migratePiercing(item) {
  const featureMods = item.system.featureModifiers;
  if (!featureMods) return false;

  let changed = false;
  const update = {};

  for (const [key, feature] of Object.entries(featureMods)) {
    const isPiercing = PIERCING_IDS.has(feature.id) ||
      (feature.name === 'Piercing' && feature.feature === 'quality');

    if (!isPiercing) continue;

    // Already migrated?
    const mods = feature.itemModifiers ?? {};
    const alreadyMigrated = Object.values(mods).some((m) => m.name === 'critunits');
    if (alreadyMigrated) continue;

    update[`system.featureModifiers.${key}.itemModifiers`] = CRIT_UNITS_MODIFIER;
    update[`system.featureModifiers.${key}.description`]   = PIERCING_DESCRIPTION;
    changed = true;
  }

  if (changed) await item.update(update);
  return changed;
}

async function _migrateLucky(item) {
  const mods = item.system.itemModifiers;
  // Already has critRerollTens?
  if (mods && Object.values(mods).some((m) => m.name === 'critRerollTens')) return false;

  const isLucky = item.system.reference === 'lucky' || item.name === 'Lucky';
  if (!isLucky) return false;

  const id = item.id;
  const description = "No matter how bad the odds you always seem to get away unscathed.";
  const basicAction  = "When you suffer a critical injury you can reroll the Tens die and take the best result.";
  const advAction    = "When you suffer a critical injury you can reroll the Units die and take the best result.";

  await item.update({
    'system.itemModifiers': {
      "0": { name: "critRerollTens",  value: 0, state: "Conditional", modtype: "basic",    id, description, basicAction, advAction },
      "1": { name: "critRerollUnits", value: 0, state: "Conditional", modtype: "advanced", id, description, basicAction, advAction },
    }
  });
  return true;
}

/* ------------------------------------------- */
/*  Version 2: maximum ammo                     */
/* ------------------------------------------- */

/**
 * Seed `system.ammoMax` on all weapons. World Items are processed first so they act as
 * the reference for embedded (actor-owned) weapons, which take their capacity from the
 * current `ammo` of the Item they were dropped from rather than their own (possibly
 * depleted) `ammo`.
 */
async function migrateAmmoMax() {
  const options = { diff: false, totowSkipAmmoClamp: true };
  const stats = { world: 0, source: 0, name: 0, fallback: 0, overMax: 0, fightin: 0 };
  const unresolved = [];
  const overMax = [];

  // 1. World items: capacity is the item's current ammo.
  const worldWeapons = game.items.contents.filter((i) => i.type === 'weapon');
  for (const item of worldWeapons) {
    await item.update({ 'system.ammoMax': Number(item.system.ammo) || 0 }, options);
    stats.world++;
  }

  // 2. Embedded weapons.
  for (const actor of _collectActors()) {
    for (const item of actor.items.contents.filter((i) => i.type === 'weapon')) {
      const ammo = Number(item.system.ammo) || 0;

      if (item.system.subtype === 'fightin') {
        await item.update({ 'system.ammoMax': ammo }, options);
        stats.fightin++;
        continue;
      }

      let ammoMax = await _resolveSourceAmmo(item);
      if (ammoMax !== null) {
        stats.source++;
      } else {
        ammoMax = _resolveByName(item, worldWeapons);
        if (ammoMax !== null) {
          stats.name++;
        } else {
          ammoMax = ammo;
          stats.fallback++;
          unresolved.push({ actor: actor.name, weapon: item.name, ammo });
        }
      }

      if (ammo > ammoMax) {
        // D8: keep the actor's ammo, only record it for the GM.
        stats.overMax++;
        overMax.push({ actor: actor.name, weapon: item.name, ammo, ammoMax });
      }

      await item.update({ 'system.ammoMax': ammoMax }, options);
    }
  }

  const embeddedCount = stats.source + stats.name + stats.fallback + stats.fightin;
  if (stats.world === 0 && embeddedCount === 0) {
    logger.info(game.i18n.localize('TALESOFTHEOLDWEST.Migration.ammoMaxNoop'));
    return;
  }

  const msg = game.i18n.format('TALESOFTHEOLDWEST.Migration.ammoMaxUpdated', {
    worldCount: stats.world,
    embeddedCount,
  });
  ui.notifications.info(msg);
  logger.info(msg, stats);

  if (unresolved.length || overMax.length) await _postAmmoMaxReview(msg, unresolved, overMax);
}

/**
 * Resolve the reference ammo capacity from an embedded weapon's recorded source.
 * Follows `Actor.<id>.Item.<id>` copies up to MAX_SOURCE_DEPTH hops; the intermediate
 * copy's own ammo is never used.
 * @param {Item} item
 * @returns {Promise<number|null>} null when no reference could be found
 */
async function _resolveSourceAmmo(item) {
  const seen = new Set([item.uuid]);
  let current = item;

  for (let depth = 0; depth <= MAX_SOURCE_DEPTH; depth++) {
    const source = current._stats?.compendiumSource ?? current.flags?.core?.sourceId;
    if (!source || seen.has(source)) return null;
    seen.add(source);

    const worldMatch = /^Item\.([^.]+)$/.exec(source);
    if (worldMatch) {
      const ref = game.items.get(worldMatch[1]);
      return ref?.type === 'weapon' ? (Number(ref.system.ammo) || 0) : null;
    }

    const actorMatch = /^Actor\.([^.]+)\.Item\.([^.]+)$/.exec(source);
    if (actorMatch) {
      const next = game.actors.get(actorMatch[1])?.items.get(actorMatch[2]);
      if (!next) return null;
      current = next;
      continue;
    }

    let doc = null;
    try {
      doc = await fromUuid(source);
    } catch {
      return null;
    }
    if (doc?.type !== 'weapon') return null;
    return Number(doc.system.ammoMax ?? doc.system.ammo) || 0;
  }
  return null;
}

/**
 * Match an embedded weapon to a single world weapon with the same name and subtype.
 * @param {Item} item
 * @param {Item[]} worldWeapons
 * @returns {number|null} null when there are zero or multiple matches
 */
function _resolveByName(item, worldWeapons) {
  const matches = worldWeapons.filter(
    (w) => w.name === item.name && w.system.subtype === item.system.subtype
  );
  return matches.length === 1 ? (Number(matches[0].system.ammo) || 0) : null;
}

/**
 * Post a GM-only chat card listing weapons that need manual review.
 */
async function _postAmmoMaxReview(summary, unresolved, overMax) {
  const esc = (v) => Handlebars.Utils.escapeExpression(v);
  const lines = [
    ...unresolved.map((r) => game.i18n.format('TALESOFTHEOLDWEST.Migration.ammoMaxUnresolved', {
      actor: esc(r.actor), weapon: esc(r.weapon), ammo: r.ammo,
    })),
    ...overMax.map((r) => game.i18n.format('TALESOFTHEOLDWEST.Migration.ammoMaxOverMax', {
      actor: esc(r.actor), weapon: esc(r.weapon), ammo: r.ammo, ammoMax: r.ammoMax,
    })),
  ];

  const content =
    `<div class="chatBG"><h3>${game.i18n.localize('TALESOFTHEOLDWEST.Migration.ammoMaxReviewTitle')}</h3>` +
    `<p>${esc(summary)}</p>` +
    `<ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul></div>`;

  await ChatMessage.create({
    content,
    whisper: ChatMessage.getWhisperRecipients('GM'),
  });
}
