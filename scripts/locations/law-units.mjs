// The 373 administrative units (njësi administrative) of Law 115/2014, by
// municipality, exactly as listed in the table on
// https://en.wikipedia.org/wiki/Municipalities_of_Albania (oldid 1377087644,
// read 2026-11-14; its totals row: 61 municipalities, 373 units).
// build-dataset.mjs compares this list with OpenStreetMap's units.
const LIST = `
Belsh: Belsh, Fierzë, Grekan, Kajan, Rrasë
Berat: Berat, Otllak, Roshnik, Sinjë, Velabisht
Bulqizë: Bulqizë, Fushë-Bulqizë, Gjoricë, Martanesh, Ostren, Shupenzë, Trebisht, Zerqan
Cërrik: Cërrik, Gostimë, Klos, Mollas, Shalës
Delvinë: Delvinë, Vergo
Devoll: Bilisht, Hoçisht, Miras, Progër, Qendër Bilisht
Dibër: Arras, Fushë-Çidhën, Kala e Dodës, Kastriot, Lurë, Luzni, Maqellarë, Melan, Muhurr, Peshkopi, Selishtë, Sllovë, Tomin, Zall-Dardhë, Zall-Reç
Dimal: Cukalat, Dimal, Kutalli, Poshnjë
Divjakë: Divjakë, Grabian, Gradishtë, Remas, Tërbuf
Dropull: Dropull i Poshtëm, Dropull i Sipërm, Pogon
Durrës: Durrës, Ishëm, Katund i Ri, Manëz, Rrashbull, Sukth
Elbasan: Bradashesh, Elbasan, Funarë, Gjergjan, Gjinar, Gracen, Labinot-Fushë, Labinot-Mal, Papër, Shirgjan, Shushicë, Tregan, Zavalinë
Fier: Cakran, Dërmenas, Fier, Frakull, Levan, Libofshë, Mbrostar Ura, Portëz, Qendër, Topojë
Finiq: Aliko, Dhivër, Finiq, Livadhja, Mesopotam
Fushë-Arrëz: Blerim, Fierzë, Fushë-Arrëz, Iballë, Qafë-Mali
Gjirokastër: Antigonë, Cepo, Gjirokastër, Lazarat, Lunxhëri, Odrie, Picar
Gramsh: Gramsh, Kodovjat, Kukur, Kushovë, Lenie, Pishaj, Poroçan, Skënderbegas, Sult, Tunjë
Has: Fajzë, Gjinaj, Golaj, Krumë
Himarë: Himarë, Horë-Vranisht, Lukovë
Kamëz: Kamëz, Paskuqan
Kavajë: Golem, Helmas, Kavajë, Luz i Vogël, Synej
Këlcyrë: Ballaban, Dishnicë, Këlcyrë, Sukë
Klos: Gurrë, Klos, Suç, Xibër
Kolonjë: Barmash, Çlirim, Ersekë, Leskovik, Mollas, Novoselë, Qendër Ersekë, Qendër Leskovik
Konispol: Konispol, Markat, Xarrë
Korçë: Drenovë, Korçë, Lekas, Mollaj, Qendër Bulgarec, Vithkuq, Voskop, Voskopojë
Krujë: Bubq, Cudhi, Fushë-Krujë, Krujë, Nikël, Kodër-Thumanë
Kuçovë: Kozare, Kuçovë, Lumas, Perondi
Kukës: Arrën, Bicaj, Bushtricë, Grykë-Çajë, Kalis, Kolsh, Kukës, Malzi, Shishtavec, Shtiqën, Surroj, Tërthore, Topojan, Ujëmisht, Zapod
Kurbin: Fushë Kuqe, Laç, Mamurras, Milot
Lezhë: Balldren, Blinisht, Dajç, Kallmet, Kolsh, Lezhë, Shëngjin, Shënkoll, Ungrej, Zejmen
Libohovë: Libohovë, Qendër Libohovë, Zagori
Librazhd: Hotolisht, Librazhd, Lunik, Orenjë, Polis, Qendër Librazhd, Stëblevë
Lushnjë: Allkaj, Ballagat, Bubullimë, Dushk, Fier-Shegan, Golem, Hysgjokaj, Karbunarë, Kolonjë, Krutje, Lushnjë
Malësi e Madhe: Gruemirë, Kastrat, Kelmend, Koplik, Qendër, Shkrel
Maliq: Gorë, Libonik, Maliq, Moglicë, Pirg, Pojan, Vreshtas
Mallakastër: Aranitas, Ballsh, Fratar, Greshicë, Hekal, Kutë, Ngraçan, Qendër Dukas, Selitë
Mat: Baz, Burrel, Derjan, Komsi, Lis, Macukull, Rukaj, Ulëz
Memaliaj: Buz, Krahës, Luftinjë, Memaliaj, Memaliaj Fshat, Qesarat
Mirditë: Fan, Kaçinar, Kthellë, Orosh, Rrëshen, Rubik, Selitë
Patos: Patos, Ruzhdie, Zharrëz
Peqin: Gjoçaj, Karinë, Pajovë, Peqin, Përparim, Shezë
Përmet: Çarçovë, Frashër, Përmet, Petran, Qendër Piskovë
Pogradec: Buçimas, Çërravë, Dardhas, Pogradec, Proptisht, Trebinjë, Udenisht, Velçan
Poliçan: Poliçan, Tërpan, Vërtop
Prrenjas: Prrenjas, Qukës, Rrajcë, Stravaj
Pukë: Gjegjan, Pukë, Qelëz, Qerret, Rrapë
Pustec: Pustec
Roskovec: Kuman, Kurjan, Roskovec, Strum
Rrogozhinë: Gosë, Kryevidh, Lekaj, Rrogozhinë, Sinaballaj
Sarandë: Ksamil, Sarandë
Selenicë: Armen, Brataj, Kotë, Selenicë, Sevaster, Vllahinë
Shijak: Gjepalaj, Maminas, Shijak, Xhafzotaj
Shkodër: Ana e Malit, Bërdicë, Dajç, Guri i Zi, Postribë, Pult, Rrethinat, Shalë, Shkodër, Shosh, Velipojë
Skrapar: Bogovë, Çepan, Çorovodë, Gjerbës, Leshnjë, Potom, Qendër Skrapar, Vendreshë, Zhepë
Tepelenë: Kurvelesh, Lopës, Qendër Tepelenë, Tepelenë
Tiranë: Baldushk, Bërzhitë, Dajt, Farkë, Kashar, Krrabë, Ndroq, Petrelë, Pezë, Shëngjergj, Tiranë, Vaqarr, Zall-Bastar, Zall-Herr
Tropojë: Bajram Curri, Bujan, Bytyç, Fierzë, Lekbibaj, Llugaj, Margegaj, Tropojë
Vau i Dejës: Bushat, Hajmel, Shllak, Temal, Vau i Dejës, Vig-Mnelë
Vlorë: Novoselë, Orikum, Qendër Vlorë, Shushicë, Vlorë
Vorë: Bërxullë, Prezë, Vorë
`

export const LAW_UNITS = Object.fromEntries(
  LIST.trim().split('\n').map((line) => {
    const [bashki, units] = line.split(': ')
    return [bashki, units.split(', ')]
  }),
)
