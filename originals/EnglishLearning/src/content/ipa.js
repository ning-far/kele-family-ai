/**
 * 单词国际音标（IPA）表，覆盖主词库 WORDS 里的全部单词。
 *
 * 用于「生词 / 单词」类模块：答完/揭示答案时，把音标展示给孩子，
 * 让他们知道这个单词到底怎么念（仅靠 TTS 朗读有时记不住发音）。
 *
 * 音标以通用美式发音（General American）为主，少量兼顾英式常见读法，
 * 仅用于直观展示，不要求语言学级精确。
 */
export const IPA = {
  // animals
  cat: "kæt", dog: "dɔːɡ", fish: "fɪʃ", cow: "kaʊ", bird: "bɜːrd",
  pig: "pɪɡ", rabbit: "ræbɪt", duck: "dʌk", chicken: "tʃɪkɪn",
  sheep: "ʃiːp", horse: "hɔːrs", bear: "ber", elephant: "elɪfənt",
  lion: "laɪən", tiger: "taɪɡər", panda: "pændə", monkey: "mʌŋki",
  bee: "biː", frog: "frɔːɡ", mouse: "maʊs", snake: "sneɪk",
  turtle: "tɜːrtəl", fox: "fɑːks", goose: "ɡuːs",
  // food
  egg: "eɡ", bread: "bred", rice: "raɪs", cake: "keɪk", meat: "miːt",
  soup: "suːp", cookie: "kʊki", icecream: "aɪskriːm", candy: "kændi",
  noodle: "nuːdəl", cheese: "tʃiːz", sandwich: "sænwɪtʃ",
  hamburger: "hæmbɜːrɡər", pizza: "piːtsə", fries: "fraɪz",
  // fruit
  apple: "æpəl", banana: "bənænə", orange: "ɔːrɪndʒ", grape: "ɡreɪp",
  pear: "per", watermelon: "wɔːtərmelən", peach: "piːtʃ",
  strawberry: "strɔːberi", lemon: "lemən", mango: "mæŋɡoʊ",
  pineapple: "paɪnæpəl", cherry: "tʃeri",
  // vegetable
  tomato: "təmeɪtoʊ", potato: "pəteɪtoʊ", carrot: "kærət", corn: "kɔːrn",
  cucumber: "kjuːkʌmbər", pepper: "pepər", onion: "ʌnjən", cabbage: "kæbɪdʒ",
  // color
  red: "red", blue: "bluː", green: "ɡriːn", yellow: "jeloʊ", black: "blæk",
  white: "waɪt", pink: "pɪŋk", purple: "pɜːrpəl", brown: "braʊn",
  gray: "ɡreɪ",
  // number
  one: "wʌn", two: "tuː", three: "θriː", four: "fɔːr", five: "faɪv",
  six: "sɪks", seven: "sevən", eight: "eɪt", nine: "naɪn", ten: "ten",
  eleven: "ɪlevən", twelve: "twelv", thirteen: "θɜːrtiːn",
  fourteen: "fɔːrtiːn", fifteen: "fɪftiːn", sixteen: "sɪkstiːn",
  seventeen: "sevəntiːn", eighteen: "eɪtiːn", nineteen: "naɪntiːn",
  twenty: "twenti",
  // body
  hand: "hænd", eye: "aɪ", nose: "noʊz", mouth: "maʊθ", ear: "ɪr",
  foot: "fʊt", head: "hed", hair: "her", leg: "leɡ", arm: "ɑːrm",
  tooth: "tuːθ", finger: "fɪŋɡər", face: "feɪs",
  // family
  daddy: "dædi", mommy: "mɑːmi", brother: "brʌðər", sister: "sɪstər",
  grandpa: "ɡrænpɑː", grandma: "ɡrænmɑː", baby: "beɪbi", boy: "bɔɪ",
  girl: "ɡɜːrl",
  // clothing
  shirt: "ʃɜːrt", pants: "pænts", dress: "dres", hat: "hæt", shoe: "ʃuː",
  sock: "sɑːk", coat: "koʊt", skirt: "skɜːrt", jacket: "dʒækɪt",
  // school
  school: "skuːl", book: "bʊk", bag: "bæɡ", pencil: "pensəl", pen: "pen",
  ruler: "ruːlər", eraser: "ɪreɪsər", teacher: "tiːtʃər", desk: "desk",
  chair: "tʃer", blackboard: "blækbɔːrd", schoolbag: "skuːlbæɡ",
  classroom: "klæsruːm",
  // nature
  sun: "sʌn", star: "stɑːr", moon: "muːn", cloud: "klaʊd", rain: "reɪn",
  snow: "snoʊ", tree: "triː", flower: "flaʊər", grass: "ɡræs",
  river: "rɪvər", mountain: "maʊntən", wind: "wɪnd", fire: "faɪər",
  leaf: "liːf", sky: "skaɪ",
  // vehicle
  car: "kɑːr", bus: "bʌs", bike: "baɪk", plane: "pleɪn", boat: "boʊt",
  train: "treɪn", truck: "trʌk", taxi: "tæksi", ship: "ʃɪp",
  rocket: "rɑːkɪt",
  // action
  run: "rʌn", walk: "wɔːk", eat: "iːt", drink: "drɪŋk", sleep: "sliːp",
  sing: "sɪŋ", play: "pleɪ", jump: "dʒʌmp", read: "riːd", write: "raɪt",
  draw: "drɔː", swim: "swɪm", fly: "flaɪ", cry: "kraɪ", laugh: "læf",
  dance: "dæns", clap: "klæp", listen: "lɪsən", speak: "spiːk",
  clean: "kliːn", sit: "sɪt", stand: "stænd", open: "oʊpən",
  close: "kloʊz", look: "lʊk",
  // emotion
  happy: "hæpi", sad: "sæd", angry: "æŋɡri", tired: "taɪərd",
  hungry: "hʌŋɡri", thirsty: "θɜːrsti", afraid: "əfreɪd",
  surprised: "səpraɪzd", sleepy: "sliːpi",
  // daily
  water: "wɔːtər", milk: "mɪlk", cup: "kʌp", bowl: "boʊl", spoon: "spuːn",
  bed: "bed", key: "kiː", phone: "foʊn", ball: "bɔːl", gift: "ɡɪft",
  toy: "tɔɪ", plate: "pleɪt", fork: "fɔːrk", door: "dɔːr",
  window: "wɪndoʊ", light: "laɪt", clock: "klɑːk", balloon: "bəluːn",
  kite: "kaɪt", soap: "soʊp", towel: "taʊəl",
  // shape
  circle: "sɜːrkəl", square: "skwer", triangle: "traɪæŋɡəl",
  heart: "hɑːrt", rectangle: "rektæŋɡəl",
  // place
  home: "hoʊm", zoo: "zuː", park: "pɑːrk", farm: "fɑːrm", store: "stɔːr",
  hospital: "hɑːspɪtl", house: "haʊs",
  // greeting
  hello: "həloʊ", hi: "haɪ", goodbye: "ɡʊdbaɪ", thank: "θæŋk",
  // misc
  doll: "dɑːl", block: "blɑːk", hen: "hen",
};

/** 查词的国际音标（不带斜杠）；查不到返回 null。 */
export function ipaOf(word) {
  if (!word) return null;
  const w = String(word).trim().split(/\s+/)[0].toLowerCase();
  return IPA[w] || null;
}
