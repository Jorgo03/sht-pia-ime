# Plani i publikimit: Shtëpia.ime, nga sot deri në App Store dhe Google Play

Përditësuar më 2026-10-24. Kjo është lista që ndjekim **bashkë**, hap pas hapi. Shëno `[x]` sa
mbaron një hap, ose më thuaj "hapi X u krye" dhe e shënoj unë.

Çdo hap ka këto pjesë:

- **Çfarë**: veprimi konkret.
- **Pse**: çfarë zgjidh.
- **Kush**: *ti* / *unë* / *bashkë*.
- **Kosto**: vendos çmim vetëm kur e kam lexuar në faqen zyrtare. Ndryshe shkruaj "shiko
  çmimin", sepse nuk dua të shpik shifra.
- **Gati kur**: si e dimë që hapi mbaroi.

Hollësitë teknike për çdo llogari janë te `docs/ACCOUNT_AND_RELEASE_HANDOFF.md`. Këtu është
rendi dhe "si-ja".

---

## Ku jemi sot

- Aplikacioni funksionon në Expo Go dhe ndërtohet për iOS dhe Android.
- Ndryshimet e fundit janë në GitHub dhe CI është i gjelbër:
  - fotot e listimit dhe të profilit;
  - butoni "U krye";
  - rreshti i çmimit;
  - politika e privatësisë.
- **Mungojnë vetëm gjërat që kërkojnë llogaritë, pagesat ose telefonin tënd.** Ana inxhinierike
  për versionin e parë është gati.
- **Pagesat** janë ndërtuar në faqen web (`/pricing`, Paysera), por janë **të fikura**.

> **Rregulli i rendit:** versioni 1.0 del në dyqane **pa pagesa**. Postimi është falas, siç e ke
> vendosur (DECISIONS.md M1). Pagesat i ndezim në versionin 1.1, pasi aplikacioni të jetë
> pranuar. Kështu shmangim shkakun më të shpeshtë të refuzimit nga Apple, rregullat e pagesave
> (shiko Fazën 9), dhe nuk vonojmë publikimin.

---

## Faza 0: Katër vendime (KRYER 2026-10-24)

- [x] **0.1 Publikuesi:** **person.**
  - Nuk duhet D-U-N-S, dhe në dyqan del emri yt.
  - Te Google duhet **testi i mbyllur me 12 testues për 14 ditë**. Shiko "Rruga kritike" më
    poshtë.
- [x] **0.2 Domain-i:** do e blesh tani (Faza 2). Emrin e zgjedhim bashkë te hapi 2.1.
- [x] **0.3 Platformat:** iPhone dhe Android bashkë.
- [x] **0.4 Pagesat:** te versioni 1.1. Versioni 1.0 del falas.

### Rruga kritike (çfarë e vendos datën e publikimit)

Si llogari personale, Google nuk të lejon të publikosh para se **12 testues** të kenë qenë në
testin e mbyllur **14 ditë rresht**. Ftesat nuk mjaftojnë: llogaritet vetëm kush e ka pranuar
testin. Prandaj Android-i ecën i pari:

1. Llogaria Expo (3.4) dhe Google Play Console (3.3).
2. Build-i i parë Android (5.1).
3. Testi i mbyllur me 12 testues. **Dita 1 e 14 ditëve.**
4. Gjatë atyre 14 ditëve bëjmë gjithçka tjetër: domain, email, Apple, iPhone, faqen në dyqan.

Për testin mjafton lidhja e privatësisë në faqen e sotme. Domain-i i ri mund të vijë më vonë.

**Fillo sot të mbledhësh 12 njerëz me telefon Android**, p.sh. agjentë, miq ose familjarë. Më
duhen adresat e tyre Gmail për listën e testuesve. Ato i fut ti në Play Console, jo në chat.

---

## Faza 1: Provo ndryshimet e fundit në telefon (sot, 30 minuta, falas)

Çfarë provon në telefon:

- [x] **1.1 Hap aplikacionin në Expo Go.** U krye 2026-10-24, pas ngritjes në SDK 58.
  - Në kompjuterin tënd, te dosja e projektit:

    ```
    git pull origin master
    npm install
    npm start
    ```

  - Hapet faqja me kodin QR. Skanoje me Expo Go (Android) ose me kamerën (iPhone).
  - Kompjuteri dhe telefoni duhet të jenë në të njëjtin Wi-Fi.
    - Ose përdor `npm run expo:tunnel:qr`.
    - Ose lidhe kompjuterin me hotspot-in e telefonit.
  - Unë nuk mund ta nis serverin nga këtu: ambienti im në cloud nuk arrin dot telefonin tënd.
- [x] **1.2 Listim i ri me 2 foto të reja nga kamera e iPhone-it.** U krye: publikimi punon.
  - Hapat: Publiko → shfaqet te "Listimet e mia" → hape → ndrysho çmimin → ruaj.
- [x] **1.3 Ruaj një draft**, mbyll aplikacionin, rihape. Drafti duhet të jetë aty. U krye 2026-10-24.
- [x] **1.4 Fotoja e profilit:** vendose, pastaj zëvendësoje me një tjetër. U krye: fotoja ndryshon.
- [x] **1.5 "U krye":** u krye 2026-10-24 (iPhone). Kërkesa: duhet të dalë te përshkrimi (shumë rreshta), te çmimi (numra) dhe te
  mesazhet.
  - Shtypja e butonit mbyll tastierën dhe teksti mbetet.
- [ ] **1.6 E njëjta provë në Android**, nëse ke një telefon Android.

**Gati kur:** asnjë mesazh gabimi. Nëse del ndonjë, më dërgo një screenshot, pa numra telefoni
ose të dhëna personale, dhe e rregulloj.

---

## Faza 2: Domain, email dhe dërgimi i kodeve (java 1)

Kjo rregullon regjistrimin me email. Sot kodi me email u shkon vetëm anëtarëve të ekipit të
Supabase, jo publikut.

- [ ] **2.1 Bli domain-in.**
  - **Kush:** ti.
  - **Kosto:** shiko çmimin te regjistruesi.
  - **Gati kur:** domain-i shfaqet në llogarinë tënde.
- [ ] **2.2 Lidhe domain-in me Vercel.**
  - **Kush:** bashkë. Ti hap Vercel → Settings → Domains, unë të them saktë cilat rekorde DNS të
    vendosësh.
  - **Gati kur:** faqja hapet në `https://domaini-yt` me drynin e sigurisë.
- [ ] **2.3 Krijo kutinë postare** `kontakt@domaini-yt`.
  - **Kush:** ti.
  - **Pse:** Apple kërkon kontakt publik. Vendoset te Privatësia dhe Kushtet.
- [ ] **2.4 Hap një llogari te një shërbim emaili (SMTP)**, p.sh. Resend, Brevo ose Postmark.
  - **Kush:** ti.
  - **Kosto:** shiko planin falas dhe çmimin.
  - Verifikon domain-in duke shtuar rekordet SPF/DKIM që të jep shërbimi; të ndihmoj unë.
- [ ] **2.5 Vendos të dhënat SMTP te Supabase** → Authentication → SMTP.
  - **Kush:** ti. Fjalëkalimin **mos ma shkruaj në chat**.
  - Pastaj ngjit 4 shabllonet e emailit nga `supabase/templates/`; të them cilin ku.
- [ ] **2.6 Unë:**
  - vendos adresën e kontaktit dhe domain-in në aplikacion dhe në faqe;
  - përditësoj adresat e kthimit për Google Sign-In;
  - rregulloj kufirin e emaileve.
- [ ] **2.7 Prova:** regjistrohu me një email që s'është përdorur kurrë.
  - **Gati kur:** kodi 6-shifror vjen brenda një minute dhe rivendosja e fjalëkalimit punon.

---

## Faza 3: Llogaritë e dyqaneve (java 1, paralelisht me Fazën 2)

- [x] **3.1 D-U-N-S:** nuk duhet, sepse publikon si person.
- [ ] **3.2 Apple Developer Program.**
  - **Kush:** ti.
  - **Kosto:** **99 USD në vit** (faqja zyrtare e Apple; çmimi mund të ndryshojë sipas vendit).
  - **Gati kur:** hyn te App Store Connect.
- [ ] **3.3 Google Play Console** (bëje **të parën**, sepse është rruga kritike).
  - **Kush:** ti.
  - **Kosto:** **25 USD, një herë** (faqja e ndihmës së Google).
  - **Gati kur:** hyn te Play Console dhe identiteti është verifikuar.
- [ ] **3.4 Llogari Expo** (falas).
  - **Kush:** ti krijon llogarinë.
  - Pastaj **bashkë** ekzekutojmë `npx expo login` në kompjuterin tënd.
  - **Gati kur:** projekti shfaqet në expo.dev.

---

## Faza 4: Google Cloud dhe Firebase (java 2)

- [ ] **4.1 Ekrani i lejes së Google** (OAuth consent).
  - **Kush:** bashkë.
  - Vendosim:
    - emrin "Shtëpia.ime";
    - logon;
    - email-in e kontaktit;
    - lidhjet e Privatësisë dhe Kushteve në domain-in e ri.
  - **Gati kur:** hyrja me Google shkruan "Shtëpia.ime".
- [ ] **4.2 Çelësi i hartës për Android** (Maps SDK for Android).
  - **Kush:** ti, me mua në krah.
  - **Kosto:** kërkon faturim në Google Cloud; shiko kufijtë falas.
  - E kufizojmë vetëm për aplikacionin tonë dhe e ruajmë te EAS, **jo** në kod dhe jo në chat.
  - **Gati kur:** harta del në build-in Android.
- [ ] **4.3 Projekt Firebase për njoftimet në Android.**
  - **Kush:** bashkë.
  - Çelësin e ngarkon ti te EAS.
  - **Gati kur:** vjen një njoftim prove.
- [ ] **4.4 Sign in with Apple.**
  - **Kush:** bashkë: ti te Apple dhe Supabase, unë të them çfarë të shkruash.

---

## Faza 5: Build-et e para dhe testimi në telefon (java 2–3)

Këtu aplikacioni bëhet aplikacion i vërtetë dhe nuk ka më nevojë për Expo Go.

- [ ] **5.1 Unë:** `eas init`, kredencialet, dhe build-i i parë **preview** për Android dhe iOS.
  - Ky build përfshin versionin e ri të mjetit të fotove, që rregullon fotot HDR edhe vetë.
- [ ] **5.2 iPhone:** e instalon nga **TestFlight**.
- [ ] **5.3 Android:** e instalon nga **Internal testing** te Play Console.
- [ ] **5.4 Kalojmë bashkë listën `docs/DEVICE_CHECKLIST.md`**, pikë për pikë:
  - hyrja: email, Google, Apple;
  - listimet dhe fotot;
  - mesazhet dhe vizitat;
  - njoftimet;
  - harta;
  - raportimi dhe bllokimi;
  - fshirja e llogarisë.
- [ ] **5.5 Rregulloj çdo gabim** që del dhe bëj build të ri. Përsërisim derisa lista të jetë e
  pastër.
- [ ] **5.5b Ngarkimi i parë në Google Play bëhet me dorë.**
  - Google nuk lejon që EAS ta ngarkojë vetë aplikacionin e parë.
  - Unë të jap skedarin `.aab` nga build-i, ti e ngarkon te Play Console → Testing → Closed
    testing → Create release.
  - Nga versioni i dytë e ngarkoj unë me `eas submit`.
- [ ] **5.6 Nis testin e mbyllur me 12 testues për 14 ditë** (detyrim për llogarinë tënde
  personale).
  - Unë të them saktë ku klikohet te Play Console → Testing → Closed testing.
  - Gjej 12 njerëz me Android, p.sh. agjentë që njeh.
  - 14 ditët ecin paralelisht me Fazat 6 dhe 7.

**Gati kur:** lista e pajisjes kalon në të dy platformat.

---

## Faza 6: Faqja në dyqan (java 3)

Draftet e gatshme janë te `docs/STORE_LISTING_DRAFTS.md`.

- [ ] **6.1 Teksti:**
  - emri;
  - nëntitulli;
  - përshkrimi në shqip dhe anglisht;
  - fjalët kyçe.

  **Kush:** unë shkruaj, ti miraton.
- [ ] **6.2 Screenshot-et.**
  - **Kush:** bashkë.
  - I bëjmë nga build-i i vërtetë, me listime reale, **pa të dhëna personale**.
  - Duhen madhësitë për iPhone dhe Android, plus "feature graphic" për Google.
- [ ] **6.3 Etiketa e privatësisë te Apple dhe "Data safety" te Google.**
  - **Kush:** bashkë. Përgjigjet i kam gati; i mbush ti duke i lexuar me mua.
- [ ] **6.4 Llogaria për shqyrtuesin.**
  - **Kush:** bashkë.
  - Një llogari prove që Apple dhe Google ta hapin aplikacionin, me një shënim ku janë Raporto,
    Blloko dhe Fshi llogarinë.
- [ ] **6.5 Lidhjet e Privatësisë dhe Kushteve** në domain-in e ri.
  - **Kush:** unë i kontrolloj.

---

## Faza 7: Infrastruktura para publikimit (java 3)

- [ ] **7.1 Supabase Pro.**
  - **Kush:** ti.
  - **Kosto:** shiko çmimin në supabase.com/pricing.
  - **Pse:**
    - kopje rezervë çdo ditë;
    - projekti nuk "fle" pas 7 ditësh pa përdorim;
    - mbrojtja nga fjalëkalimet e rrjedhura.
  - Pas kësaj **unë** ndez mbrojtjen dhe kontrolloj kopjen e parë rezervë.
- [ ] **7.2 Vercel Pro**, sepse plani falas nuk lejon përdorim tregtar.
  - **Kush:** ti.
  - **Kosto:** shiko çmimin.
- [ ] **7.3 Kufiri i shpenzimeve te Anthropic** (AI).
  - **Kush:** ti. Vendos një kufi mujor në konsolë.
- [ ] **7.4 Dy konfirmime në Supabase:** fshirja e 2 llogarive të testit.
  - **Kush:** ti klikon miratimin, unë e nis.

---

## Faza 8: Dërgimi për shqyrtim dhe publikimi i versionit 1.0 (java 3–4)

- [ ] **8.1 Unë:** build-i **production** dhe dërgimi (`eas submit`) te Apple dhe Google.
- [ ] **8.2 Ti:** shtyp "Submit for Review" te App Store Connect dhe "Send for review" te Play
  Console.
- [ ] **8.3 Presim shqyrtimin.**
  - Apple shkruan se shumica e aplikacioneve shqyrtohen brenda një dite.
  - Google mund të zgjasë disa ditë për një llogari të re.
- [ ] **8.4 Nëse refuzohet:** më dërgo mesazhin e plotë. E rregulloj dhe e ridërgojmë.
- [ ] **8.5 Publikimi.**
  - **Gati kur:** aplikacioni gjendet në kërkimin e App Store dhe Google Play.

---

## Faza 9: Pagesat (versioni 1.1, pas publikimit)

Këtu duhet kujdes. Rregullat e lexuara më 2026-10-24:

- **Apple, rregulli 3.1.1:** çdo gjë që zhbllokon veçori brenda aplikacionit duhet blerë me
  in-app purchase të Apple-it.
- **Apple, rregulli 3.1.3(b):** blerjet në faqen web lejohen të përdoren në aplikacion **vetëm
  nëse të njëjtat ofrohen edhe si in-app purchase**.
- **Apple, jashtë SHBA-së:** aplikacioni nuk mund të ketë butona ose lidhje që të çojnë te pagesa
  në web.
- **Google:** një aplikacion që nuk shet asgjë brenda tij mund të tregojë, pa lidhje, se blerja
  bëhet në web. Brenda aplikacionit duhet Google Play Billing.

Pra plani i mëparshëm, "shitje vetëm në web", është **i sigurt te Google por i rrezikshëm te
Apple**. Ka tri rrugë:

| Rruga | Si funksionon | Pro | Kundër |
|---|---|---|---|
| **A. Web + in-app purchase** (rekomandimi im) | Agjenti mund të paguajë në web me Paysera/bankë, **ose** brenda aplikacionit me Apple/Google | Në rregull me të dy dyqanet; agjentët paguajnë ku duan | Apple/Google mbajnë komision për blerjet brenda aplikacionit (shiko përqindjen aktuale te programi i tyre për bizneset e vogla); kërkon pak më shumë punë nga ana ime |
| **B. Vetëm web** | Siç është ndërtuar sot | Pa komision | Rrezik refuzimi te Apple sapo planet të ndikojnë në aplikacion |
| **C. Vetëm in-app purchase** | Pagesa vetëm brenda aplikacioneve | Më e thjeshta për rregullat | Komision për çdo pagesë; s'ka pagesë bankare/faturë për agjencitë |

Hapat, pasi të zgjedhësh rrugën:

- [ ] **9.1 Ti:** zgjidh rrugën A, B ose C.
  - Nëse ke dyshime për ligjin e vendit, pyet një avokat. Unë të përgatis pyetjet.
- [ ] **9.2 Ti:** vendos çmimet:
  - promovimi i një listimi: sa ditë, sa lekë/euro;
  - planet mujore të agjencive: 1, 3, 6 ose 12 muaj;
  - kufiri i listimeve dhe kreditet e promovimit për secilin plan.
- [ ] **9.3 Ti:** hap llogarinë e tregtarit.
  - **Paysera:** ajo që është ndërtuar.
  - **Ose raiAccept** (Raiffeisen), nëse Paysera nuk pranon FHO-në në Shqipëri.
  - Pyeti:
    - (a) a pranojnë lekë/Shqipëri?
    - (b) a kanë pagesa të përsëritura?
- [ ] **9.4 Ti:** miraton 2 migrimet e pritura në Supabase (`supabase/pending/`).
  - **Unë:** vendos funksionet `checkout-start` dhe `paysera-callback` në modalitetin **test**.
- [ ] **9.5 Bashkë:** një pagesë prove në sandbox.
  - **Gati kur:**
    - plani ndizet **vetëm** pas konfirmimit të nënshkruar të Paysera-s;
    - një konfirmim i dyfishtë nuk ndryshon asgjë.
- [ ] **9.6 Vetëm për rrugën A ose C, unë ndërtoj in-app purchase:**
  - produktet te App Store Connect dhe Play Console;
  - verifikimi te serveri;
  - teste te sandbox-i i Apple dhe Google.
- [ ] **9.7 Bashkë:** ndezim pagesat (`VITE_CHECKOUT_ENABLED=true`), bëjmë një pagesë të vërtetë
  të vogël dhe e kthejmë (refund).
- [ ] **9.8 Unë:** versioni 1.1 me pagesat dhe dërgimi për shqyrtim.
  - Shënimi për shqyrtuesin shpjegon si funksionojnë pagesat.

---

## Faza 10: Pas publikimit (çdo javë)

- [ ] **10.1 Njoftimet me email për kërkimet e ruajtura.**
  - **Kush:** bashkë. I ndezim pasi SMTP-ja të punojë.
- [ ] **10.2 Moderatorët.**
  - **Kush:** ti më jep llogaritë, unë i shtoj.
- [ ] **10.3 Kontrolli i gabimeve dhe raportimeve** të përdoruesve.
  - **Kush:** unë, kur më thua "kontrollo".
- [ ] **10.4 Expo.** Kur del një version i ri i Expo Go, aplikacioni duhet përditësuar (shiko
  CLAUDE.md). Unë të njoftoj.
- [ ] **10.5 Faqja e re web.** E dizajnon ti më vonë (vendimi W2). Faqja e sotme mbetet në punë
  deri atëherë.

---

## Përmbledhje e kostove të njohura

| Çfarë | Kosto | Burimi |
|---|---|---|
| Apple Developer | 99 USD / vit | developer.apple.com (lexuar 2026-10-21) |
| Google Play | 25 USD një herë | faqja e ndihmës së Google (përmes kërkimit) |
| Expo | falas për build-et e para | expo.dev/pricing (përmes kërkimit) |
| D-U-N-S | falas për Apple | faqja e regjistrimit të Apple |

Domain-in, SMTP-në, Supabase Pro, Vercel Pro, Google Cloud dhe Paysera **shiko t'i kontrollosh
para se të paguash**. Nuk i kam verifikuar dhe nuk dua të të jap shifra të gabuara.

## Çfarë nuk mund ta bëj unë

Nuk blej asgjë, nuk pranoj kushte në emrin tënd, nuk shoh fjalëkalime ose karta, dhe nuk shtyp
"publiko" në dyqane. Këto i bën ti, ndërsa unë të them saktë çfarë të klikosh dhe kontrolloj
rezultatin.

---

## Shtojca A: Mesazhi për 12 testuesit (kopjoje dhe dërgoje)

> Përshëndetje! Po nxjerr aplikacionin tim **Shtëpia.ime**, për shtëpi në shitje dhe me qira në
> Shqipëri. Google kërkon që 12 persona ta provojnë 14 ditë para se të dalë në Play Store. A më
> ndihmon?
>
> 1. Më dërgo adresën Gmail që përdor në telefonin Android.
> 2. Kur të vijë lidhja nga unë, hape në telefon, shtyp **"Become a tester"** dhe instalo
>    aplikacionin nga Play Store.
> 3. **Mos e çinstalo për 14 ditë.** Hape herë pas here dhe më shkruaj nëse diçka nuk punon.
>
> Faleminderit!

Shënime:

- Llogaritet vetëm kush shtyp "Become a tester", jo kush merr ftesën. Fto 15–16 veta, që të kesh
  rezervë.
- Adresat i fut ti te Play Console → Testing → Closed testing → Testers. **Mos m'i dërgo në
  chat.**

## Shtojca B: Testi i mbyllur te Play Console (pasi të kemi build-in e parë)

1. Play Console → **Create app**.
   - Emri: `Shtëpia.ime`.
   - Gjuha kryesore: shqip.
   - App, Free.
   - Prano deklaratat.
2. **Testing → Closed testing → Create track.**
   - Emri: p.sh. `testuesit`.
3. **Testers:**
   - krijo një listë email-esh dhe fut adresat;
   - kopjo **lidhjen e ftesës** ("Join on Android") dhe dërgoja testuesve.
4. **Create release:**
   - ngarko `.aab`-në që të jap unë;
   - shënimet e versionit (unë t'i shkruaj);
   - **Review release → Start rollout**.
5. Plotëso **App content**. Përgjigjet e gatshme janë te `docs/STORE_LISTING_DRAFTS.md`:
   - privacy policy;
   - app access;
   - ads: jo;
   - content rating;
   - target audience;
   - data safety.

   Mund ta bëjmë bashkë, ekran pas ekrani.
6. Numëro: Play Console → Closed testing tregon sa testues kanë pranuar.
   - **Dita 1 e 14-ës nis kur të jenë 12 të pranuar.**
7. Pas 14 ditësh: **Apply for production**. Google bën disa pyetje për testin, dhe përgjigjet i
   përgatisim bashkë.

## Shtojca C: Shënimet e versionit për testin e mbyllur (kopjoji te "Release notes")

Google i kërkon këto shënime brenda etiketave të gjuhës. Kopjo të dy bllokat:

```
<sq-AL>
Versioni i parë për testim. Kërko shtëpi në shitje dhe me qira në të gjithë Shqipërinë, ruaj të preferuarat, shkruaji agjentit dhe cakto vizita. Agjentët mund të publikojnë listime me foto. Na shkruaj nëse diçka nuk punon.
</sq-AL>
<en-US>
First test version. Search homes for sale and rent across Albania, save favourites, message agents and book viewings. Agents can publish listings with photos. Tell us if anything does not work.
</en-US>
```

