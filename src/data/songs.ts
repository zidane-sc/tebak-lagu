export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: "Galau Hits" | "Nostalgia 2000s" | "Anthem Tongkrongan" | "Pop Jawa & Koplo" | "Western Hits";
  startSecond?: number;
  youtubeId?: string;
  albumCover?: string;
  lyricsClues: string[];
  hummingMelody: Array<{ note: number; duration: number }>;
  searchQuery: string;
  previewFallback?: string;
}

export const CATEGORIES = [
  "Semua Genre",
  "Galau Hits",
  "Nostalgia 2000s",
  "Anthem Tongkrongan",
  "Pop Jawa & Koplo",
  "Western Hits",
] as const;

export const SONGS_CATALOG: Song[] = [
  {
    "id": "bernadya-kata-mereka",
    "title": "Kata Mereka Ini Berlebihan",
    "artist": "Bernadya",
    "year": 2024,
    "category": "Galau Hits",
    "startSecond": 50,
    "youtubeId": "Q9hXv-B2XW0",
    "lyricsClues": [
      "Ku tak pernah ikat rambutku lagi semenjak kau bilang\nRambutku indah bila terurai panjang",
      "Baju hitamku tak pernah ku pakai lagi sejak hari itu\nKau bilang warna gelap buatku terlihat sendu",
      "Kini kau pergi dan ku tak tahu harus bagaimana\nSemua tentang diriku kau bawa serta"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.5
      },
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "bernadya kata mereka ini berlebihan",
    "previewFallback": "https://cdnt-preview.dzcdn.net/api/1/1/c/e/0/0/ce0c8e91e3e131947ce01fb5752ada6e.mp3"
  },
  {
    "id": "bernadya-satu-bulan",
    "title": "Satu Bulan",
    "artist": "Bernadya",
    "year": 2024,
    "category": "Galau Hits",
    "startSecond": 65,
    "youtubeId": "cK1bH0q6yM0",
    "lyricsClues": [
      "Belum ada satu bulan semenjak kita selesai\nKudengar kau sudah ada yang baru",
      "Mungkinkah secepat itu kau lupa denganku\nAtau kau memang tak pernah sungguh-sungguh",
      "Apakah secepat itu kau temukan pengganti\nYang mampu buatmu tertawa lagi"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "bernadya satu bulan"
  },
  {
    "id": "sal-priadi-dari-planet-lain",
    "title": "Dari Planet Lain",
    "artist": "Sal Priadi",
    "year": 2024,
    "category": "Galau Hits",
    "startSecond": 45,
    "lyricsClues": [
      "Sepertinya kau memang dari planet yang lain\nDikirim ke bumi untuk orang-orang sepertiku",
      "Yang selalu merasa sepi di tengah keramaian\nYang tak pernah paham cara mencintai diri sendiri",
      "Melihat caramu menatap dan tersenyum padaku\nMembuat duniaku yang hancur kembali utuh"
    ],
    "hummingMelody": [
      {
        "note": 261,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.6
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "sal priadi dari planet lain"
  },
  {
    "id": "sal-priadi-gala-bunga-matahari",
    "title": "Gala Bunga Matahari",
    "artist": "Sal Priadi",
    "year": 2024,
    "category": "Galau Hits",
    "startSecond": 60,
    "lyricsClues": [
      "Mungkinkah kau ada di sana\nMendengarkan semua cerita yang belum sempat kusampaikan",
      "Bila kau rindu, datanglah lewat mimpi\nBiar ku peluk walau sekejap saja",
      "Tenanglah di sana bunga matahariku\nDoaku akan selalu menyertaimu"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "sal priadi gala bunga matahari"
  },
  {
    "id": "nadin-rayuan-perempuan-gila",
    "title": "Rayuan Perempuan Gila",
    "artist": "Nadin Amizah",
    "year": 2023,
    "category": "Galau Hits",
    "startSecond": 55,
    "lyricsClues": [
      "Menurutmu apa yang bisa ku banggakan\nHatiku yang patah atau jiwaku yang lelah",
      "Menurutmu mengapa kau masih di sini\nMenemaniku yang tak pernah merasa cukup",
      "Jangan datang bila hanya ingin singgah\nAku lelah dipermainkan harapan yang patah"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.6
      },
      {
        "note": 247,
        "duration": 0.8
      }
    ],
    "searchQuery": "nadin amizah rayuan perempuan gila"
  },
  {
    "id": "nadin-bertaut",
    "title": "Bertaut",
    "artist": "Nadin Amizah",
    "year": 2020,
    "category": "Galau Hits",
    "startSecond": 70,
    "lyricsClues": [
      "Bun, hidup berjalan seperti bajingan\nSeperti landak yang nekat naik pohon",
      "Aku masih ada di sini bersamamu\nMenghabiskan waktu dengan cerita lama",
      "Keras kepalaku sama denganmu\nCara kita tertawa juga persis sama"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "nadin amizah bertaut"
  },
  {
    "id": "tulus-hati-hati-di-jalan",
    "title": "Hati-Hati di Jalan",
    "artist": "Tulus",
    "year": 2022,
    "category": "Galau Hits",
    "startSecond": 75,
    "lyricsClues": [
      "Perjalanan membawamu bertemu denganku\nKu bertemu kamu",
      "Sepertimu yang ku cari, konon aku juga seperti yang kau cari\nKukira kita akan bersama, begitu banyak yang sama",
      "Hati-hati di jalan, mungkin bukan kita takdirnya\nKukira kita asam dan garam yang bertemu di belanga"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "tulus hati-hati di jalan"
  },
  {
    "id": "tulus-monokrom",
    "title": "Monokrom",
    "artist": "Tulus",
    "year": 2016,
    "category": "Galau Hits",
    "startSecond": 65,
    "lyricsClues": [
      "Lembaran foto hitam putih aku coba ingat kembali\nWarna-warni masa lalu yang penuh tawa",
      "Di mana pun kalian berada kukirimkan terima kasih\nUntuk cinta yang pernah kalian bagi",
      "Kalianlah bagian terindah dari perjalanan ini\nYang takkan pernah pudar terhapus waktu"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "tulus monokrom"
  },
  {
    "id": "mahalini-sial",
    "title": "Sial",
    "artist": "Mahalini",
    "year": 2023,
    "category": "Galau Hits",
    "startSecond": 68,
    "lyricsClues": [
      "Sial-sialnya ku bertemu dengan cinta semu\nTertipu tutur dan tatapmu",
      "Seolah kau yang paling mencintaiku\nBila ku tahu akan begini, takkan ku buka hati",
      "Bagaimana caraku melupakan bayangmu\nYang terlanjur mengakar di lubuk kalbuku"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "mahalini sial"
  },
  {
    "id": "mahalini-sisa-rasa",
    "title": "Sisa Rasa",
    "artist": "Mahalini",
    "year": 2021,
    "category": "Galau Hits",
    "startSecond": 70,
    "lyricsClues": [
      "Mengapa masih ada sisa rasa di dada\nSaat bayangmu hadir di tengah sepi malam",
      "Telah kucoba melupakan segalanya\nNamun rindu ini semakin mendera jiwa",
      "Tuhan sampaikan padanya ku masih mencintainya\nWalau raganya kini tak lagi bersamaku"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "mahalini sisa rasa"
  },
  {
    "id": "lyodra-pesan-terakhir",
    "title": "Pesan Terakhir",
    "artist": "Lyodra",
    "year": 2021,
    "category": "Galau Hits",
    "startSecond": 80,
    "lyricsClues": [
      "T'lah kucoba terus bertahan\nMendampingi setiap langkahmu",
      "Namun bila hatimu bukan untukku\nBiar ku simpan rasa ini dalam doa",
      "Genggam tanganku untuk yang terakhir kali\nSebelum kau pergi bersama pilihan hatimu"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.8
      }
    ],
    "searchQuery": "lyodra pesan terakhir"
  },
  {
    "id": "tiara-merasa-indah",
    "title": "Merasa Indah",
    "artist": "Tiara Andini",
    "year": 2021,
    "category": "Galau Hits",
    "startSecond": 65,
    "lyricsClues": [
      "Sempat kau hadirkan rasa yang begitu indah\nMembuatku yakin kau tercipta untukku",
      "Tapi mengapa di akhir semua cerita\nBukan aku yang kau pilih bersamamu",
      "Bila ku tahu ini akhirnya ku terluka\nTakkan kubiarkan hatiku jatuh terlalu dalam"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 440,
        "duration": 0.8
      }
    ],
    "searchQuery": "tiara andini merasa indah"
  },
  {
    "id": "keisya-tak-ingin-usai",
    "title": "Tak Ingin Usai",
    "artist": "Keisya Levronka",
    "year": 2022,
    "category": "Galau Hits",
    "startSecond": 72,
    "lyricsClues": [
      "Berdiri ku di sini menanti sebuah jawaban\nYang tak kunjung datang dari bibir manismu",
      "Jujur ku tak ingin usai cerita tentang kita\nMeski kutahu kau t'lah melangkah jauh di sana",
      "Terlalu banyak kenangan yang terukir di benak\nTak semudah itu kuhapus begitu saja"
    ],
    "hummingMelody": [
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 587,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.8
      }
    ],
    "searchQuery": "keisya levronka tak ingin usai"
  },
  {
    "id": "juicy-luicy-lantas",
    "title": "Lantas",
    "artist": "Juicy Luicy",
    "year": 2020,
    "category": "Galau Hits",
    "startSecond": 58,
    "lyricsClues": [
      "Lantas mengapa ku masih menaruh hati\nPadahal kutahu kau telah bersamanya",
      "Bodohnya aku selalu ada di sini\nMenjadi tempat pelarian saat kau terluka",
      "Bila kau bahagia bersamanya ku kan mundur\nMeski perih harus kuterima kenyataan ini"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "juicy luicy lantas"
  },
  {
    "id": "juicy-luicy-tampar",
    "title": "Tampar",
    "artist": "Juicy Luicy",
    "year": 2022,
    "category": "Galau Hits",
    "startSecond": 50,
    "lyricsClues": [
      "Tampar pipiku sadarkan aku dari mimpi\nBahwa kau takkan pernah kumiliki",
      "Berharap pada yang tak pasti menyiksa diri\nCukup sudah ku bermain dengan ilusi",
      "Biar rasa sakit ini menyadarkan logika\nCinta sepihak takkan pernah ada ujungnya"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "juicy luicy tampar"
  },
  {
    "id": "hindia-evaluasi",
    "title": "Evaluasi",
    "artist": "Hindia",
    "year": 2019,
    "category": "Galau Hits",
    "startSecond": 45,
    "lyricsClues": [
      "Yang tak ku mengerti mengapa semua menuntut\nHarus sempurna tanpa cela di mata mereka",
      "Bilas muka gosok gigimu dan evaluasi\nMasalah hidup takkan selesai dalam semalam",
      "Tidurlah kawan esok kita hadapi lagi\nJangan biarkan dirimu binasa oleh ambisi"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.35
      },
      {
        "note": 370,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "hindia evaluasi"
  },
  {
    "id": "hindia-rumah-ke-rumah",
    "title": "Rumah ke Rumah",
    "artist": "Hindia",
    "year": 2019,
    "category": "Galau Hits",
    "startSecond": 60,
    "lyricsClues": [
      "Menepis bayangmu dari tiap sudut kota\nBerpindah dari satu hati ke hati yang lain",
      "Mencari tempat berlabuh yang tak kunjung jumpa\nHingga lelah raga dan jiwa ini melangkah",
      "Terima kasih telah mengajarkanku arti pulang\nMeski akhirnya rumah itu bukan milikku"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.5
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "hindia rumah ke rumah"
  },
  {
    "id": "anggi-marito-tak-seindah-mimpi",
    "title": "Tak Segampang Itu",
    "artist": "Anggi Marito",
    "year": 2023,
    "category": "Galau Hits",
    "startSecond": 70,
    "lyricsClues": [
      "Tak segampang itu ku mencari penggantimu\nTak semudah itu ku melupakan kenanganmu",
      "Setiap sudut kota mengingatkanku padamu\nBahkan harum angin malam tercium namamu",
      "Bila esok ku harus melangkah tanpamu\nIzinkan ku peluk bayangmu dalam hening"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.5
      },
      {
        "note": 349,
        "duration": 0.8
      }
    ],
    "searchQuery": "anggi marito tak segampang itu"
  },
  {
    "id": "dewa-kangen",
    "title": "Kangen",
    "artist": "Dewa 19",
    "year": 1992,
    "category": "Nostalgia 2000s",
    "startSecond": 70,
    "lyricsClues": [
      "Kuterima suratmu, telah kubaca dan aku mengerti\nBetapa merindunya dirimu akan hadirnya diriku",
      "Di dalam hari-harimu bersama lagi\nSemua kata rindumu semakin membuatku tak berdaya",
      "Menahan rasa ingin jumpa denganmu kasih\nWalau lewat mimpi kuharap kita kan bersatu"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.5
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 330,
        "duration": 0.6
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "dewa 19 kangen",
    "previewFallback": "https://cdnt-preview.dzcdn.net/api/1/1/4/0/0/0/400351ef1ceb22260c6998e53b8c8582.mp3"
  },
  {
    "id": "dewa-separuh-nafas",
    "title": "Separuh Nafas",
    "artist": "Dewa 19",
    "year": 2000,
    "category": "Nostalgia 2000s",
    "startSecond": 45,
    "lyricsClues": [
      "Separuh nafasku terbang bersama dirimu\nSaat kau tinggalkanku salahkanku",
      "Salahkah aku bila ku bukanlah seperti\nAku yang dahulu kau cintai sepenuh hati",
      "Kini ku terhempas dalam sunyinya malam\nTanpa ada dirimu pelita di kegelapan"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "dewa 19 separuh nafas"
  },
  {
    "id": "dewa-risalah-hati",
    "title": "Risalah Hati",
    "artist": "Dewa 19",
    "year": 2000,
    "category": "Nostalgia 2000s",
    "startSecond": 60,
    "lyricsClues": [
      "Aku bisa membuatmu jatuh cinta kepadaku\nMeski kau tak pernah mencintaiku",
      "Beri sedikit waktu biar cinta datang\nKarena telah terbiasa",
      "Simpan rasa ragumu dalam lubuk hatimu\nBiar cinta membuktikan ketulusan janjiku"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.35
      },
      {
        "note": 330,
        "duration": 0.35
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.35
      },
      {
        "note": 330,
        "duration": 0.35
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "dewa 19 risalah hati"
  },
  {
    "id": "dewa-pupus",
    "title": "Pupus",
    "artist": "Dewa 19",
    "year": 2002,
    "category": "Nostalgia 2000s",
    "startSecond": 75,
    "lyricsClues": [
      "Aku cinta kau lebih dari yang kau tahu\nMeski kau takkan pernah tahu",
      "Aku persembahkan hidupku untukmu\nTelah kurelakan hatiku untuk kau hancurkan",
      "Baru kusadari cintaku bertepuk sebelah tangan\nKau buat remuk redam segenap perasaanku"
    ],
    "hummingMelody": [
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "dewa 19 pupus"
  },
  {
    "id": "dewa-roman-picisan",
    "title": "Roman Picisan",
    "artist": "Dewa 19",
    "year": 2000,
    "category": "Nostalgia 2000s",
    "startSecond": 65,
    "lyricsClues": [
      "Malam-malamku bagai malam seribu bintang\nYang terbentang di angkasa luas",
      "Cintaku takkan pernah lekang oleh waktu\nWalau terhalang gunung dan samudera",
      "Tatap matamu panahkan seribu pesona\nMembuatku takluk di pelukan asmara"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "dewa 19 roman picisan"
  },
  {
    "id": "sheila-dan",
    "title": "Dan",
    "artist": "Sheila On 7",
    "year": 1999,
    "category": "Nostalgia 2000s",
    "startSecond": 60,
    "lyricsClues": [
      "Dan bila esok datang kembali\nSeperti sedia kala di mana kau bisa bercanda",
      "Dan perlahan kaupun lupakan aku\nMendekap hati yang kau pilih",
      "Lupakanlah diriku bila itu bahagiamu\nBiarkan luka ini kutanggung sendiri"
    ],
    "hummingMelody": [
      {
        "note": 440,
        "duration": 0.6
      },
      {
        "note": 440,
        "duration": 0.3
      },
      {
        "note": 494,
        "duration": 0.3
      },
      {
        "note": 523,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.3
      },
      {
        "note": 440,
        "duration": 0.3
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "sheila on 7 dan",
    "previewFallback": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/91/97/95/919795f5-ef85-3e28-a6d1-4e427702e8e9/mzaf_6717521759600122995.plus.aac.p.m4a"
  },
  {
    "id": "sheila-sephia",
    "title": "Sephia",
    "artist": "Sheila On 7",
    "year": 2000,
    "category": "Nostalgia 2000s",
    "startSecond": 65,
    "lyricsClues": [
      "Hei Sephia, malam ini ku takkan datang\nPetunjuk jalanmu yang mulai hilang",
      "Jangan pernah kau harapkan aku untuk kembali\nLupakanlah diriku",
      "Kekasih gelapku yang setia menanti\nMaafkan bila kita harus berpisah di sini"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.5
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "sheila on 7 sephia"
  },
  {
    "id": "sheila-melompat-lebih-tinggi",
    "title": "Melompat Lebih Tinggi",
    "artist": "Sheila On 7",
    "year": 2003,
    "category": "Nostalgia 2000s",
    "startSecond": 50,
    "lyricsClues": [
      "Kita pernah sejalan berdua menatap masa depan\nDengan mimpi yang tak bertepi",
      "Kupetik bintang untuk kau simpan di hatimu\nBila kau jatuh ku ada di sampingmu",
      "Ayo bersama melompat lebih tinggi melintasi batas ragu\nDunia ada di tangan kita"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 523,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "sheila on 7 melompat lebih tinggi"
  },
  {
    "id": "sheila-sahabat-sejati",
    "title": "Sahabat Sejati",
    "artist": "Sheila On 7",
    "year": 2000,
    "category": "Nostalgia 2000s",
    "startSecond": 45,
    "lyricsClues": [
      "Pegang pundakku jangan pernah lepaskan\nBila malam datang mencekam jiwa",
      "Sahabat sejati takkan pernah terganti\nKita hadapi dunia bersama-sama",
      "Tertawa menangis berbagi cerita rahasia\nHingga rambut kita memutih bersama"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "sheila on 7 sahabat sejati"
  },
  {
    "id": "peterpan-mungkin-nanti",
    "title": "Mungkin Nanti",
    "artist": "Peterpan",
    "year": 2004,
    "category": "Nostalgia 2000s",
    "startSecond": 70,
    "lyricsClues": [
      "Saat hatiku bertanya-tanya\nMungkinkah kita 'kan s'lalu bersama",
      "Dan mungkin bila nanti kita 'kan bertemu lagi\nSatu pintaku jangan kau coba tanyakan kembali",
      "Rasa yang t'lah terkubur dalam sanubari\nBiarkan waktu yang menjawab semua misteri"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "noah mungkin nanti"
  },
  {
    "id": "peterpan-ada-apa-denganmu",
    "title": "Ada Apa Denganmu",
    "artist": "Peterpan",
    "year": 2004,
    "category": "Nostalgia 2000s",
    "startSecond": 65,
    "lyricsClues": [
      "Sudah maafkan aku segala salahku\nDan bila kau tetap bisu, diam memeluk seribu sesal",
      "Ada apa denganmu?\nHanya malam dapat meleburkan rasa",
      "Katakan sejujurnya apa yang kau rasa\nJangan biarkan curiga meracuni cinta kita"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 392,
        "duration": 0.3
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.5
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "peterpan ada apa denganmu"
  },
  {
    "id": "peterpan-menghapus-jejakmu",
    "title": "Menghapus Jejakmu",
    "artist": "Peterpan",
    "year": 2007,
    "category": "Nostalgia 2000s",
    "startSecond": 55,
    "lyricsClues": [
      "Kuterus melangkah melupakanmu\nLelah hati ini menahan rindu",
      "Engkau bukanlah segalaku\nBukan tempat tuk hentikan langkahku",
      "Biar ku hapus jejakmu dari anganku\nAkan kubuktikan ku bisa hidup tanpamu"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "peterpan menghapus jejakmu"
  },
  {
    "id": "peterpan-yang-terdalam",
    "title": "Yang Terdalam",
    "artist": "Peterpan",
    "year": 2003,
    "category": "Nostalgia 2000s",
    "startSecond": 60,
    "lyricsClues": [
      "Kulepas semua yang ku inginkan\nTak akan ku ulangi kembali",
      "Biar rasa ini tertidur lelap\nDi dalam lubuk hatiku yang terdalam",
      "Tatap matamu yang sayu kian menjauh\nMenyisakan perih yang tak berkesudahan"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "peterpan yang terdalam"
  },
  {
    "id": "samsons-kenangan-terindah",
    "title": "Kenangan Terindah",
    "artist": "Samsons",
    "year": 2006,
    "category": "Nostalgia 2000s",
    "startSecond": 75,
    "lyricsClues": [
      "Aku yang pernah terluka oleh cinta semu\nKini mencoba bertahan dalam bayangmu",
      "Bila yang tertulis untukku adalah melepaskanmu\nKan kuingat kau sebagai kenangan terindah",
      "Terima kasih atas segala cinta dan tawa\nYang sempat menghiasi lembar hidupku bersamamu"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.5
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "samsons kenangan terindah"
  },
  {
    "id": "ungu-demi-waktu",
    "title": "Demi Waktu",
    "artist": "Ungu",
    "year": 2005,
    "category": "Nostalgia 2000s",
    "startSecond": 70,
    "lyricsClues": [
      "Aku yang tak pernah bisa lupakan dirinya\nYang selalu hadir di setiap mimpiku",
      "Demi waktu yang bergulir dan berputar\nMaafkan aku menduakan cintamu",
      "Kuakui ku masih mencintai dirinya\nNamun ku tak mampu kehilanganmu kasih"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "ungu demi waktu"
  },
  {
    "id": "dmasiv-cinta-ini-membunuhku",
    "title": "Cinta Ini Membunuhku",
    "artist": "D'Masiv",
    "year": 2008,
    "category": "Nostalgia 2000s",
    "startSecond": 65,
    "lyricsClues": [
      "Kau membuat ku berantakan\nKau membuat ku tak karuan",
      "Kau membuat ku hancur tak berdaya\nCinta ini membunuhku perlahan",
      "Sampai kapankah kau gantungkan hatiku\nDalam penantian tanpa kepastian arah"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "dmasiv cinta ini membunuhku"
  },
  {
    "id": "padi-kasih-tak-sampai",
    "title": "Kasih Tak Sampai",
    "artist": "Padi",
    "year": 2001,
    "category": "Nostalgia 2000s",
    "startSecond": 80,
    "lyricsClues": [
      "Tetaplah menjadi bintang di langit malamku\nAgar ku tahu kau selalu ada di sana",
      "Meskipun cinta kita tak mungkin terwujud di dunia\nBiarlah abadi dalam bait lagu ini",
      "Menatap indah senyummu dari kejauhan\nSudah cukup menyejukkan dahaga jiwaku"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.5
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "padi kasih tak sampai"
  },
  {
    "id": "letto-ruang-rindu",
    "title": "Ruang Rindu",
    "artist": "Letto",
    "year": 2005,
    "category": "Nostalgia 2000s",
    "startSecond": 60,
    "lyricsClues": [
      "Di daun yang ikut mengalir lembut\nTerbawa sungai ke ujung samudera",
      "Ada rindu yang ku titipkan padamu\nBiar hembusan angin menyampaikan rasa",
      "Bila nanti kau merasa sepi sendiri\nIngatlah aku kan selalu menunggumu di sini"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "letto ruang rindu"
  },
  {
    "id": "ada-band-manusia-bodoh",
    "title": "Manusia Bodoh",
    "artist": "Ada Band",
    "year": 2004,
    "category": "Nostalgia 2000s",
    "startSecond": 75,
    "lyricsClues": [
      "Dahulu terasa indah semua janji manismu\nMembuatku terbuai dalam lamunan panjang",
      "Bodohnya diriku yang selalu memaafkanmu\nMeski berkali-kali kau sakiti hatiku",
      "Kini ku sadar ku harus lepaskan jeratanmu\nSebelum hidupku hancur tak bersisa"
    ],
    "hummingMelody": [
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 440,
        "duration": 0.8
      }
    ],
    "searchQuery": "ada band manusia bodoh"
  },
  {
    "id": "kerispatih-mengenangmu",
    "title": "Mengenangmu",
    "artist": "Kerispatih",
    "year": 2007,
    "category": "Nostalgia 2000s",
    "startSecond": 70,
    "lyricsClues": [
      "Bila harus ku jujur pada diriku sendiri\nTak ada yang mampu gantikan posisimu",
      "Mengenangmu membuat air mata ini menetes\nTeringat semua kenangan manis kita berdua",
      "Semoga kau bahagia dengan pilihan hatimu\nWalau harus kurelakan kau pergi jauh"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "kerispatih mengenangmu"
  },
  {
    "id": "a7x-dear-god",
    "title": "Dear God",
    "artist": "Avenged Sevenfold",
    "year": 2007,
    "category": "Anthem Tongkrongan",
    "startSecond": 72,
    "lyricsClues": [
      "A lonely road, crossed another cold state line\nMiles away from those I love, purpose hard to find",
      "Dear God, the only thing I ask of you is\nTo hold her when I'm not around, when I'm much too far away",
      "We all need that person who can be true to you\nI left her when I found her and now I wish I'd stayed"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.5
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "avenged sevenfold dear god"
  },
  {
    "id": "slank-ku-tak-bisa",
    "title": "Ku Tak Bisa",
    "artist": "Slank",
    "year": 2004,
    "category": "Anthem Tongkrongan",
    "startSecond": 65,
    "lyricsClues": [
      "Pernah berpikir 'tuk pergi dan terlintas tinggalkan kau sendiri\nSempat ingin sudahi sampai di sini",
      "Tapi ku tak bisa jauh, jauh darimu\nKu tak bisa jauh, jauh darimu",
      "Sabar, sabar aku menahan segala egoku\nDemi keutuhan cinta kita berdua"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "slank ku tak bisa"
  },
  {
    "id": "slank-terlalu-manis",
    "title": "Terlalu Manis",
    "artist": "Slank",
    "year": 1991,
    "category": "Anthem Tongkrongan",
    "startSecond": 60,
    "lyricsClues": [
      "Kuambil gitar dan mulai memainkan lagu lama\nYang biasa kita nyanyikan bersama",
      "Terlalu manis untuk dilupakan\nKenangan yang indah bersamamu tinggallah mimpi",
      "Malam dingin temani sepi di beranda\nKuhisap rokok dan mengenang senyummu"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "slank terlalu manis"
  },
  {
    "id": "iwan-fals-bento",
    "title": "Bento",
    "artist": "Iwan Fals",
    "year": 1989,
    "category": "Anthem Tongkrongan",
    "startSecond": 40,
    "lyricsClues": [
      "Namaku Bento, rumah real estate\nMobilku banyak, harta melimpah",
      "Orang memanggilku bos eksekutif\nTokoh papan atas, atas segalanya, asyik!",
      "Khotbah soal moral, omong keadilan\nSemuanya kubeli dengan uangku"
    ],
    "hummingMelody": [
      {
        "note": 294,
        "duration": 0.3
      },
      {
        "note": 294,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 294,
        "duration": 0.8
      }
    ],
    "searchQuery": "iwan fals bento"
  },
  {
    "id": "iwan-fals-surat-wakil-rakyat",
    "title": "Surat Buat Wakil Rakyat",
    "artist": "Iwan Fals",
    "year": 1987,
    "category": "Anthem Tongkrongan",
    "startSecond": 50,
    "lyricsClues": [
      "Untukmu yang duduk sambil diskusi\nUntukmu yang biasa bersafari",
      "Wakil rakyat kumpulan orang hebat\nBukan perkumpulan anak-anak muda",
      "Wakil rakyat di sana mendengar suara kami\nJangan tidur waktu sidang berlangsung"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "iwan fals surat buat wakil rakyat"
  },
  {
    "id": "jamrud-selamat-ulang-tahun",
    "title": "Selamat Ulang Tahun",
    "artist": "Jamrud",
    "year": 2002,
    "category": "Anthem Tongkrongan",
    "startSecond": 35,
    "lyricsClues": [
      "Hari ini hari yang kau tunggu\nBertambah satu tahun usiamu",
      "Semoga panjang umur dan bahagia\nMurah rezeki dan tercapai segala cita",
      "Tiup lilinnya dan potong kuenya\nRayakan bersama kawan setia"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.3
      },
      {
        "note": 392,
        "duration": 0.3
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "jamrud selamat ulang tahun"
  },
  {
    "id": "kotak-beraksi",
    "title": "Beraksi",
    "artist": "Kotak",
    "year": 2008,
    "category": "Anthem Tongkrongan",
    "startSecond": 45,
    "lyricsClues": [
      "Ketika semua musik berhenti bersuara\nTiba saatnya kita yang menggebrak panggung",
      "Ayo semua angkat tangan tinggi ke udara\nBebaskan semua beban yang mengikat jiwamu",
      "Malam ini kita beraksi tanpa henti\nBiarkan energi rock mengalir di darahmu"
    ],
    "hummingMelody": [
      {
        "note": 440,
        "duration": 0.3
      },
      {
        "note": 440,
        "duration": 0.3
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.8
      }
    ],
    "searchQuery": "kotak beraksi"
  },
  {
    "id": "armada-asal-kau-bahagia",
    "title": "Asal Kau Bahagia",
    "artist": "Armada",
    "year": 2017,
    "category": "Anthem Tongkrongan",
    "startSecond": 65,
    "lyricsClues": [
      "Kemarin engkau masih ada di sini\nBersamaku menikmati indahnya senja",
      "Katakan sejujurnya bila kau tak bahagia\nBila kau rasa dia yang terbaik untukmu",
      "Aku rela melepaskan genggaman tanganmu\nAsalkan engkau bahagia bersamanya"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "armada asal kau bahagia"
  },
  {
    "id": "judika-cinta-karena-cinta",
    "title": "Cinta Karena Cinta",
    "artist": "Judika",
    "year": 2019,
    "category": "Anthem Tongkrongan",
    "startSecond": 65,
    "lyricsClues": [
      "Aku cinta kamu bukan karena siapa-siapa\nTapi karena dirimu apa adanya",
      "Cinta karena cinta, tak perlu kau tanyakan lagi\nHanya kamu yang ada di hatiku",
      "Biar badai menghadang jalanku menuju dirimu\nKan kutempuh demi melihat senyumanmu"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.5
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.6
      }
    ],
    "searchQuery": "judika cinta karena cinta"
  },
  {
    "id": "judika-jikalau-kau-cinta",
    "title": "Jikalau Kau Cinta",
    "artist": "Judika",
    "year": 2018,
    "category": "Anthem Tongkrongan",
    "startSecond": 70,
    "lyricsClues": [
      "Jikalau kau cinta, katakan sejujurnya padanya\nJangan simpan rasa sampai terlambat waktu",
      "Bila memang kau sayang, buktikan dengan perbuatan\nAgar hatinya yakin kau tulus mencinta",
      "Waktu takkan terulang untuk kedua kali\nUngkapkan sebelum dia pergi berlalu"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "judika jikalau kau cinta"
  },
  {
    "id": "denny-kartonyono",
    "title": "Kartonyono Medot Janji",
    "artist": "Denny Caknan",
    "year": 2019,
    "category": "Pop Jawa & Koplo",
    "startSecond": 55,
    "lyricsClues": [
      "Kok kebangeten men, sambat blas ra ono gunane\nMung nambahi susah ati iki",
      "Kartonyono ning Ngawi medot janjimu\nAmbruk cagak ku nuruti angan-anganmu",
      "Sak kabehane wis tak wenehke kanggo kowe\nNanging balesanmu malah gawe tatu"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.35
      },
      {
        "note": 370,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "denny caknan kartonyono medot janji"
  },
  {
    "id": "denny-los-dol",
    "title": "Los Dol",
    "artist": "Denny Caknan",
    "year": 2020,
    "category": "Pop Jawa & Koplo",
    "startSecond": 50,
    "lyricsClues": [
      "Los dol ndang lanjut le dolanan WhatsApp-an\nNglirik hpne sing muni terus",
      "Kowe lewih milih de\u2019e sing lagi wae kenal\nTinimbang aku sing wis suwe ngancani",
      "Tak pasrahke kabeh marang Gusti Kang Akaryo Jagad\nIki dalan takdir sing kudu tak lakoni"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "denny caknan los dol"
  },
  {
    "id": "didi-kempot-pamer-bojo",
    "title": "Pamer Bojo",
    "artist": "Didi Kempot",
    "year": 2019,
    "category": "Pop Jawa & Koplo",
    "startSecond": 65,
    "lyricsClues": [
      "Koyo ngene rasane wong nandang kangen\nRino wengi atiku rasane peteng",
      "Dudu klambi anyar sing tak karepke\nNanging tekamu nambani kangenku",
      "Nengopo kowe malah pamer bojo anyar neng ngarepku\nCidro janji sing wis kok ucapke mbiyen"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 523,
        "duration": 0.5
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "didi kempot pamer bojo"
  },
  {
    "id": "ndarboy-mendung-tanpo-udan",
    "title": "Mendung Tanpo Udan",
    "artist": "Ndarboy Genk",
    "year": 2021,
    "category": "Pop Jawa & Koplo",
    "startSecond": 50,
    "lyricsClues": [
      "Mendung tanpo udan, ketemu lan kelangan\nKabeh kui wis dadi dalane urip",
      "Awak dewe tau duwe mimpi bebarengan\nNanging nyatane saiki mlaku dewe-dewe",
      "Matur nuwun wis tau gawe atiku bungah\nNadyan pungkasan mung ninggalake luh"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "ndarboy genk mendung tanpo udan"
  },
  {
    "id": "happy-asmara-rungkad",
    "title": "Rungkad",
    "artist": "Happy Asmara",
    "year": 2022,
    "category": "Pop Jawa & Koplo",
    "startSecond": 55,
    "lyricsClues": [
      "Rungkad entek-entekan, kelangan kabeh bondo lan rogo\nKabeh amargo kowe sing tak tresnani",
      "Saiki kowe malah milih wong liyo sing luwih sugih\nTatu ati iki ora bakal mari",
      "Ajur mumur duniaku morat-marit angan-anganku\nNyesel tau kenal karo kowe"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "happy asmara rungkad"
  },
  {
    "id": "guyon-waton-korban-janji",
    "title": "Korban Janji",
    "artist": "Guyon Waton",
    "year": 2018,
    "category": "Pop Jawa & Koplo",
    "startSecond": 60,
    "lyricsClues": [
      "Tanpo welas kowe lungo ninggal aku\nGolongane janji manismu jebul palsu",
      "Kowe tego gawe ati iki kelaran\nNeng mburiku kowe gandeng wong liyo",
      "Tak lilakne kowe sumanding wong liya\nMugo kowe nemu bahagia sing sejati"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "guyon waton korban janji"
  },
  {
    "id": "coldplay-fix-you",
    "title": "Fix You",
    "artist": "Coldplay",
    "year": 2005,
    "category": "Western Hits",
    "startSecond": 75,
    "lyricsClues": [
      "When you try your best, but you don't succeed\nWhen you get what you want, but not what you need",
      "When you feel so tired, but you can't sleep\nStuck in reverse",
      "Lights will guide you home\nAnd ignite your bones, and I will try to fix you"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 349,
        "duration": 0.8
      }
    ],
    "searchQuery": "coldplay fix you"
  },
  {
    "id": "coldplay-viva-la-vida",
    "title": "Viva La Vida",
    "artist": "Coldplay",
    "year": 2008,
    "category": "Western Hits",
    "startSecond": 50,
    "lyricsClues": [
      "I used to rule the world, seas would rise when I gave the word\nNow in the morning I sleep alone, sweep the streets I used to own",
      "I used to roll the dice, feel the fear in my enemy's eyes\nListen as the crowd would sing, now the old king is dead, long live the king",
      "One minute I held the key, next the walls were closed on me\nAnd I discovered that my castles stand upon pillars of salt and pillars of sand"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "coldplay viva la vida"
  },
  {
    "id": "coldplay-yellow",
    "title": "Yellow",
    "artist": "Coldplay",
    "year": 2000,
    "category": "Western Hits",
    "startSecond": 55,
    "lyricsClues": [
      "Look at the stars, look how they shine for you\nAnd everything you do, yeah they were all yellow",
      "I came along, I wrote a song for you\nAnd all the things you do, and it was called Yellow",
      "Your skin, oh yeah your skin and bones\nTurn into something beautiful, you know you know I love you so"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.5
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "coldplay yellow"
  },
  {
    "id": "queen-bohemian-rhapsody",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "year": 1975,
    "category": "Western Hits",
    "startSecond": 60,
    "lyricsClues": [
      "Is this the real life? Is this just fantasy?\nCaught in a landslide, no escape from reality",
      "Open your eyes, look up to the skies and see\nI'm just a poor boy, I need no sympathy",
      "Mama, just killed a man, put a gun against his head\nPulled my trigger, now he's dead"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 392,
        "duration": 0.6
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 349,
        "duration": 0.8
      }
    ],
    "searchQuery": "queen bohemian rhapsody"
  },
  {
    "id": "bruno-mars-just-the-way-you-are",
    "title": "Just the Way You Are",
    "artist": "Bruno Mars",
    "year": 2010,
    "category": "Western Hits",
    "startSecond": 55,
    "lyricsClues": [
      "Oh, her eyes, her eyes make the stars look like they're not shinin'\nHer hair, her hair falls perfectly without her tryin'",
      "She's so beautiful and I tell her everyday\n'Cause when you smile, the whole world stops and stares for a while",
      "'Cause girl you're amazing just the way you are\nAnd when you smile the whole world stops and stares for a while"
    ],
    "hummingMelody": [
      {
        "note": 392,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "bruno mars just the way you are"
  },
  {
    "id": "bruno-mars-grenade",
    "title": "Grenade",
    "artist": "Bruno Mars",
    "year": 2010,
    "category": "Western Hits",
    "startSecond": 60,
    "lyricsClues": [
      "Easy come, easy go, that's just how you live\nTake, take, take it all but you never give",
      "Catch a grenade for you, throw my hand on a blade for you\nI'd jump in front of a train for you",
      "You know I'd do anything for you\nOh oh I would go through all this pain, but you won't do the same"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "bruno mars grenade"
  },
  {
    "id": "ed-sheeran-perfect",
    "title": "Perfect",
    "artist": "Ed Sheeran",
    "year": 2017,
    "category": "Western Hits",
    "startSecond": 65,
    "lyricsClues": [
      "I found a love for me\nDarling, just dive right in and follow my lead",
      "Well, I found a girl, beautiful and sweet\nOh, I never knew you were the someone waiting for me",
      "'Cause we were just kids when we fell in love, not knowin' what it was\nI will not give you up this time"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.5
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "ed sheeran perfect"
  },
  {
    "id": "ed-sheeran-shape-of-you",
    "title": "Shape of You",
    "artist": "Ed Sheeran",
    "year": 2017,
    "category": "Western Hits",
    "startSecond": 45,
    "lyricsClues": [
      "The club isn't the best place to find a lover\nSo the bar is where I go",
      "I'm in love with the shape of you\nWe push and pull like a magnet do",
      "Although my heart is falling too\nI'm in love with your body"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.3
      },
      {
        "note": 370,
        "duration": 0.3
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "ed sheeran shape of you"
  },
  {
    "id": "maroon-5-sugar",
    "title": "Sugar",
    "artist": "Maroon 5",
    "year": 2014,
    "category": "Western Hits",
    "startSecond": 50,
    "lyricsClues": [
      "I'm hurting baby, I'm broken down\nI need your loving, loving, I need it now",
      "When I'm without you, I'm something weak\nYou got me begging, begging, I'm on my knees",
      "Sugar, yes please, won't you come and put it down on me\nI'm right here, cause I need little love, a little sympathy"
    ],
    "hummingMelody": [
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 440,
        "duration": 0.35
      },
      {
        "note": 494,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.8
      }
    ],
    "searchQuery": "maroon 5 sugar"
  },
  {
    "id": "oasis-dont-look-back-in-anger",
    "title": "Don't Look Back in Anger",
    "artist": "Oasis",
    "year": 1995,
    "category": "Western Hits",
    "startSecond": 60,
    "lyricsClues": [
      "Slip inside the eye of your mind, don't you know you might find\nA better place to play",
      "You said that you'd never been, but all the things that you've seen\nSlowly fade away",
      "So Sally can wait, she knows it's too late as we're walking on by\nHer soul slides away, but don't look back in anger, I heard you say"
    ],
    "hummingMelody": [
      {
        "note": 349,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 440,
        "duration": 0.4
      },
      {
        "note": 349,
        "duration": 0.8
      }
    ],
    "searchQuery": "oasis dont look back in anger"
  },
  {
    "id": "green-day-wake-me-up",
    "title": "Wake Me Up When September Ends",
    "artist": "Green Day",
    "year": 2004,
    "category": "Western Hits",
    "startSecond": 55,
    "lyricsClues": [
      "Summer has come and passed, the innocent can never last\nWake me up when September ends",
      "Like my fathers come to pass, seven years has gone so fast\nWake me up when September ends",
      "Here comes the rain again, falling from the stars\nDrenched in my pain again, becoming who we are"
    ],
    "hummingMelody": [
      {
        "note": 330,
        "duration": 0.4
      },
      {
        "note": 370,
        "duration": 0.4
      },
      {
        "note": 392,
        "duration": 0.4
      },
      {
        "note": 330,
        "duration": 0.8
      }
    ],
    "searchQuery": "green day wake me up when september ends"
  }
];
