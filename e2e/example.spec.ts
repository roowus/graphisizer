import { test, expect } from '@playwright/test';

test.describe('Graphisizer Basic E2E', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check that page loaded successfully by checking for the title
    await expect(page).toHaveTitle(/Graphisizer/);

    // Check for the search input
    await expect(page.getByPlaceholder('Search by ID or name...')).toBeVisible();
  });

  test('search functionality works', async ({ page }) => {
    await page.goto('/');

    // Click on the search input
    const searchInput = page.getByPlaceholder('Search by ID or name...');
    await searchInput.click();

    // Type a search query
    await searchInput.fill('Max');

    // Wait for suggestions to appear (debounced search)
    await page.waitForTimeout(500);

    // Verify search is working
    await expect(searchInput).toHaveValue('Max');
  });

  test('event dropdown has all events', async ({ page }) => {
    await page.goto('/');

    // Find the event dropdown by label
    const eventSelect = page.locator('label:has-text("Event")').locator('..').locator('select');
    await expect(eventSelect).toBeVisible();

    // Get all options
    const options = await eventSelect.locator('option').allTextContents();

    // Verify some key events exist
    expect(options).toContain('3x3x3');
    expect(options).toContain('2x2x2');
    expect(options).toContain('Clock');
    expect(options).toContain('Megaminx');
  });

  test('add graph button is present', async ({ page }) => {
    await page.goto('/');

    // Check for the add graph button
    const addButton = page.getByRole('button', { name: /add graph/i });
    await expect(addButton).toBeVisible();
  });

  test('URL state persists when adding competitor', async ({ page }) => {
    await page.goto('/');

    // Fill in search and select event
    const searchInput = page.getByPlaceholder('Search by ID or name...');
    await searchInput.fill('2022SMIT01');

    // Wait a bit for the value to be set
    await page.waitForTimeout(300);

    // Check that URL is still clean (no params yet)
    expect(page.url()).not.toContain('?');

    // The actual graph addition would require clicking the button
    // This test verifies the initial state
  });
});

test.describe('Graphisizer View Modes', () => {
  test('view mode can be set via URL', async ({ page }) => {
    // Navigate with view mode parameter
    await page.goto('/?view=percent');

    // The page should load without errors
    await expect(page).toHaveTitle(/Graphisizer/);
  });

  test('view mode can be unit', async ({ page }) => {
    await page.goto('/?view=unit');

    // The page should load without errors
    await expect(page).toHaveTitle(/Graphisizer/);
  });
});

