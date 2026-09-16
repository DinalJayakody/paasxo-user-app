import { ENDPOINTS } from '../api/endpoints';

// Served by com.pasxo.controller.LegalController - public, no auth required.
// Functions, not frozen constants - ENDPOINTS.BASE_URL is mutated in place
// once axios.ts's resolvePreferredBaseUrl() finishes probing Hostinger vs.
// local (see endpoints.ts), so reading it eagerly at module-import time would
// freeze these URLs to whatever the default was before that probe completes.
export const getPrivacyPolicyUrl = () => `${ENDPOINTS.BASE_URL}/privacy`;
export const getTermsOfServiceUrl = () => `${ENDPOINTS.BASE_URL}/terms`;
