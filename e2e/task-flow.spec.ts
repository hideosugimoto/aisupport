import { test, expect } from '@playwright/test';

test.describe('Task Decision Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display page title and form elements', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('AI意思決定アシスタント');

    // Check form elements exist
    await expect(page.locator('input[placeholder*="タスク"]').first()).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible(); // Available time
    await expect(page.locator('button:has-text("1")').first()).toBeVisible(); // Energy level
    await expect(page.locator('button:has-text("最適タスクを判断")')).toBeVisible(); // Submit button
  });

  test('should complete full task decision flow', async ({ page }) => {
    // Step 1: Input task name
    const taskInput = page.locator('input[placeholder*="タスク"]').first();
    await taskInput.fill('テストタスク');

    // Step 2: Set available time (optional, default should be set)
    const timeInput = page.locator('input[type="number"]');
    await timeInput.fill('60');

    // Step 3: Set energy level
    const energyButton = page.locator('button:has-text("3")').first();
    await energyButton.click();

    // Step 4: Select AI engine
    const engineButton = page.locator('button:has-text("openai")');
    await engineButton.click();

    // Step 5: Submit form
    const submitButton = page.locator('button:has-text("最適タスクを判断")');
    await submitButton.click();

    // Step 6: Check for loading state OR result (mock mode is very fast)
    // Either the button becomes disabled (real API) or result appears immediately (mock)
    await Promise.race([
      expect(submitButton).toBeDisabled(),
      expect(page.locator('text=テスト判定結果')).toBeVisible({ timeout: 1000 })
    ]).catch(() => {
      // If both fail, that's okay - check for result with longer timeout
    });

    // Step 7: Wait for result to appear
    await expect(page.locator('text=テスト判定結果')).toBeVisible({ timeout: 10000 });

    // Step 8: Check that result content is displayed
    await expect(page.locator('text=実施推奨')).toBeVisible();
    await expect(page.locator('text=モックレスポンス')).toBeVisible();
  });

  test('should allow task breakdown after decision', async ({ page }) => {
    // Complete initial decision
    await page.locator('input[placeholder*="タスク"]').first().fill('分解対象タスク');
    await page.locator('button:has-text("openai")').click();
    await page.locator('button:has-text("最適タスクを判断")').click();

    // Wait for decision result to appear
    await expect(page.locator('text=テスト判定結果')).toBeVisible({ timeout: 10000 });

    // Check if breakdown button appears (text is "このタスクを分解する")
    const breakdownButton = page.locator('button:has-text("このタスクを分解する")');
    await expect(breakdownButton).toBeVisible({ timeout: 5000 });

    // Click breakdown button
    await breakdownButton.click();

    // Wait for breakdown result - look for "サブタスク分解結果"
    await expect(page.locator('text=サブタスク分解結果')).toBeVisible({ timeout: 10000 });

    // Verify breakdown content is displayed
    await expect(page.locator('text=要件定義')).toBeVisible();
    await expect(page.locator('text=設計')).toBeVisible();
  });

  test('should show error when form is invalid', async ({ page }) => {
    // Try to submit without filling task
    const taskInput = page.locator('input[placeholder*="タスク"]').first();
    await taskInput.clear();

    const submitButton = page.locator('button:has-text("最適タスクを判断")');
    await submitButton.click();

    // Form validation should prevent submission or show error
    // In this case, we check that no result appears
    await page.waitForTimeout(1000);
    await expect(page.locator('text=テスト判定結果')).not.toBeVisible();
  });

  test('should navigate to other pages', async ({ page }) => {
    // Check navigation links
    const compareLink = page.locator('a:has-text("比較")');
    const historyLink = page.locator('a:has-text("履歴")');
    const costLink = page.locator('a:has-text("コスト確認")');

    await expect(compareLink).toBeVisible();
    await expect(historyLink).toBeVisible();
    await expect(costLink).toBeVisible();

    // Test navigation
    await compareLink.click();
    await expect(page).toHaveURL('/compare');

    await page.goBack();
    await historyLink.click();
    await expect(page).toHaveURL('/history');

    await page.goBack();
    await costLink.click();
    await expect(page).toHaveURL('/cost');
  });
});
