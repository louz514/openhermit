// Shared provider → API-key-name helper. Used by both BasicPanel (config
// edit) and ChatShell (inline "needs API key" banner) so the two stay in
// sync on what counts as a configured key.

export const candidateSecretNames = (provider: string): string[] => {
  const upper = provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_API_KEY';
  const extras: Record<string, string[]> = {
    google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  };
  return extras[provider] ?? [upper];
};

export const providerHasKey = (
  provider: string,
  secrets: Record<string, string>,
): boolean => candidateSecretNames(provider).some((name) => Boolean(secrets[name]));
