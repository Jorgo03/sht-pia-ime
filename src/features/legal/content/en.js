// English legal texts. Albanian (sq.js) is the governing version; every other
// app language shows this English text with a note (legal.languageNote).
// Facts here are checked against the code and the live database, 2026-10-14:
// update this file whenever a processor, a data field or a retention period
// changes. Not legal advice; have a lawyer review before relying on it.

export const UPDATED = '2026-10-14'

export const privacy = {
  intro: [
    'This policy explains what personal data Shtëpia.ime collects when you use our website and mobile apps, why, who it is shared with, and the rights you have. We wrote it to match what the app actually does.',
  ],
  sections: [
    {
      h: '1. What we collect',
      ul: [
        'Account: your email address and password (stored by our authentication provider only as a secure hash), or, if you sign in with Google or Apple, the name, email and profile picture they share with us.',
        'Profile: your name, role (client or agent), agency name, phone number, profile photo and preferred language, as far as you provide them.',
        'Listings you publish: property details, price, address and map location, photos, video link, and the contact phone, email or WhatsApp option you choose to show.',
        'Activity: favourites, saved searches, "wanted home" requests, viewing requests, messages with other users, and inquiries sent to agents.',
        'Listing statistics: when someone views a listing or taps to call, message or WhatsApp its lister, we record that event against the listing so its lister can see how it performs.',
        'Location: only if you tap the "near me" button on the map. Your browser or phone shares your position to centre the map; we do not store it.',
        'Data kept on your device: your sign-in session, theme, language, recently viewed listings, listing drafts and whether you dismissed the cookie notice. We use no advertising or tracking cookies.',
        'Payments (when paid features launch): we record which plan or promotion you bought, its status and dates. Card details are entered on the payment provider\'s page and never reach us.',
      ],
    },
    {
      h: '2. How we use it',
      ul: [
        'To run the service: create your account, publish and show listings, connect buyers and renters with owners and agents, and deliver messages and viewing requests.',
        'To translate listings automatically into the app\'s languages and, if you ask, to help write a listing or understand a search typed in plain words.',
        'To show listers statistics about their own listings.',
        'To keep the service safe: prevent fraud, spam and abuse, and enforce our Terms.',
        'To meet legal obligations.',
      ],
      p: ['We do not sell your personal data and we do not use it for third-party advertising.'],
    },
    {
      h: '3. Legal bases',
      p: [
        'We process your data to perform our contract with you (providing the service), for our legitimate interests (keeping the service secure and improving it), with your consent where we ask for it (for example your location on the map), and to comply with the law.',
      ],
    },
    {
      h: '4. What other people can see',
      p: [
        'Listings are public: anyone can see a listing\'s details, photos, location and the contact details you chose to show on it. Agent profiles (name, agency, phone and photo) are public. Messages are visible only to the people in the conversation.',
      ],
    },
    {
      h: '5. Who we share it with',
      p: ['We use the following service providers, who process data on our behalf and only for these purposes:'],
      ul: [
        'Supabase: database, sign-in and file storage. Data is stored in the European Union (Frankfurt, Germany).',
        'Vercel: hosting of the website.',
        'Anthropic: AI features. Listing text is sent to it for automatic translation, for listing-writing help, and search text you type in plain words is sent to it to turn into filters.',
        'MyMemory (Translated): backup translation of listing text when the AI translation is unavailable.',
        'OpenStreetMap: map images, and address search when you type an address. These requests include your IP address and the address text.',
        'Google and Apple: only if you choose to sign in with them.',
        'WhatsApp: only when you tap to contact a lister on WhatsApp; the conversation then happens in WhatsApp under its own policy.',
        'A payment provider, once paid features launch, to process payments.',
      ],
      p2: [
        'Some of these providers are located outside Albania and the EU, for example in the United States. Where that happens, transfers are protected by the safeguards the law requires, such as the European Commission\'s standard contractual clauses. We may also disclose data where the law requires it.',
      ],
    },
    {
      h: '6. How long we keep it',
      ul: [
        'Account, profile, listings, favourites, searches and messages: as long as your account exists.',
        'Listing statistics: up to 400 days.',
        'Payment records: as long as tax and accounting law requires.',
        'When you delete your account, the data above is erased, except what we must keep by law. Copies in our providers\' backups expire on their normal backup schedule.',
      ],
    },
    {
      h: '7. Deleting your account',
      p: [
        'You can delete your account at any time in the app under Profile → Delete account. This permanently deletes your profile, the listings you own and their photos, your favourites, saved searches, wanted-home requests, viewing requests and messages.',
      ],
    },
    {
      h: '8. Your rights',
      p: [
        'You have the right to access your data, correct it, delete it, restrict or object to its processing, receive it in a portable format, and withdraw any consent you gave. Much of this you can do yourself in the app. You can also complain to the Information and Data Protection Commissioner of Albania (idp.al), or to the data protection authority of your EU country.',
      ],
    },
    {
      h: '9. Children',
      p: ['Shtëpia.ime is meant for adults. You must be at least 18 to create an account.'],
    },
    {
      h: '10. Security',
      p: [
        'Data is encrypted in transit, access to it is limited by role-based rules in the database, and passwords are never stored in readable form. No system is perfectly secure, so please use a strong, unique password.',
      ],
    },
    {
      h: '11. Changes to this policy',
      p: ['If we change this policy, we will update the date at the top and, for significant changes, tell you in the app.'],
    },
    {
      h: '12. Contact',
      contact: true,
    },
  ],
}

export const terms = {
  intro: [
    'These terms govern your use of Shtëpia.ime\'s website and mobile apps. By creating an account or using the service, you accept them.',
  ],
  sections: [
    {
      h: '1. Who we are',
      p: ['Shtëpia.ime is operated by Future Home Orange ("FHO", "we", "us"), a company registered in the Republic of Albania.'],
    },
    {
      h: '2. What Shtëpia.ime is',
      p: [
        'Shtëpia.ime is a marketplace where owners and real-estate agents publish properties for sale or rent, and buyers and renters find them. We are not a party to any sale or rental, we are not a real-estate agent or broker, and we do not verify ownership or the legal status of any property. Before you pay or sign anything, verify the property and its owner yourself, for example with the State Cadastre Agency (ASHK).',
      ],
    },
    {
      h: '3. Your account',
      ul: [
        'You must be at least 18 and give accurate information.',
        'Choose the agent role only if you work as a real-estate agent or for an agency.',
        'Keep your password safe. You are responsible for what happens under your account.',
      ],
    },
    {
      h: '4. Listings',
      p: ['If you publish a listing, you confirm that:'],
      ul: [
        'you own the property or are authorised to advertise it;',
        'the details, price, location and photos are accurate and current, and you will remove the listing once it is sold or rented;',
        'you have the rights to every photo and video you upload.',
      ],
      p2: [
        'Not allowed: fake or duplicate listings, misleading prices, properties you are not authorised to advertise, discriminatory content, other people\'s personal data, and anything illegal. We may edit, hide or remove listings and suspend accounts that break these terms.',
      ],
    },
    {
      h: '5. Your content',
      p: [
        'You keep ownership of what you upload. You give FHO a non-exclusive, royalty-free licence to host, display, resize and translate it in order to run and promote the service, for as long as it is on Shtëpia.ime.',
      ],
    },
    {
      h: '6. Automatic translations and AI help',
      p: [
        'Listings are translated automatically, and AI can help you write a listing or understand your search. These texts can contain mistakes. The lister remains responsible for the listing; the original-language text prevails.',
      ],
    },
    {
      h: '7. Messages and contact',
      p: ['Use messages, calls and WhatsApp only to discuss listings. No spam, harassment or unsolicited advertising.'],
    },
    {
      h: '8. Paid features',
      ul: [
        'Publishing a listing is free.',
        'We offer paid listing promotions and monthly agency plans. Prices, what each includes and the period (1, 3, 6 or 12 months) are shown before you pay.',
        'A promotion runs for the period you bought and then ends; it does not renew.',
        'An agency plan renews automatically at the end of each period until you cancel. You can cancel at any time; the plan stays active until the end of the period already paid.',
        'Purchases are made on our website through our payment provider. Refunds follow applicable law.',
      ],
    },
    {
      h: '9. What you may not do',
      p: [
        'Do not copy listings or data from Shtëpia.ime in bulk (scraping), try to get around its security, interfere with it, impersonate someone else, or use it for any unlawful purpose.',
      ],
    },
    {
      h: '10. Liability',
      p: [
        'Listings are published by users, and we do not guarantee that they are accurate, available or lawful. The service is provided "as is". To the extent the law allows, FHO is not liable for losses arising from listings, from dealings between users, or from the service being unavailable. Nothing in these terms limits rights you have as a consumer under the law.',
      ],
    },
    {
      h: '11. Ending your use',
      p: ['You can stop using Shtëpia.ime and delete your account at any time. We may suspend or close accounts that break these terms.'],
    },
    {
      h: '12. Law and disputes',
      p: ['These terms are governed by the law of the Republic of Albania. Disputes go to the competent courts of Tirana, without affecting any consumer protection that applies to you.'],
    },
    {
      h: '13. Changes',
      p: ['If we change these terms, we will update the date at the top and, for significant changes, tell you in the app. Continuing to use the service means you accept the updated terms.'],
    },
    {
      h: '14. Contact',
      contact: true,
    },
  ],
}

export const contact = {
  withEmail: 'Questions about this document or your data: ',
  withoutEmail: 'You can see, correct and delete your data yourself in the app, under Profile.',
}
