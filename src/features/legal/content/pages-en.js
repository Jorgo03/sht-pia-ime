// English texts for the cookies page and the buying-from-abroad guide,
// re-exported by en.js. Albanian versions in pages-sq.js.

// Cookies and browser storage on the website. Matches the code: the site sets
// no advertising or tracking cookies; sign-in and settings live in the
// browser's own storage (localStorage) and are needed for the site to work.
export const cookies = {
  intro: [
    'This page explains what Shtëpia.ime stores in your browser when you use the website. We use no advertising, analytics or tracking cookies, so there is nothing to opt out of.',
  ],
  sections: [
    {
      h: '1. What we store',
      ul: [
        "Your sign-in session, so you stay signed in between visits. Our authentication provider (Supabase) keeps it in your browser's storage, not in a cookie.",
        'Your settings: language, light or dark theme, and the currency prices are shown in.',
        'Things you do on this device: recently viewed listings, homes picked for comparison, listing drafts and whether you closed a notice.',
      ],
      p2: ['All of this is strictly necessary for the site to work as you asked, so it needs no consent. None of it is shared with advertisers.'],
    },
    {
      h: '2. Other services',
      p: [
        'Maps are drawn from OpenStreetMap tiles, and photos come from our storage provider. Loading them sends your IP address to those servers, as any web page does; they do not set cookies for us.',
      ],
    },
    {
      h: '3. How to remove it',
      p: [
        "Sign out to end your session. To remove everything, clear this site's data in your browser settings. The site keeps working; you will just need to sign in and choose your settings again.",
      ],
    },
    { h: '4. Contact', contact: true },
  ],
}

// Buying from abroad: general guidance for the diaspora. Not legal or tax
// advice, and it says so; every legal step points to a licensed professional.
export const guide = {
  intro: [
    'Many people buy a home in Albania while living in Italy, Greece, Germany, the UK, the USA or elsewhere. This guide gives an overview of the usual steps, so you know what to ask. It is general information, not legal or tax advice: rules change, and every purchase is different. Always use a licensed Albanian lawyer and notary for the legal steps.',
  ],
  sections: [
    {
      h: '1. Find and compare',
      ul: [
        'Search by city and zone, save the search, and turn on alerts so new listings reach you wherever you are.',
        'Post a "wanted home" with your budget and area: agents and owners can then come to you.',
        'Compare up to three homes side by side, and ask for more photos, a video call or a floor plan before you travel.',
      ],
    },
    {
      h: '2. Check the property',
      ul: [
        "Ask for the ownership certificate (certifikata e pronësisë) issued by the State Cadastre Agency (ASHK), and have your lawyer check it is current and in the seller's name.",
        'Ask your lawyer to check for mortgages, liens, disputes or unpaid bills on the property.',
        'For new buildings, ask for the building permit and the occupancy permit, and check what is included in the price.',
        'If you cannot visit, ask someone you trust or an independent professional to see it for you.',
      ],
    },
    {
      h: '3. Agree and sign',
      ul: [
        'Agree the price and conditions in writing. A preliminary contract and a deposit are common; your lawyer should read it before you sign.',
        'The final sale contract is signed before an Albanian notary. If you cannot be there, you can give someone a notarised power of attorney (prokurë); ask the notary which form and legalisation (apostille) your country needs.',
        'Pay through a bank, never in cash, and keep every receipt.',
      ],
    },
    {
      h: '4. After the purchase',
      ul: [
        'The notary or your lawyer registers the sale with the State Cadastre Agency, which issues the new ownership certificate in your name.',
        'Ask a tax adviser about taxes and fees in Albania and in the country where you live.',
      ],
    },
    {
      h: '5. Stay safe',
      ul: [
        'Never send money before your own lawyer has checked the documents.',
        'Keep conversations in the app, so you have a record, and report any listing that seems wrong.',
        'Be careful with prices far below the market and with anyone who rushes you.',
      ],
    },
    { h: '6. Contact', contact: true },
  ],
}
