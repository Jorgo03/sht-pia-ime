// Shape of the legal texts in en.js / sq.js, so the phone app (TypeScript)
// can render the same documents as the website.
export interface LegalSection {
  h: string;
  p?: string[];
  ul?: string[];
  p2?: string[];
  contact?: boolean;
}
export interface LegalDocument {
  intro: string[];
  sections: LegalSection[];
}
export interface LegalContact {
  withEmail: string;
  withoutEmail: string;
}
