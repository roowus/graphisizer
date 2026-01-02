import { test, expect } from '@playwright/test';

test('Debug - Check page structure', async ({ page }) => {
  await page.goto('/');

  // Take a screenshot
  await page.screenshot({ path: 'test-debug-homepage.png' });

  // Check for search input
  const searchInput = page.getByPlaceholder('Search by ID or name...');
  await expect(searchInput).toBeVisible();
  console.log('✓ Search input found');

  // Fill search
  await searchInput.fill('2022SMIT01');
  await page.waitForTimeout(500);

  // Check for Event select
  const eventSelects = page.locator('select').all();
  console.log(`Found ${eventSelects.length} select elements`);

  // Try to find Event select
  const eventSelect = page.locator('select').first();
  const eventOptions = await eventSelect.locator('option').allTextContents();
  console.log('Event options:', eventOptions.slice(0, 5));

  // Select 333
  await eventSelect.selectOption('333');
  console.log('✓ Selected 333');

  // Screenshot
  await page.screenshot({ path: 'test-debug-after-select.png' });
});
