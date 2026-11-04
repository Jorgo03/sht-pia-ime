export declare const FORM_LIMITS: {
  readonly listingTitle: number;
  readonly listingDescription: number;
  readonly listingAddress: number;
  readonly city: number;
  readonly message: number;
  readonly viewingNotes: number;
  readonly wantedNotes: number;
  readonly savedSearchName: number;
  readonly email: number;
  readonly maxPrice: number;
  readonly maxBedrooms: number;
};
export declare function isValidEmail(value: unknown): boolean;
export declare function inIntRange(value: unknown, min: number, max: number): boolean;
