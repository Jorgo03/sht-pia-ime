// Types for publisher.js, so the phone app (TypeScript) can import it.
export type PublisherKind = 'agent' | 'client';
export interface PublisherRow {
  kind: PublisherKind;
  full_name: string | null;
  phone: string | null;
  agency_name: string | null;
}
export interface PublisherView {
  kind: PublisherKind;
  name: string | null;
  phone: string | null;
  office: string | null;
}
export function fetchPublisher(client: unknown, propertyId: string): Promise<PublisherRow | null>;
export function publisherView(
  row: PublisherRow | null | undefined,
  property:
    | {
        agent?: { full_name?: string | null; phone?: string | null; agency_name?: string | null } | null;
        contact_phone?: string | null;
        owner_type?: string | null;
      }
    | null
    | undefined,
): PublisherView;
