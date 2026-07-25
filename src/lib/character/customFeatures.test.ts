import { describe, it, expect } from 'vitest';
import { createCharacter, CUSTOM_SOURCE } from './schema.js';
import { customFeatures, uniqueCustomFeatureName, featureMetaKey } from './features.js';

// Every other feature is derived from race/class/background/feats, so the ones
// the player writes are the only features the document carries — and they have
// to arrive in the block looking like any other.
describe('custom features', () => {
  const withFeatures = (...names: string[]) =>
    createCharacter({
      customFeatures: names.map((name, i) => ({ id: `f${i}`, name }))
    });

  it('presents them as ordinary features in their own group', () => {
    const out = customFeatures(withFeatures('Oath of the Long Road', 'Ancestral Boon'));
    expect(out.map((f) => f.name)).toEqual(['Oath of the Long Road', 'Ancestral Boon']);
    expect(out.every((f) => f.group === 'Custom')).toBe(true);
    expect(out.every((f) => f.source === CUSTOM_SOURCE)).toBe(true);
    // No entries: their text is the description in featureMeta, not catalog data.
    expect(out.every((f) => f.entries.length === 0)).toBe(true);
  });

  it('carries an optional subtitle through', () => {
    const c = createCharacter({ customFeatures: [{ id: 'a', name: 'Boon', subtitle: 'Session 12' }] });
    expect(customFeatures(c)[0].subtitle).toBe('Session 12');
  });

  it('has none by default', () => {
    expect(customFeatures(createCharacter())).toEqual([]);
  });

  it('keys their overrides the same way every other feature does', () => {
    const f = customFeatures(withFeatures('Ancestral Boon'))[0];
    expect(featureMetaKey(f)).toBe(`Ancestral Boon|${CUSTOM_SOURCE}`);
  });

  it('never reuses a name, since the name is half the key', () => {
    // Two features sharing a key would share a description.
    const c = withFeatures('Boon', 'Boon 2');
    expect(uniqueCustomFeatureName(c, 'Boon')).toBe('Boon 3');
    // The clash is spotted case-insensitively, but the name you typed is kept.
    expect(uniqueCustomFeatureName(c, 'boon')).toBe('boon 3');
    expect(uniqueCustomFeatureName(c, 'Other')).toBe('Other');
    expect(uniqueCustomFeatureName(c, '   ')).toBe('New feature');
  });
});
