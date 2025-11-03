import { test, expect } from '@playwright/test';

test.describe('Audio Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/'); // Assuming your app runs on this port
  });

  test('should successfully generate and download audio', async ({ page }) => {
    // 1. Input Script
    await page.locator('textarea').fill(`
Characters:
- JOHN

INT. ROOM - DAY

JOHN
Hello, this is a test script for audio generation.
`);

    // 2. Enter API Key (assuming a mock or pre-configured key for E2E)
    await page.fill('input[placeholder="Enter your ElevenLabs API Key"]', 'YOUR_MOCK_API_KEY');

    // 3. Configure Character Voice (assuming default voice ID for JOHN)
    // You might need to interact with the VoiceSelectorModal here if not using a default
    await page.fill('#voice-id-JOHN', 'flq6f7g4fj0000000000'); // Replace with a valid mock/test voice ID

    // 4. Click Generate Audio
    await page.click('button:has-text("Generate Audio")');

    // 5. Wait for generation to complete (check for success toast)
    await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.Toastify__toast--success')).toContainText('Generation Complete!');

    // 6. Verify download (this is tricky in Playwright, often involves intercepting network requests)
    // For simplicity, we'll check if a download was initiated.
    const downloadPromise = page.waitForEvent('download');
    // Re-click generate if needed, or ensure the previous action triggered download
    // This part depends on how your app triggers download after generation
    // If it's automatic, the previous click should suffice.
    // If it requires another click, add it here.
    // For now, assuming it's automatic after success.
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/concatenated_audio\.mp3|\.wav|\.ogg|\.flac/);
    // You can also save the file and check its content if necessary
    // await download.saveAs('./test-downloads/' + download.suggestedFilename());
  });

  test('should show error for invalid API key', async ({ page }) => {
    // 1. Input Script
    await page.locator('textarea').fill(`
Characters:
- JOHN

INT. ROOM - DAY

JOHN
Hello, this is a test script.
`);

    // 2. Enter an invalid API Key
    await page.fill('input[placeholder="Enter your ElevenLabs API Key"]', 'INVALID_API_KEY');

    // 3. Click Generate Audio
    await page.click('button:has-text("Generate Audio")');

    // 4. Wait for error toast
    await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.Toastify__toast--error')).toContainText('Invalid API Key');
  });

  
});
