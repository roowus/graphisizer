import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Incompatible Unit Type Detection Feature
 * Tests the new greyed out buttons feature
 */

// Helper function to add a competitor
async function addCompetitor(page, wcaId: string, event: string) {
  await page.getByPlaceholder('Search by ID or name...').fill(wcaId);
  await page.waitForTimeout(500);

  const eventSelect = page.locator('label').filter({ hasText: 'Event' }).locator('..').locator('select');
  await eventSelect.selectOption(event);

  const resultTypeSelect = page.locator('label').filter({ hasText: 'Result Type' }).locator('..').locator('select');
  await resultTypeSelect.selectOption('single');

  await page.getByRole('button', { name: /add graph/i }).click();
  await page.waitForTimeout(3000);
}

test.describe('Incompatible Unit Type Detection', () => {
  test('FMC + Time-based: Raw and Unit buttons disabled', async ({ page }) => {
    await page.goto('/');

    // Add FMC competitor
    await addCompetitor(page, '2022SMIT01', '333fm');

    // Add time-based competitor
    await addCompetitor(page, '2017KUBO01', '333');

    // Check Raw button is disabled
    const rawButton = page.getByRole('button', { name: 'Raw' }).first();
    await expect(rawButton).toBeDisabled();
    console.log('✓ Raw button is disabled');

    // Check Unit button is disabled
    const unitButton = page.getByRole('button', { name: 'Unit' }).first();
    await expect(unitButton).toBeDisabled();
    console.log('✓ Unit button is disabled');

    // Check Percent button is still enabled
    const percentButton = page.getByRole('button', { name: '%' }).first();
    await expect(percentButton).not.toBeDisabled();
    console.log('✓ Percent button is enabled');
  });

  test('FMC + Time-based: Warning badge displays', async ({ page }) => {
    await page.goto('/');

    await addCompetitor(page, '2022SMIT01', '333fm');
    await addCompetitor(page, '2017KUBO01', '333');

    // Check for warning badge
    const warning = page.getByText('⚠️ Incompatible units');
    await expect(warning).toBeVisible();
    console.log('✓ Warning badge is visible');
  });

  test('FMC + Time-based: Tooltips show correct message', async ({ page }) => {
    await page.goto('/');

    await addCompetitor(page, '2022SMIT01', '333fm');
    await addCompetitor(page, '2017KUBO01', '333');

    // Check Raw button tooltip
    const rawButton = page.getByRole('button', { name: 'Raw' }).first();
    const rawTitle = await rawButton.getAttribute('title');
    expect(rawTitle).toMatch(/Cannot compare/);
    expect(rawTitle).toMatch(/FMC/);
    expect(rawTitle).toMatch(/raw mode/);
    console.log('✓ Raw button tooltip:', rawTitle);

    // Check Unit button tooltip
    const unitButton = page.getByRole('button', { name: 'Unit' }).first();
    const unitTitle = await unitButton.getAttribute('title');
    expect(unitTitle).toMatch(/Cannot compare/);
    expect(unitTitle).toMatch(/unit change mode/);
    console.log('✓ Unit button tooltip:', unitTitle);
  });

  test('Compatible types: All buttons enabled', async ({ page }) => {
    await page.goto('/');

    // Add two time-based competitors
    await addCompetitor(page, '2022SMIT01', '333');
    await addCompetitor(page, '2017KUBO01', '333');

    // All buttons should be enabled
    const rawButton = page.getByRole('button', { name: 'Raw' }).first();
    await expect(rawButton).not.toBeDisabled();
    console.log('✓ Raw button is enabled');

    const unitButton = page.getByRole('button', { name: 'Unit' }).first();
    await expect(unitButton).not.toBeDisabled();
    console.log('✓ Unit button is enabled');

    const percentButton = page.getByRole('button', { name: '%' }).first();
    await expect(percentButton).not.toBeDisabled();
    console.log('✓ Percent button is enabled');

    // No warning badge
    const warning = page.getByText('⚠️ Incompatible units');
    await expect(warning).not.toBeVisible();
    console.log('✓ No warning badge shown');
  });

  test('Rank + Time-based: Raw and Unit disabled', async ({ page }) => {
    await page.goto('/');

    // Add time-based competitor
    await addCompetitor(page, '2022SMIT01', '333');

    // Add competitor with rank result type
    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.waitForTimeout(500);

    const eventSelect = page.locator('label').filter({ hasText: 'Event' }).locator('..').locator('select');
    await eventSelect.selectOption('333');

    const resultTypeSelect = page.locator('label').filter({ hasText: 'Result Type' }).locator('..').locator('select');
    await resultTypeSelect.selectOption('rank');

    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(3000);

    // Raw and Unit should be disabled
    await expect(page.getByRole('button', { name: 'Raw' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Unit' }).first()).toBeDisabled();
    console.log('✓ Raw and Unit disabled for Rank + Time-based');
  });
});

test.describe('View Mode Functionality', () => {
  test('Percent mode works with incompatible types', async ({ page }) => {
    await page.goto('/');

    await addCompetitor(page, '2022SMIT01', '333fm');
    await addCompetitor(page, '2017KUBO01', '333');

    // Click percent button
    const percentButton = page.getByRole('button', { name: '%' }).first();
    await percentButton.click();

    // Should activate without error
    await expect(percentButton).toHaveClass(/active/);
    console.log('✓ Percent mode activated with incompatible types');
  });

  test('View mode persists in URL', async ({ page }) => {
    await page.goto('/');

    await addCompetitor(page, '2022SMIT01', '333');

    // Switch to percent mode
    await page.getByRole('button', { name: '%' }).first().click();

    // Check URL
    await expect(page).toHaveURL(/view=percent/);
    console.log('✓ View mode persisted in URL');
  });
});
