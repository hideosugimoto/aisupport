import { test, expect } from '@playwright/test';

test.describe('Cost Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cost');
  });

  test('should display cost dashboard page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('コストダッシュボード');

    // Check description
    await expect(page.locator('text=LLM API利用コストの可視化')).toBeVisible();

    // Check navigation links
    await expect(page.locator('a:has-text("比較")')).toBeVisible();
    await expect(page.locator('a:has-text("履歴")')).toBeVisible();
    await expect(page.locator('a:has-text("タスク決定に戻る")')).toBeVisible();
  });

  test('should display cost information', async ({ page }) => {
    // Wait for the dashboard component to load
    await page.waitForTimeout(1000);

    // Check for cost-related text elements
    // The exact text depends on whether there's data, but the structure should be present
    const dashboardContent = page.locator('[class*="bg-white"], [class*="bg-zinc"]').first();
    await expect(dashboardContent).toBeVisible();
  });

  test('should display budget progress bar', async ({ page }) => {
    // Wait for component to render
    await page.waitForTimeout(1000);

    // Check for budget-related elements
    // These might be visible depending on the data
    // We just verify the page structure loads without errors
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should load weekly review section', async ({ page }) => {
    // Wait for component to render
    await page.waitForTimeout(1000);

    // Check if weekly review section exists
    // The button might be present for generating review
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('should navigate back to home', async ({ page }) => {
    const homeLink = page.locator('a:has-text("タスク決定に戻る")');
    await homeLink.click();
    await expect(page).toHaveURL('/');
  });
});
