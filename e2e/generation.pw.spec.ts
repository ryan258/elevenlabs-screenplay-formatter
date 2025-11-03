import { test, expect, Page } from '@playwright/test';

const AUDIO_BASE64 = Buffer.from('mock audio data').toString('base64');
const MOCK_VOICES = [
  {
    voice_id: 'voice_john',
    name: 'John Test Voice',
    labels: { gender: 'male', accent: 'american', age: 'young' },
  },
];

async function stubVoices(page: Page) {
  await page.route('https://api.elevenlabs.io/v1/voices', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ voices: MOCK_VOICES }),
    });
  });
}

async function stubSubscription(page: Page, status: number) {
  await page.route('https://api.elevenlabs.io/v1/user/subscription', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

async function stubTextToSpeech(page: Page) {
  await page.route(/https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/.+\/with-timestamps/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'ratelimit-remaining': '5',
        'ratelimit-reset': `${Math.floor(Date.now() / 1000) + 60}`,
      },
      body: JSON.stringify({
        audio_base64: AUDIO_BASE64,
        alignment: {
          normalized_alignment: {
            word_start_times_seconds: [0],
            word_end_times_seconds: [1],
          },
        },
      }),
    });
  });
}

async function prepareScript(page: Page) {
  const scriptInput = page.locator('textarea[placeholder^="Required format"]');
  const sampleScript = `Characters:\n- JOHN\n\nINT. ROOM - DAY\n\nJOHN\nHello, this is a test script for audio generation.`;
  await scriptInput.fill(sampleScript);

  const browseButton = page.getByRole('button', { name: 'Browse Voices' }).first();
  await expect(browseButton).toBeVisible();
  await browseButton.click();

  await expect(page.getByRole('heading', { name: 'Select a Voice' })).toBeVisible();
  await page.getByRole('button', { name: 'Select' }).first().click();

  await page.click('label[for="concatenate"]');
}

async function fillApiKey(page: Page, value: string) {
  await page.getByPlaceholder('Enter your ElevenLabs API key').fill(value);
}

test.describe('Audio Generation Workflow', () => {
  test('completes happy path with mocked ElevenLabs responses', async ({ page }) => {
    await stubVoices(page);
    await stubSubscription(page, 200);
    await stubTextToSpeech(page);

    await page.goto('/');
    await prepareScript(page);
    await fillApiKey(page, 'test-api-key');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate Audio' }).click();

    await expect(page.locator('.Toastify__toast--success')).toContainText('Generation Complete');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.mp3$/);
  });

  test('shows error when API key validation fails', async ({ page }) => {
    await stubVoices(page);
    await stubSubscription(page, 401);

    await page.goto('/');
    await prepareScript(page);
    await fillApiKey(page, 'invalid-key');

    await page.getByRole('button', { name: 'Generate Audio' }).click();

    await expect(page.locator('.Toastify__toast--error')).toContainText('Invalid API Key');
  });
});
