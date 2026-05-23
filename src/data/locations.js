const LOCATIONS = [
  {
    city: 'Tiranë',
    zones: [
      'Blloku', 'Liqeni i Thatë', 'Myslym Shyri', 'Selvia', 'Ali Dem',
      'Komuna e Parisit', 'Sauk', 'Lunder', '21 Dhjetori', 'Yzberisht',
      'Rruga e Kavajës', 'Pazari i Ri', 'Don Bosko', 'Tirana e Re', 'Kombinat',
      'Laprakë', 'Astir', 'Fresk', 'Kinostudio', 'Medreseja',
      'Porcelan', 'Shkozë', 'Bathore', 'Kashar', 'Farkë',
      'Shëngjergj', 'Petrelë', 'Vaqarr', 'Zall-Herr', 'Pezë',
      'Kodër-Kamëz', 'Paskuqan', 'Babrru', 'Vorë', 'Maminas',
    ],
  },
  {
    city: 'Durrës',
    zones: [
      'Plazh', 'Shkëmbi i Kavajës', 'Kënetë', 'Spitallë', 'Arapaj',
      'Currila', 'Plepa', 'Shkallnur', 'Romanat', 'Fllakë',
      'Bisht-Kamëz', 'Rrashbull', 'Porto Romano', 'Mali i Robit',
      'Qerret', 'Golem', 'Iliria', 'Përmet i Durrësit',
    ],
  },
  {
    city: 'Vlorë',
    zones: [
      'Lungomare', 'Uji i Ftohtë', 'Skelë', 'Radhimë', 'Orikum',
      'Zvërnec', 'Kanina', 'Tragjas', 'Novosejë', 'Vlorë Qendër',
      'Shushicë', 'Dukat', 'Palasë', 'Dhërmi', 'Jalë',
    ],
  },
  {
    city: 'Shkodër',
    zones: [
      'Qendër', 'Rus', 'Perash', 'Dobraç', 'Shirokë',
      'Zogaj', 'Koplik', 'Boga', 'Theth', 'Razëm',
      'Bahçallek', 'Rrethi i Ri', 'Parrucë', 'Gjuhadol', 'Serreq',
    ],
  },
  {
    city: 'Elbasan',
    zones: [
      'Qendër', 'Partizani', '5 Maji', '11 Nëntori', 'Kala',
      'Zaranikë', 'Bradashesh', 'Shirgjan', 'Labinot-Fushë', 'Labinot-Mal',
      'Paper', 'Gracën', 'Tregan', 'Shushicë',
    ],
  },
  {
    city: 'Fier',
    zones: [
      'Qendër', 'Apolloni', 'Liri', 'Sheq i Madh', 'Sheq i Vogël',
      'Levan', 'Cakran', 'Dërmenas', 'Topojë', 'Mbrostar',
      'Portëz', 'Frakull', 'Libofshë', 'Hysgjokaj',
    ],
  },
  {
    city: 'Korçë',
    zones: [
      'Qendër', 'Pazari i Ri', 'Pazari i Vjetër', 'Bulevardi Fan Noli',
      'Bulevardi Republika', '10 Korriku', 'Liqeni i Korçës', 'Voskopojë',
      'Dardha', 'Boboshticë', 'Drenovë', 'Mborje', 'Pojan',
    ],
  },
  {
    city: 'Berat',
    zones: [
      'Mangalem', 'Goricë', 'Kala', 'Qendër', 'Uznove',
      'Dorez', 'Roshnik', 'Sinjë', 'Otllak', 'Velabisht',
      'Ura Vajgurore', 'Poshnjë', 'Kutalli',
    ],
  },
  {
    city: 'Lushnjë',
    zones: [
      'Qendër', 'Divjakë', 'Fier-Shegan', 'Karbunarë', 'Golem',
      'Kolonjë', 'Ballagat', 'Bubullimë', 'Greth', 'Hysgjokaj',
    ],
  },
  {
    city: 'Pogradec',
    zones: [
      'Qendër', 'Liqeni', 'Tushemisht', 'Drilon', 'Lin',
      'Çërravë', 'Buçimas', 'Hudënisht', 'Guri i Kuq', 'Verdovë',
    ],
  },
  {
    city: 'Kavajë',
    zones: [
      'Qendër', 'Golem', 'Qerret', 'Mali i Robit', 'Spille',
      'Helmës', 'Luz i Vogël', 'Synej', 'Rrogozhinë',
    ],
  },
  {
    city: 'Lezhë',
    zones: [
      'Qendër', 'Kala', 'Shëngjin', 'Ishull-Lezhë', 'Balldren',
      'Blinisht', 'Kallmet', 'Kolsh', 'Zejmen', 'Ungrej',
    ],
  },
  {
    city: 'Gjirokastër',
    zones: [
      'Kala', 'Qendër', 'Pazari i Vjetër', 'Dunavat', 'Antigonë',
      'Lazarat', 'Lunxhëri', 'Dropull', 'Cepo', 'Labovë',
      'Hormovë', 'Kakavijë', 'Mashkullorë',
    ],
  },
  {
    city: 'Sarandë',
    zones: [
      'Qendër', 'Lungomare', 'Mango', 'Ksamil', 'Butrint',
      'Çukë', 'Lukovë', 'Kakome', 'Himara Jugor', 'Konispol',
    ],
  },
  {
    city: 'Kukës',
    zones: [
      'Qendër', 'Kukës i Ri', 'Kukës i Vjetër', 'Kolsh', 'Shtiqën',
      'Bicaj', 'Shishtavec', 'Surroj', 'Zapod', 'Tërthorë',
    ],
  },
  {
    city: 'Peshkopi',
    zones: [
      'Qendër', 'Maqellarë', 'Melan', 'Tomin', 'Luzni',
      'Selishtë', 'Kastriot', 'Sllovë', 'Radomirë',
    ],
  },
  {
    city: 'Krujë',
    zones: [
      'Qendër', 'Kala', 'Pazari i Vjetër', 'Fushë-Krujë', 'Nikël',
      'Bubq', 'Cudhi', 'Sarisalltik', 'Zgërdhesh',
    ],
  },
  {
    city: 'Laç',
    zones: [
      'Qendër', 'Mamurras', 'Milot', 'Fushë-Kuqe', 'Sanxhak',
      'Kakarriq', 'Troshan', 'Delbnisht',
    ],
  },
  {
    city: 'Burrel',
    zones: [
      'Qendër', 'Suç', 'Baz', 'Macukull', 'Ulëz',
      'Klos', 'Martanesh', 'Zerqan',
    ],
  },
  {
    city: 'Bulqizë',
    zones: [
      'Qendër', 'Shupenzë', 'Homesh', 'Ostren',
      'Martanesh', 'Zerqan', 'Fushë-Bulqizë',
    ],
  },
  {
    city: 'Gramsh',
    zones: [
      'Qendër', 'Kodovjat', 'Poroçan', 'Skënderbegas',
      'Kushovë', 'Lënie', 'Sult',
    ],
  },
  {
    city: 'Librazhd',
    zones: [
      'Qendër', 'Steblevë', 'Hotolisht', 'Lunik',
      'Orenjë', 'Qukës', 'Prrenjas',
    ],
  },
  {
    city: 'Tepelenë',
    zones: [
      'Qendër', 'Memaliaj', 'Këlcyrë', 'Luftinjë',
      'Lopës', 'Bënçë', 'Krahës',
    ],
  },
  {
    city: 'Përmet',
    zones: [
      'Qendër', 'Këlcyrë', 'Petran', 'Çarçovë',
      'Ballaban', 'Piskovë', 'Frashër',
    ],
  },
  {
    city: 'Ersekë',
    zones: [
      'Qendër', 'Leskovik', 'Barmash', 'Mollas',
      'Novoselë', 'Çlirim', 'Rehova',
    ],
  },
  {
    city: 'Kuçovë',
    zones: [
      'Qendër', 'Perondi', 'Kozarë', 'Lumas',
      'Visokë', 'Hajdaraj',
    ],
  },
  {
    city: 'Çorovodë',
    zones: [
      'Qendër', 'Polican', 'Bogovë', 'Leshnjë',
      'Çepan', 'Zhepë', 'Tomorr',
    ],
  },
  {
    city: 'Peqin',
    zones: [
      'Qendër', 'Pajovë', 'Gjocaj', 'Karinë', 'Shezë',
    ],
  },
  {
    city: 'Himarë',
    zones: [
      'Qendër', 'Dhërmi', 'Jalë', 'Livadhi', 'Palasë',
      'Llamani', 'Vuno', 'Ilias', 'Qeparo', 'Borsh',
    ],
  },
  {
    city: 'Pukë',
    zones: [
      'Qendër', 'Fushë-Arrëz', 'Qelëz', 'Iballë', 'Gjegjan',
    ],
  },
  {
    city: 'Rrogozhinë',
    zones: [
      'Qendër', 'Kryevidh', 'Sinaballaj', 'Shezë', 'Lekaj',
    ],
  },
]

export default LOCATIONS
