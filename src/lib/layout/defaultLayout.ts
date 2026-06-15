import { makeBlock } from './operations.js';
import type { BlockInstance, SheetLayout } from './types.js';

/**
 * A solid default sheet, optimised for viewing while editable. The grid reflows
 * responsively (see LayoutRenderer), so this single layout adapts across screen
 * sizes; per-character-type presets can be added as named layouts later.
 */
export function defaultLayout(): SheetLayout {
  const order = [
    'abilityScores',
    'defenses',
    'hitPoints',
    'restLevelUp',
    'conditions',
    'effects',
    'saves',
    'skills',
    'attacks',
    'features',
    'traits',
    'inventory',
    'resources',
    'spells',
    'spellSlots'
  ];
  const blocks = order
    .map((type) => makeBlock(type))
    .filter((b): b is BlockInstance => b !== null);
  return { id: 'default', name: 'Default', blocks };
}
