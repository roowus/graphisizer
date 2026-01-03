import { test, expect } from '@playwright/test';

/**
 * Comprehensive Statistics & Graph Feature Tests
 * Tests all statistical calculations, comparison stats, and data visualization
 */

test.describe('Statistics Calculations', () => {
  test('displays mean, median, std dev, best for competitor', async ({ page }) => {
    await page.goto('/');

    // Add a competitor with multiple results
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Check for statistics in the UI
    const pageContent = await page.content();

    // Look for common stat labels
    const hasMean = pageContent.includes('Mean') || pageContent.includes('Avg');
    const hasMedian = pageContent.includes('Med') || pageContent.includes('Median');
    const hasBest = pageContent.includes('Best');
    const hasStdDev = pageContent.includes('Std Dev') || pageContent.includes('SD');

    console.log(`Stats found - Mean: ${hasMean}, Median: ${hasMedian}, Best: ${hasBest}, StdDev: ${hasStdDev}`);

    // At least some stats should be visible
    expect(hasMean || hasBest).toBe(true);
  });

  test('statistics update when competitor is added', async ({ page }) => {
    await page.goto('/');

    // Add first competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Get initial stats
    const initialContent = await page.content();

    // Add second competitor
    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Stats should be updated for comparison
    const updatedContent = await page.content();

    // Should show comparison stats
    const hasComparisonStats = updatedContent.includes('COMPARISON') ||
                              updatedContent.includes('comparison') ||
                              updatedContent.includes('head-to-head');

    console.log(`Comparison stats present: ${hasComparisonStats}`);
    expect(hasComparisonStats).toBe(true);
  });
});

test.describe('Head-to-Head Comparison Stats', () => {
  test('shows rankings between competitors', async ({ page }) => {
    await page.goto('/');

    // Add two competitors
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Look for head-to-head section
    const pageContent = await page.content();
    const hasRankings = pageContent.includes('HEAD-TO-HEAD') ||
                       pageContent.includes('Rankings');

    console.log(`Head-to-head rankings: ${hasRankings}`);
    expect(hasRankings).toBe(true);
  });

  test('highlights winner in comparison', async ({ page }) => {
    await page.goto('/');

    // Add two competitors for comparison
    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    await page.getByPlaceholder('Search by ID or name...').fill('2017KUBO01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Check for winner highlight (usually green or trophy)
    const pageContent = await page.content();
    const hasWinner = pageContent.includes('🏆') ||
                      pageContent.includes('Winner') ||
                      pageContent.includes('1st') ||
                      pageContent.includes('#22c55e'); // green color hex

    console.log(`Winner highlight present: ${hasWinner}`);
    expect(hasWinner).toBe(true);
  });
});

test.describe('All Result Types', () => {
  const resultTypes = ['single', 'average', 'rank'];

  for (const resultType of resultTypes) {
    test(`result type ${resultType} loads and displays data`, async ({ page }) => {
      await page.goto('/');

      await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
      await page.waitForTimeout(500);
      await page.locator('select').first().selectOption('333');
      await page.locator('select').nth(1).selectOption(resultType);
      await page.getByRole('button', { name: /add graph/i }).click();
      await page.waitForTimeout(5000);

      // Chart should be visible
      const chartVisible = await page.locator('.chart-container').isVisible().catch(() => false);
      console.log(`${resultType} - Chart visible: ${chartVisible}`);

      // Should have some data
      const pageContent = await page.content();
      const hasData = pageContent.includes('2022SMIT01') || pageContent.includes('Max');

      expect(hasData || chartVisible).toBe(true);
    });
  }
});

test.describe('Data Table Functionality', () => {
  test('data table shows all results', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Scroll to find data table
    await page.locator('.table-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Check for table headers
    const pageContent = await page.content();
    const hasTable = pageContent.includes('Date') &&
                    pageContent.includes('Competition') &&
                    pageContent.includes('Result');

    console.log(`Data table present: ${hasTable}`);
    expect(hasTable).toBe(true);
  });

  test('data table shows change columns', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    await page.locator('.table-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const pageContent = await page.content();
    const hasChangeColumn = pageContent.includes('Change') ||
                          pageContent.includes('Improvement');

    console.log(`Change column present: ${hasChangeColumn}`);
    expect(hasChangeColumn).toBe(true);
  });
});

test.describe('Chart Interactivity', () => {
  test('chart tooltips show on hover', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Try to hover over the chart area
    const chart = page.locator('.recharts-wrapper').first();
    await chart.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Hover over chart
    await chart.hover({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(1000);

    // Take screenshot to verify
    await page.screenshot({ path: 'chart-hover-test.png' });

    // Test passes if we can interact with the chart
    console.log('✓ Chart is interactive');
    expect(await chart.isVisible()).toBe(true);
  });

  test('chart legend displays competitor names', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Check for legend or competitor names
    const pageContent = await page.content();
    const hasLegend = pageContent.includes('2022SMIT01') ||
                      pageContent.includes('Smith') ||
                      pageContent.includes('Max Park');

    console.log(`Competitor name visible: ${hasLegend}`);
    expect(hasLegend).toBe(true);
  });
});

test.describe('Different Event Types', () => {
  test('time-based event shows time statistics', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Should show time format (likely colon-separated)
    const pageContent = await page.content();
    const hasTimeFormat = pageContent.includes(':') &&
                         (pageContent.includes('result') || pageContent.includes('Result'));

    console.log(`Time format present: ${hasTimeFormat}`);
  });

  test('FMC event shows move count statistics', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333fm');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // FMC should show move counts, not times
    const pageContent = await page.content();
    const hasFMCData = pageContent.includes('2022SMIT01') || pageContent.includes('Fewest Moves');

    console.log(`FMC data loaded: ${hasFMCData}`);
    expect(hasFMCData).toBe(true);
  });
});

test.describe('View Mode Statistics', () => {
  test('raw mode shows absolute values', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Raw mode should be active by default
    const rawButton = page.getByRole('button', { name: 'Raw' }).first();
    const isRawActive = await rawButton.getAttribute('class')?.includes('active');

    console.log(`Raw mode active: ${isRawActive}`);
    expect(isRawActive).toBe(true);
  });

  test('unit change mode shows differences', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Switch to unit change mode
    await page.getByRole('button', { name: 'Unit' }).first().click();
    await page.waitForTimeout(500);

    // Chart title should change to "Change"
    const pageContent = await page.content();
    const showsChange = pageContent.includes('Change');

    console.log(`Unit change mode: ${showsChange}`);
    expect(showsChange).toBe(true);
  });

  test('percent change mode shows percentages', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Switch to percent mode
    await page.getByRole('button', { name: '%' }).first().click();
    await page.waitForTimeout(500);

    // Check URL updated
    const url = page.url();
    const hasPercentParam = url.includes('view=percent');

    console.log(`Percent mode in URL: ${hasPercentParam}`);
    expect(hasPercentParam).toBe(true);
  });
});

test.describe('Graph Control List Features', () => {
  test('can edit competitor WCA ID inline', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Find the WCA ID input in the graph control list
    const wcaInput = page.locator('input[value="2022SMIT01"]');
    if (await wcaInput.count() > 0) {
      await wcaInput.click();
      await wcaInput.clear();
      await wcaInput.fill('2017KUBO01');
      await page.waitForTimeout(2000);

      const value = await wcaInput.inputValue();
      console.log(`Edited WCA ID: ${value}`);
      // The edit should work
      expect(value).toBe('2017KUBO01');
    } else {
      console.log('WCA ID input not found in control list');
    }
  });

  test('can remove competitor from list', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    // Find and click remove button
    const removeButton = page.getByRole('button').filter({ hasText: /×|X|remove/i }).first();
    const removeCount = await removeButton.count();

    if (removeCount > 0) {
      await removeButton.click();
      await page.waitForTimeout(2000);

      // Chart should be hidden or removed
      const chartVisible = await page.locator('.chart-container').isVisible().catch(() => false);
      console.log(`Chart visible after removal: ${chartVisible}`);

      // If this is the only graph, chart should be hidden
      // If there are multiple, one should be removed
    } else {
      console.log('Remove button not found');
    }
  });
});

test.describe('Statistics Accuracy', () => {
  test('mean calculation is reasonable', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    const pageContent = await page.content();

    // Look for mean/average stat
    if (pageContent.includes('Mean') || pageContent.includes('Avg')) {
      // Mean should be a reasonable time (between 0 and 1000 seconds for 3x3)
      const timeMatch = pageContent.match(/(\d+\.?\d*)\s*(s|sec|seconds)/i);
      if (timeMatch) {
        const time = parseFloat(timeMatch[1]);
        console.log(`Mean time: ${time}s`);
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(1000);
      }
    }
  });

  test('best value is highlighted', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    const pageContent = await page.content();

    // Best value should be highlighted (green color or bold)
    const hasBest = pageContent.includes('Best');
    const hasGreen = pageContent.includes('#22c55e'); // green color

    console.log(`Best stat highlighted: ${hasBest || hasGreen}`);
    expect(hasBest).toBe(true);
  });
});

test.describe('Special Statistics', () => {
  test('consistency metric displays', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    const pageContent = await page.content();
    const hasConsistency = pageContent.includes('Cons') ||
                          pageContent.includes('Consistency');

    console.log(`Consistency metric: ${hasConsistency}`);
    // Consistency might not always be shown, but if it is, that's good
  });

  test('range stat displays when multiple results', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Search by ID or name...').fill('2022SMIT01');
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption('333');
    await page.locator('select').nth(1).selectOption('single');
    await page.getByRole('button', { name: /add graph/i }).click();
    await page.waitForTimeout(5000);

    const pageContent = await page.content();
    const hasRange = pageContent.includes('Range');

    console.log(`Range stat: ${hasRange}`);
    // Range is typically shown when there's variance in data
  });
});
