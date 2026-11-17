export declare const PRIVATE_ROUTES: readonly string[];
export declare function isPrivatePath(pathname: string | null | undefined): boolean;
export declare function localizedUrl(site: string, pathname: string, lang?: string | null): string;
export declare function languageLinks(
  site: string,
  pathname: string,
  lang: string,
): { canonical: string; alternates: { hreflang: string; href: string }[] };
export declare function languageFromSearch(search: string | null | undefined): string | null;
