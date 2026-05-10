export function getEmailProviderMode() {
  return process.env.EMAIL_PROVIDER_MODE || 'manual';
}

export function getWebmailUrl() {
  return process.env.WEBMAIL_URL || 'https://webmail.idea.org.mn';
}

export async function provisionEmailAccount() {
  const mode = getEmailProviderMode();

  if (mode === 'manual') {
    return {
      mode,
      message:
        'Manual mode is active. Create the mailbox in the selected email provider, then record it in the admin panel.',
    };
  }

  // TODO: Implement cPanel Email API integration when provider credentials are available.
  // TODO: Implement Datacom Email Host integration if an official API is provided.
  // TODO: Implement Google Workspace Directory/Gmail provisioning when OAuth credentials are configured.
  // TODO: Implement Microsoft 365 Graph provisioning when tenant credentials are configured.
  throw new Error(`Email provider mode "${mode}" is reserved for future integration.`);
}
