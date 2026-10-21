import { LegalDocument } from '@/components/legal/legal-document';

// Privacy Policy. Public, no sign-in: the app stores and Google's OAuth
// verification fetch this page on the website.
export default function PrivacyScreen() {
  return <LegalDocument doc="privacy" />;
}
