/**
 * OIDC-based SSO for Azure AD and Salesforce.
 *
 * Uses the openid-client library (install: npm i openid-client).
 * Configure via env:
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *   SALESFORCE_DOMAIN, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET
 *   SSO_REDIRECT_BASE (e.g. https://api.fieldforce.app)
 *
 * Provider URLs:
 *   Azure:      https://login.microsoftonline.com/{tenant}/v2.0
 *   Salesforce: https://login.salesforce.com (or custom domain)
 */
const logger = require('../utils/logger');

const PROVIDERS = {
  azure: {
    issuerUrl: () => `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/v2.0`,
    clientId: () => process.env.AZURE_CLIENT_ID,
    clientSecret: () => process.env.AZURE_CLIENT_SECRET,
    scope: 'openid profile email',
  },
  salesforce: {
    issuerUrl: () => `https://${process.env.SALESFORCE_DOMAIN || 'login.salesforce.com'}`,
    clientId: () => process.env.SALESFORCE_CLIENT_ID,
    clientSecret: () => process.env.SALESFORCE_CLIENT_SECRET,
    scope: 'openid profile email',
  },
};

const clientCache = {};

async function getClient(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unknown SSO provider: ${provider}`);
  if (!cfg.clientId() || !cfg.clientSecret()) {
    throw new Error(`SSO provider "${provider}" not configured — set client ID/secret in env`);
  }
  if (clientCache[provider]) return clientCache[provider];

  const { Issuer } = require('openid-client');
  const issuer = await Issuer.discover(cfg.issuerUrl());
  const redirectBase = process.env.SSO_REDIRECT_BASE || 'http://localhost:4000';
  const client = new issuer.Client({
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    redirect_uris: [`${redirectBase}/api/v1/auth/sso/${provider}/callback`],
    response_types: ['code'],
  });
  clientCache[provider] = { client, scope: cfg.scope };
  return clientCache[provider];
}

function isConfigured(provider) {
  const cfg = PROVIDERS[provider];
  return !!(cfg && cfg.clientId() && cfg.clientSecret());
}

function listConfigured() {
  return Object.keys(PROVIDERS).filter(isConfigured);
}

module.exports = { getClient, isConfigured, listConfigured, PROVIDERS };
