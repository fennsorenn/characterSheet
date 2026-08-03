import { block, cell, buildCell, assert, assertEqual } from '../harness.mjs';

// Picking what a character *is* and reading what that gave them are two jobs.
// They used to share one block, with the selectors crammed into the Features
// header; they are now separate blocks that can be sized, moved and removed
// independently.
export default async function ({ page }) {
  const build = buildCell(page);
  const features = cell(page, 'Features & Traits');

  assert((await build.count()) === 1, 'the build block is on the sheet');
  assert((await features.count()) === 1, 'the features block is still on the sheet');

  // Two distinct grid cells, not one block containing the other.
  const same = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.cell')];
    const find = (t) => cells.find((c) => c.querySelector('h3')?.textContent?.trim() === t);
    const a = find('Race, Class & Feats');
    const b = find('Features & Traits');
    return !a || !b ? 'missing' : a === b || a.contains(b) || b.contains(a) ? 'nested' : 'separate';
  });
  assertEqual(same, 'separate', 'they are two independent blocks');

  // Every selector moved: none of them are left behind in Features.
  for (const line of ['.line.classes', '.line.feats', '.line.custom']) {
    assertEqual(await features.locator(line).count(), 0, `${line} is gone from Features & Traits`);
  }
  for (const [line, label] of [
    ['.line.classes', 'classes'],
    ['.line.feats', 'feats']
  ]) {
    assert((await build.locator(line).count()) === 1, `${label} are chosen in the build block`);
  }
  assert((await build.locator('.line', { hasText: 'Race' }).count()) === 1, 'race too');
  assert((await build.locator('.line', { hasText: 'Background' }).count()) === 1, 'background too');

  // Features keeps the list, and gains the quick-add bar its sibling lists have.
  assert((await features.locator('.features').count()) === 1, 'the feature list stays with Features');
  assert((await build.locator('.features').count()) === 0, 'and does not leak into the build block');
  const placeholder = await features.locator('.quickadd input').getAttribute('placeholder');
  assert(/feature/i.test(placeholder ?? ''), `Features has a quick-add bar (got ${placeholder})`);

  // Same shape as Inventory and Spells — that is what "like the others" means.
  for (const [title, noun] of [
    ['Inventory', 'item'],
    ['Spells', 'spell']
  ]) {
    const ph = await block(page, title).locator('.quickadd input').first().getAttribute('placeholder');
    assert(new RegExp(noun, 'i').test(ph ?? ''), `${title} still has its own quick-add (${ph})`);
  }
}
