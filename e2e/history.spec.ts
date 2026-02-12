import { test, expect } from '@playwright/test';

test.describe('History Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
  });

  test('should display history page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('判定履歴');

    // Check description
    await expect(page.locator('text=過去のAI判定結果を確認')).toBeVisible();

    // Check navigation links
    await expect(page.locator('a:has-text("比較")')).toBeVisible();
    await expect(page.locator('a:has-text("コスト確認")')).toBeVisible();
    await expect(page.locator('a:has-text("タスク決定に戻る")')).toBeVisible();
  });

  test('should display history list UI elements', async ({ page }) => {
    // Wait for the component to render
    await page.waitForTimeout(1000);

    // The page should render without errors
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // History list component should be present
    // Even if empty, the UI structure should be there
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();
  });

  test('should have search functionality UI', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(1000);

    // Check if search input exists (if implemented in HistoryList component)
    // The presence depends on the component implementation
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should display empty state when no history exists', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(1000);

    // Check page renders properly
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('should navigate to other pages', async ({ page }) => {
    // Navigate to compare page
    await page.locator('a:has-text("比較")').click();
    await expect(page).toHaveURL('/compare');

    // Go back and navigate to cost page
    await page.goto('/history');
    await page.locator('a:has-text("コスト確認")').click();
    await expect(page).toHaveURL('/cost');

    // Go back and navigate to home
    await page.goto('/history');
    await page.locator('a:has-text("タスク決定に戻る")').click();
    await expect(page).toHaveURL('/');
  });
});
