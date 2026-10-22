import { logger } from './logger.mjs';

const CRIT_MIGRATION_VERSION = 1;

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

/**
 * Run the world migration if it has not yet been applied.
 * Must be called after the 'ready' hook, GM only.
 */
export async function runMigrationIfNeeded() {
  if (!game.user.isGM || game.users.activeGM?.isSelf === false) return;

  const stored = Number(game.settings.get('talesoftheoldwest', 'systemMigrationVersion') ?? 0);
  if (stored >= CRIT_MIGRATION_VERSION) return;

  logger.info(`Running crit migration to version ${CRIT_MIGRATION_VERSION}…`);

  let weaponCount;
  let talentCount;

  // Collect all items to check
  const itemSources = [
    ...game.items.contents,
  ];

  // World actor items
  for (const actor of game.actors.contents) {
    itemSources.push(...actor.items.contents);
  }

  // Unlinked token actor items (per scene)
  for (const scene of game.scenes.contents) {
    for (const token of scene.tokens.contents) {
      if (!token.actorLink && token.actor) {
        itemSources.push(...token.actor.items.contents);
      }
    }
  }

  const weaponResults = await Promise.all(
    itemSources.filter(item => item.type === 'weapon').map(_migratePiercing)
  );
  const talentResults = await Promise.all(
    itemSources.filter(item => item.type === 'talent').map(_migrateLucky)
  );

  weaponCount = weaponResults.filter(Boolean).length;
  talentCount = talentResults.filter(Boolean).length;

  await game.settings.set('talesoftheoldwest', 'systemMigrationVersion', String(CRIT_MIGRATION_VERSION));

  const anyChanged = weaponCount > 0 || talentCount > 0;
  if (anyChanged) {
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
