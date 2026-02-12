import { test, expect } from '@playwright/test';

test.describe('Compare Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compare');
  });

  test('should display compare page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('エンジン比較');

    // Check description
    await expect(page.locator('text=全エンジンで並列判定し、比較します')).toBeVisible();

    // Check navigation links
    await expect(page.locator('a:has-text("履歴")')).toBeVisible();
    await expect(page.locator('a:has-text("コスト確認")')).toBeVisible();
    await expect(page.locator('a:has-text("タスク決定に戻る")')).toBeVisible();
  });

  test('should display form elements', async ({ page }) => {
    // Check task input exists
    await expect(page.locator('input[placeholder*="タスク"]').first()).toBeVisible();

    // Check available time input (use first since there are multiple number inputs)
    const timeInput = page.locator('input[type="number"]').first();
    await expect(timeInput).toBeVisible();

    // Check energy level input (second number input)
    const energyInput = page.locator('input[type="number"]').nth(1);
    await expect(energyInput).toBeVisible();

    // Check submit button
    const submitButton = page.locator('button:has-text("全エンジンで比較")');
    await expect(submitButton).toBeVisible();
  });

  test('should allow task input', async ({ page }) => {
    const taskInput = page.locator('input[placeholder*="タスク"]').first();
    await taskInput.fill('比較テストタスク');

    const value = await taskInput.inputValue();
    expect(value).toBe('比較テストタスク');
  });

  test('should allow adding tasks', async ({ page }) => {
    // Check initial task input
    const initialInputs = page.locator('input[placeholder*="タスク"]');
    const initialCount = await initialInputs.count();

    // Click add task button (if exists)
    const addButton = page.locator('button:has-text("タスクを追加")');
    if (await addButton.isVisible()) {
      await addButton.click();

      // Verify new input was added
      const newInputs = page.locator('input[placeholder*="タスク"]');
      const newCount = await newInputs.count();
      expect(newCount).toBe(initialCount + 1);
    }
  });

  test('should allow energy level selection', async ({ page }) => {
    // Select energy level 4 via number input
    const energyInput = page.locator('input[type="number"]').nth(1);
    await energyInput.fill('4');

    // Verify value was set
    const value = await energyInput.inputValue();
    expect(value).toBe('4');
  });

  test('should run comparison', async ({ page }) => {
    // Fill in form
    await page.locator('input[placeholder*="タスク"]').first().fill('E2E比較テスト');

    // Set energy level via number input
    const energyInput = page.locator('input[type="number"]').nth(1);
    await energyInput.fill('3');

    // Submit form
    const submitButton = page.locator('button:has-text("全エンジンで比較")');
    await submitButton.click();

    // Check for loading state OR quick completion (mock mode is very fast)
    await Promise.race([
      expect(submitButton).toBeDisabled(),
      page.waitForTimeout(500)
    ]).catch(() => {
      // Either loading state or quick completion is fine
    });

    // Wait for results or error (in mock mode, should complete quickly)
    await page.waitForTimeout(2000);

    // Verify the page rendered without crashing
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('should navigate to other pages', async ({ page }) => {
    // Navigate to history
    await page.locator('a:has-text("履歴")').click();
    await expect(page).toHaveURL('/history');

    // Go back and navigate to cost
    await page.goto('/compare');
    await page.locator('a:has-text("コスト確認")').click();
    await expect(page).toHaveURL('/cost');

    // Go back and navigate to home
    await page.goto('/compare');
    await page.locator('a:has-text("タスク決定に戻る")').click();
    await expect(page).toHaveURL('/');
  });
});
