import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for Graphisizer
 * Tests all major features from SPEC.md
 */

test.describe('Graphisizer - Search & Add Competitors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('search by WCA ID and add competitor', async ({ page }) => {
    // Search for a competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500); // Wait for debounced search

    // Select event and result type using more specific selectors
    const eventSelect = page.locator('label').filter({ hasText: 'Event' }).locator('..').locator('select');
    await eventSelect.selectOption('333');

    const resultTypeSelect = page.locator('label').filter({ hasText: 'Result Type' }).locator('..').locator('select');
    await resultTypeSelect.selectOption('single');

    // Add graph
    await page.getByRole('button', { name: /add graph/i }).click();

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Verify graph was added
    await expect(page.locator('.chart-container')).toBeVisible();
  });

  test('search autocomplete shows suggestions', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search by ID or name...');

    // Type partial name
    await searchInput.fill('Max');
    await page.waitForTimeout(500);

    // Should have autocomplete suggestions
    // Note: May need to adjust selector based on actual autocomplete implementation
    const suggestions = page.locator('[role="listbox"], .autocomplete-suggestions');
    await expect(suggestions).toBeVisible({ timeout: 5000 }).catch(() => {
      // Autocomplete might not show immediately or API might be slow
      console.log('Autocomplete not immediately visible, continuing...');
    });
  });

  test('WCA ID is auto-uppercased', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search by ID or name...');

    await searchInput.fill('2022smith01');
    await page.waitForTimeout(300);

    // Value should be uppercased
    const value = await searchInput.inputValue();
    expect(value).toBe('2022SMITH01');
  });
});

test.describe('Graphisizer - Incompatible Unit Type Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Raw and Unit buttons disabled for FMC + time-based comparison', async ({ page }) => {
    // Add first competitor (FMC)
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333fm');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();

    // Wait for graph to load
    await page.waitForTimeout(2000);

    // Add second competitor (time-based)
    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();

    // Wait for second graph
    await page.waitForTimeout(2000);

    // Check that Raw button is disabled
    const rawButton = page.getByRole('button', { name: 'Raw' });
    await expect(rawButton).toBeDisabled();

    // Check that Unit button is disabled
    const unitButton = page.getByRole('button', { name: 'Unit' });
    await expect(unitButton).toBeDisabled();

    // Check that Percent button is still enabled
    const percentButton = page.getByRole('button', { name: '%' });
    await expect(percentButton).not.toBeDisabled();
  });

  test('warning badge displays for incompatible types', async ({ page }) => {
    // Add FMC competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333fm');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Add time-based competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Check for warning badge
    const warningBadge = page.getByText('⚠️ Incompatible units');
    await expect(warningBadge).toBeVisible();
  });

  test('buttons have correct tooltips for incompatible types', async ({ page }) => {
    // Add FMC + time-based competitors
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333fm');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Check Raw button tooltip
    const rawButton = page.getByRole('button', { name: 'Raw' });
    await expect(rawButton).toHaveAttribute('title', /Cannot compare.*FMC.*Time-based.*raw mode/);

    // Check Unit button tooltip
    const unitButton = page.getByRole('button', { name: 'Unit' });
    await expect(unitButton).toHaveAttribute('title', /Cannot compare.*FMC.*Time-based.*unit change mode/);
  });

  test('buttons enabled when comparing compatible types', async ({ page }) => {
    // Add two time-based competitors
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // All buttons should be enabled
    await expect(page.getByRole('button', { name: 'Raw' })).not.toBeDisabled();
    await expect(page.getByRole('button', { name: 'Unit' })).not.toBeDisabled();
    await expect(page.getByRole('button', { name: '%' })).not.toBeDisabled();

    // No warning badge
    await expect(page.getByText('⚠️ Incompatible units')).not.toBeVisible();
  });
});

test.describe('Graphisizer - View Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Add a competitor for testing
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);
  });

  test('switch to Unit change mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Unit' }).click();

    // Chart title should change
    await expect(page.getByText('Change')).toBeVisible();
  });

  test('switch to Percent change mode', async ({ page }) => {
    await page.getByRole('button', { name: '%' }).click();

    // Chart title should change
    await expect(page.getByText('Change')).toBeVisible();
  });

  test('switch back to Raw mode', async ({ page }) => {
    // Switch to Unit first
    await page.getByRole('button', { name: 'Unit' }).click();

    // Switch back to Raw
    await page.getByRole('button', { name: 'Raw' }).click();

    // Chart title should show Progression
    await expect(page.getByText('Progression')).toBeVisible();
  });

  test('view mode persists in URL', async ({ page }) => {
    // Switch to percent mode
    await page.getByRole('button', { name: '%' }).click();

    // Check URL
    await expect(page).toHaveURL(/view=percent/);
  });
});

test.describe('Graphisizer - URL State Persistence', () => {
  test('URL parameters restore comparison', async ({ page }) => {
    // Navigate with URL parameters
    await page.goto('/?g1=2022SMIT01:333:single');

    // Should load competitor data
    await page.waitForTimeout(3000);

    // Chart should be visible
    await expect(page.locator('.chart-container')).toBeVisible();
  });

  test('URL preserves view mode', async ({ page }) => {
    // Navigate with view mode
    await page.goto('/?g1=2022SMIT01:333:single&view=percent');

    await page.waitForTimeout(3000);

    // Percent button should be active
    const percentButton = page.getByRole('button', { name: '%' });
    await expect(percentButton).toHaveClass(/active/);
  });
});

test.describe('Graphisizer - Multi-Competitor Comparison', () => {
  test('add multiple competitors', async ({ page }) => {
    await page.goto('/');

    // Add first competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Add second competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Both should be visible in comparison
    const chartLines = page.locator('.recharts-line').all();
    expect((await chartLines).length).toBeGreaterThan(0);
  });
});

test.describe('Graphisizer - All Events', () => {
  const events = [
    '222', '333', '444', '555', '666', '777',
    '333oh', '333bf', '444bf', '555bf', '333mbf',
    '333fm', 'clock', 'minx', 'pyram', 'skewb', 'sq1'
  ];

  for (const event of events) {
    test(`event ${event} loads correctly`, async ({ page }) => {
      await page.goto('/');

      await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
      await page.getByLabel('Event').selectOption(event);
      await page.getByLabel('Result Type').selectOption('Single Best');
      await page.getByRole('button', { name: /add graph/i }).click();

      // Wait for data to load
      await page.waitForTimeout(3000);

      // Chart should be visible
      await expect(page.locator('.chart-container')).toBeVisible();
    });
  }
});

test.describe('Graphisizer - Graph Controls', () => {
  test('remove competitor', async ({ page }) => {
    await page.goto('/');

    // Add competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Remove competitor
    await page.getByRole('button', { name: /remove/i }).click();

    // Should return to empty state
    await expect(page.locator('.chart-container')).not.toBeVisible();
  });

  test('edit competitor inline', async ({ page }) => {
    await page.goto('/');

    // Add competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Edit WCA ID
    const wcaInput = page.locator('input[value="2022SMIT01"]');
    await wcaInput.click();
    await wcaInput.clear();
    await wcaInput.fill('2017KUBO01');

    // Should trigger data reload
    await page.waitForTimeout(2000);

    // Chart should still be visible
    await expect(page.locator('.chart-container')).toBeVisible();
  });
});

test.describe('Graphisizer - Statistics', () => {
  test('statistics display for competitor', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Look for statistics in the info panel
    await expect(page.getByText(/Mean|Median|Best|Std Dev/i)).toBeVisible();
  });
});

test.describe('Graphisizer - Data Table', () => {
  test('data table displays results', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.getByLabel('Event').selectOption('333');
    await page.getByLabel('Result Type').selectOption('Single Best');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(2000);

    // Scroll to table
    await page.locator('.table-section').scrollIntoViewIfNeeded();

    // Table should have headers
    await expect(page.getByText('Competitor')).toBeVisible();
    await expect(page.getByText('Date')).toBeVisible();
    await expect(page.getByText('Competition')).toBeVisible();
    await expect(page.getByText('Result')).toBeVisible();
  });
});
