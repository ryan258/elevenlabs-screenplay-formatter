/**
 * User-friendly error message utility
 * Converts technical API errors into helpful, actionable messages
 */

export interface ErrorDetails {
  title: string;
  message: string;
  actions?: string[];
}

/**
 * Converts an error into a user-friendly message with troubleshooting steps
 */
export function getUserFriendlyError(error: unknown, context?: string): ErrorDetails {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // API Key errors
  if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid api key')) {
    return {
      title: 'Invalid API Key',
      message: 'Your ElevenLabs API key appears to be invalid or has expired.',
      actions: [
        'Verify your API key at https://elevenlabs.io/app/settings/api-keys',
        'Make sure you copied the entire key without extra spaces',
        'Check if your API key has been revoked or expired',
        'Try generating a new API key'
      ]
    };
  }

  // Rate limit errors
  if (lowerMessage.includes('429') || lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return {
      title: 'Rate Limit Exceeded',
      message: 'You\'ve hit the ElevenLabs API rate limit. The app will automatically retry with delays.',
      actions: [
        'Wait a few minutes before trying again',
        'Consider upgrading your ElevenLabs plan for higher rate limits',
        'Process smaller batches of dialogue',
        'Check your usage at https://elevenlabs.io/app/usage'
      ]
    };
  }

  // Quota/subscription errors
  if (lowerMessage.includes('quota') || lowerMessage.includes('exceeded') || lowerMessage.includes('insufficient credits')) {
    return {
      title: 'Quota Exceeded',
      message: 'You\'ve used up your ElevenLabs character quota for this billing period.',
      actions: [
        'Check your remaining quota at https://elevenlabs.io/app/usage',
        'Wait until your quota resets',
        'Upgrade your plan for more characters per month',
        'Consider using shorter dialogue for testing'
      ]
    };
  }

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed') || lowerMessage.includes('timeout')) {
    return {
      title: 'Network Error',
      message: 'Unable to connect to ElevenLabs servers. This could be a temporary connection issue.',
      actions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Check if ElevenLabs is down at https://status.elevenlabs.io',
        'Disable VPN or proxy if you\'re using one'
      ]
    };
  }

  // Concatenation server errors
  if (lowerMessage.includes('concatenation') || lowerMessage.includes('localhost:3001') || lowerMessage.includes('econnrefused')) {
    return {
      title: 'Backend Server Not Running',
      message: 'The audio concatenation server is not running. Concatenation requires the backend server.',
      actions: [
        'Start the backend server: cd server && npm start',
        'Or disable the "Concatenate Audio" option to download individual files',
        'Make sure port 3001 is not in use by another application',
        'See CONCATENATION_SETUP.md for detailed setup instructions'
      ]
    };
  }

  // Voice configuration errors
  if (lowerMessage.includes('no voice configuration')) {
    const characterMatch = errorMessage.match(/character:\s*(.+)/i);
    const character = characterMatch ? characterMatch[1] : 'unknown';
    return {
      title: 'Missing Voice Configuration',
      message: `The character "${character}" doesn't have a voice assigned.`,
      actions: [
        'Scroll down to the Character Config panel',
        `Select a voice for "${character}" from the dropdown`,
        'Make sure all characters in your screenplay have voices assigned',
        'You can preview voices before assigning them'
      ]
    };
  }

  // Parsing errors
  if (lowerMessage.includes('no dialogue chunks') || lowerMessage.includes('parsing')) {
    return {
      title: 'Screenplay Format Error',
      message: 'The screenplay parser couldn\'t detect any dialogue in your script.',
      actions: [
        'Make sure your script starts with "Characters:" section',
        'List character names with dashes: - CHARACTER NAME',
        'Use ALL CAPS for character names in dialogue',
        'See the example.txt file or EXAMPLE_SCREENPLAY.md for correct formatting',
        'Try copying the example script to test if the app is working'
      ]
    };
  }

  // FFmpeg errors
  if (lowerMessage.includes('ffmpeg')) {
    return {
      title: 'FFmpeg Error',
      message: 'There was an error processing audio with FFmpeg.',
      actions: [
        'Make sure FFmpeg is installed: ffmpeg -version',
        'Restart the backend server',
        'Check the server logs for detailed error messages',
        'Try disabling concatenation and downloading individual files instead'
      ]
    };
  }

  // Server errors (500-599)
  if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503')) {
    return {
      title: 'Server Error',
      message: 'ElevenLabs servers are experiencing issues. This is usually temporary.',
      actions: [
        'Wait a few minutes and try again',
        'Check ElevenLabs status page: https://status.elevenlabs.io',
        'The app will automatically retry failed requests',
        'Contact ElevenLabs support if the issue persists'
      ]
    };
  }

  // Generic error with context
  return {
    title: context || 'Unexpected Error',
    message: errorMessage || 'An unexpected error occurred.',
    actions: [
      'Try refreshing the page',
      'Check the browser console for more details (F12)',
      'Report this issue on GitHub with the error message',
      'Try a simpler screenplay to isolate the problem'
    ]
  };
}

/**
 * Formats error details for display in a toast notification
 */
export function formatErrorForToast(error: unknown, context?: string): string {
  const details = getUserFriendlyError(error, context);
  return `${details.title}\n\n${details.message}\n\nTroubleshooting:\n${details.actions?.map((action, i) => `${i + 1}. ${action}`).join('\n') || ''}`;
}

/**
 * Formats error details for console logging
 */
export function logErrorWithContext(error: unknown, context?: string): void {
  const details = getUserFriendlyError(error, context);
  console.error(`[${details.title}]`, details.message);
  if (details.actions) {
    console.info('Troubleshooting steps:', details.actions);
  }
  if (error instanceof Error) {
    console.error('Original error:', error);
  }
}
