/**
 * Language Definitions
 * Maps language codes to human-readable names
 * Based on ISO 639-1 and locale codes used by Bluesky
 */

export const LANGUAGES = {
  // Common languages
  'en': 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  'es': 'Spanish',
  'es-ES': 'Spanish (Spain)',
  'es-MX': 'Spanish (Mexico)',
  'fr': 'French',
  'fr-FR': 'French (France)',
  'fr-CA': 'French (Canada)',
  'de': 'German',
  'de-DE': 'German (Germany)',
  'de-AT': 'German (Austria)',
  'it': 'Italian',
  'pt': 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'tr': 'Turkish',
  'pl': 'Polish',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'cs': 'Czech',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'el': 'Greek',
  'he': 'Hebrew',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'uk': 'Ukrainian',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'et': 'Estonian',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'ga': 'Irish',
  'cy': 'Welsh',
  'mt': 'Maltese',
  'is': 'Icelandic',
  'mk': 'Macedonian',
  'sq': 'Albanian',
  'sr': 'Serbian',
  'bs': 'Bosnian',
  'ca': 'Catalan',
  'eu': 'Basque',
  'gl': 'Galician',
}

/**
 * Get human-readable name for a language code
 */
export const getLanguageName = (code) => {
  return LANGUAGES[code] || code
}

/**
 * Get all language options grouped by base language
 */
export const getLanguageOptions = () => {
  const baseLanguages = {}
  const locales = []

  Object.entries(LANGUAGES).forEach(([code, name]) => {
    if (code.includes('-')) {
      // Locale (e.g., en-US)
      locales.push({ code, name })
    } else {
      // Base language (e.g., en)
      if (!baseLanguages[code]) {
        baseLanguages[code] = { code, name, locales: [] }
      }
    }
  })

  // Add locales to their base languages
  locales.forEach(({ code, name }) => {
    const baseCode = code.split('-')[0]
    if (baseLanguages[baseCode]) {
      baseLanguages[baseCode].locales.push({ code, name })
    }
  })

  // Sort by name
  return Object.values(baseLanguages).sort((a, b) => a.name.localeCompare(b.name))
}
