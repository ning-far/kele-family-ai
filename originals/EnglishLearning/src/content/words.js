/**
 * 主单词库（单词库）——覆盖「幼儿园 + 小学一年级」的英语核心词汇。
 *
 * 每个词：
 *   - id       唯一标识（小写英文，用于查词 / 统计）
 *   - word     英文拼写（朗读 / 匹配）
 *   - emoji    彩色 emoji（看图记词，零图片资源、零积分消耗）
 *   - meaning  中文释义
 *   - category 分类（animal/food/color/...，见 CATEGORIES）
 *   - level    学段：'kg' = 幼儿园，'g1' = 小学一年级
 *
 * 渲染图片优先用 emoji（wordImage.js），无需任何外部图片文件。
 * 训练时可按 level / category 筛选，也可按「生词库 / 易错词库」针对性练。
 */
import { ICONS } from "./icons.js";

export const LEVELS = {
  kg: "幼儿园",
  g1: "小学一年级",
};

export const CATEGORIES = {
  animals: "动物",
  food: "食物",
  fruit: "水果",
  vegetable: "蔬菜",
  color: "颜色",
  number: "数字",
  body: "身体",
  family: "家人",
  clothing: "衣物",
  school: "学习用品",
  nature: "自然",
  vehicle: "交通工具",
  action: "动作",
  emotion: "情绪",
  daily: "日常用品",
  shape: "形状",
  place: "场所",
  greeting: "问候",
};

export const WORDS = [
  // ———————— 动物 animals ————————
  { id: "cat", word: "cat", emoji: "🐱", meaning: "猫", category: "animals", level: "kg" },
  { id: "dog", word: "dog", emoji: "🐶", meaning: "狗", category: "animals", level: "kg" },
  { id: "fish", word: "fish", emoji: "🐟", meaning: "鱼", category: "animals", level: "kg" },
  { id: "cow", word: "cow", emoji: "🐮", meaning: "牛", category: "animals", level: "kg" },
  { id: "bird", word: "bird", emoji: "🐦", meaning: "鸟", category: "animals", level: "kg" },
  { id: "pig", word: "pig", emoji: "🐷", meaning: "猪", category: "animals", level: "kg" },
  { id: "rabbit", word: "rabbit", emoji: "🐰", meaning: "兔子", category: "animals", level: "kg" },
  { id: "duck", word: "duck", emoji: "🦆", meaning: "鸭子", category: "animals", level: "kg" },
  { id: "chicken", word: "chicken", emoji: "🐔", meaning: "鸡", category: "animals", level: "kg" },
  { id: "sheep", word: "sheep", emoji: "🐑", meaning: "羊", category: "animals", level: "kg" },
  { id: "horse", word: "horse", emoji: "🐴", meaning: "马", category: "animals", level: "kg" },
  { id: "bear", word: "bear", emoji: "🐻", meaning: "熊", category: "animals", level: "kg" },
  { id: "elephant", word: "elephant", emoji: "🐘", meaning: "大象", category: "animals", level: "g1" },
  { id: "lion", word: "lion", emoji: "🦁", meaning: "狮子", category: "animals", level: "g1" },
  { id: "tiger", word: "tiger", emoji: "🐯", meaning: "老虎", category: "animals", level: "g1" },
  { id: "panda", word: "panda", emoji: "🐼", meaning: "熊猫", category: "animals", level: "g1" },
  { id: "monkey", word: "monkey", emoji: "🐵", meaning: "猴子", category: "animals", level: "g1" },
  { id: "bee", word: "bee", emoji: "🐝", meaning: "蜜蜂", category: "animals", level: "g1" },
  { id: "frog", word: "frog", emoji: "🐸", meaning: "青蛙", category: "animals", level: "g1" },
  { id: "mouse", word: "mouse", emoji: "🐭", meaning: "老鼠", category: "animals", level: "g1" },
  { id: "snake", word: "snake", emoji: "🐍", meaning: "蛇", category: "animals", level: "g1" },
  { id: "turtle", word: "turtle", emoji: "🐢", meaning: "乌龟", category: "animals", level: "g1" },
  { id: "fox", word: "fox", emoji: "🦊", meaning: "狐狸", category: "animals", level: "g1" },
  { id: "goose", word: "goose", emoji: "🪿", meaning: "鹅", category: "animals", level: "g1" },

  // ———————— 食物 food ————————
  { id: "egg", word: "egg", emoji: "🥚", meaning: "鸡蛋", category: "food", level: "kg" },
  { id: "bread", word: "bread", emoji: "🍞", meaning: "面包", category: "food", level: "kg" },
  { id: "rice", word: "rice", emoji: "🍚", meaning: "米饭", category: "food", level: "kg" },
  { id: "cake", word: "cake", emoji: "🍰", meaning: "蛋糕", category: "food", level: "kg" },
  { id: "meat", word: "meat", emoji: "🥩", meaning: "肉", category: "food", level: "kg" },
  { id: "soup", word: "soup", emoji: "🍲", meaning: "汤", category: "food", level: "kg" },
  { id: "cookie", word: "cookie", emoji: "🍪", meaning: "饼干", category: "food", level: "g1" },
  { id: "icecream", word: "icecream", emoji: "🍦", meaning: "冰淇淋", category: "food", level: "g1" },
  { id: "candy", word: "candy", emoji: "🍬", meaning: "糖果", category: "food", level: "g1" },
  { id: "noodle", word: "noodle", emoji: "🍜", meaning: "面条", category: "food", level: "g1" },
  { id: "cheese", word: "cheese", emoji: "🧀", meaning: "奶酪", category: "food", level: "g1" },
  { id: "sandwich", word: "sandwich", emoji: "🥪", meaning: "三明治", category: "food", level: "g1" },
  { id: "hamburger", word: "hamburger", emoji: "🍔", meaning: "汉堡", category: "food", level: "g1" },
  { id: "pizza", word: "pizza", emoji: "🍕", meaning: "披萨", category: "food", level: "g1" },
  { id: "fries", word: "fries", emoji: "🍟", meaning: "薯条", category: "food", level: "g1" },

  // ———————— 水果 fruit ————————
  { id: "apple", word: "apple", emoji: "🍎", meaning: "苹果", category: "fruit", level: "kg" },
  { id: "banana", word: "banana", emoji: "🍌", meaning: "香蕉", category: "fruit", level: "kg" },
  { id: "orange", word: "orange", emoji: "🍊", meaning: "橙子", category: "fruit", level: "kg" },
  { id: "grape", word: "grape", emoji: "🍇", meaning: "葡萄", category: "fruit", level: "kg" },
  { id: "pear", word: "pear", emoji: "🍐", meaning: "梨", category: "fruit", level: "kg" },
  { id: "watermelon", word: "watermelon", emoji: "🍉", meaning: "西瓜", category: "fruit", level: "g1" },
  { id: "peach", word: "peach", emoji: "🍑", meaning: "桃子", category: "fruit", level: "g1" },
  { id: "strawberry", word: "strawberry", emoji: "🍓", meaning: "草莓", category: "fruit", level: "g1" },
  { id: "lemon", word: "lemon", emoji: "🍋", meaning: "柠檬", category: "fruit", level: "g1" },
  { id: "mango", word: "mango", emoji: "🥭", meaning: "芒果", category: "fruit", level: "g1" },
  { id: "pineapple", word: "pineapple", emoji: "🍍", meaning: "菠萝", category: "fruit", level: "g1" },
  { id: "cherry", word: "cherry", emoji: "🍒", meaning: "樱桃", category: "fruit", level: "g1" },

  // ———————— 蔬菜 vegetable ————————
  { id: "tomato", word: "tomato", emoji: "🍅", meaning: "番茄", category: "vegetable", level: "g1" },
  { id: "potato", word: "potato", emoji: "🥔", meaning: "土豆", category: "vegetable", level: "g1" },
  { id: "carrot", word: "carrot", emoji: "🥕", meaning: "胡萝卜", category: "vegetable", level: "g1" },
  { id: "corn", word: "corn", emoji: "🌽", meaning: "玉米", category: "vegetable", level: "g1" },
  { id: "cucumber", word: "cucumber", emoji: "🥒", meaning: "黄瓜", category: "vegetable", level: "g1" },
  { id: "pepper", word: "pepper", emoji: "🌶️", meaning: "辣椒", category: "vegetable", level: "g1" },
  { id: "onion", word: "onion", emoji: "🧅", meaning: "洋葱", category: "vegetable", level: "g1" },
  { id: "cabbage", word: "cabbage", emoji: "🥬", meaning: "白菜", category: "vegetable", level: "g1" },

  // ———————— 颜色 color ————————
  { id: "red", word: "red", emoji: "🔴", meaning: "红色", category: "color", level: "kg" },
  { id: "blue", word: "blue", emoji: "🔵", meaning: "蓝色", category: "color", level: "kg" },
  { id: "green", word: "green", emoji: "🟢", meaning: "绿色", category: "color", level: "kg" },
  { id: "yellow", word: "yellow", emoji: "🟡", meaning: "黄色", category: "color", level: "kg" },
  { id: "black", word: "black", emoji: "⚫", meaning: "黑色", category: "color", level: "kg" },
  { id: "white", word: "white", emoji: "⚪", meaning: "白色", category: "color", level: "kg" },
  { id: "pink", word: "pink", emoji: "🩷", meaning: "粉色", category: "color", level: "kg" },
  { id: "purple", word: "purple", emoji: "🟣", meaning: "紫色", category: "color", level: "kg" },
  { id: "orange-c", word: "orange", emoji: "🟠", meaning: "橙色", category: "color", level: "kg" },
  { id: "brown", word: "brown", emoji: "🟤", meaning: "棕色", category: "color", level: "kg" },
  { id: "gray", word: "gray", emoji: "🩶", meaning: "灰色", category: "color", level: "kg" },

  // ———————— 数字 number ————————
  { id: "one", word: "one", emoji: "1️⃣", meaning: "一", category: "number", level: "kg" },
  { id: "two", word: "two", emoji: "2️⃣", meaning: "二", category: "number", level: "kg" },
  { id: "three", word: "three", emoji: "3️⃣", meaning: "三", category: "number", level: "kg" },
  { id: "four", word: "four", emoji: "4️⃣", meaning: "四", category: "number", level: "kg" },
  { id: "five", word: "five", emoji: "5️⃣", meaning: "五", category: "number", level: "kg" },
  { id: "six", word: "six", emoji: "6️⃣", meaning: "六", category: "number", level: "kg" },
  { id: "seven", word: "seven", emoji: "7️⃣", meaning: "七", category: "number", level: "kg" },
  { id: "eight", word: "eight", emoji: "8️⃣", meaning: "八", category: "number", level: "kg" },
  { id: "nine", word: "nine", emoji: "9️⃣", meaning: "九", category: "number", level: "kg" },
  { id: "ten", word: "ten", emoji: "🔟", meaning: "十", category: "number", level: "kg" },
  { id: "eleven", word: "eleven", emoji: "11", meaning: "十一", category: "number", level: "g1" },
  { id: "twelve", word: "twelve", emoji: "12", meaning: "十二", category: "number", level: "g1" },
  { id: "thirteen", word: "thirteen", emoji: "13", meaning: "十三", category: "number", level: "g1" },
  { id: "fourteen", word: "fourteen", emoji: "14", meaning: "十四", category: "number", level: "g1" },
  { id: "fifteen", word: "fifteen", emoji: "15", meaning: "十五", category: "number", level: "g1" },
  { id: "sixteen", word: "sixteen", emoji: "16", meaning: "十六", category: "number", level: "g1" },
  { id: "seventeen", word: "seventeen", emoji: "17", meaning: "十七", category: "number", level: "g1" },
  { id: "eighteen", word: "eighteen", emoji: "18", meaning: "十八", category: "number", level: "g1" },
  { id: "nineteen", word: "nineteen", emoji: "19", meaning: "十九", category: "number", level: "g1" },
  { id: "twenty", word: "twenty", emoji: "20", meaning: "二十", category: "number", level: "g1" },

  // ———————— 身体 body ————————
  { id: "hand", word: "hand", emoji: "✋", meaning: "手", category: "body", level: "kg" },
  { id: "eye", word: "eye", emoji: "👁️", meaning: "眼睛", category: "body", level: "kg" },
  { id: "nose", word: "nose", emoji: "👃", meaning: "鼻子", category: "body", level: "kg" },
  { id: "mouth", word: "mouth", emoji: "👄", meaning: "嘴巴", category: "body", level: "kg" },
  { id: "ear", word: "ear", emoji: "👂", meaning: "耳朵", category: "body", level: "kg" },
  { id: "foot", word: "foot", emoji: "🦶", meaning: "脚", category: "body", level: "kg" },
  { id: "head", word: "head", emoji: "👱", meaning: "头", category: "body", level: "kg" },
  { id: "hair", word: "hair", emoji: "💇", meaning: "头发", category: "body", level: "kg" },
  { id: "leg", word: "leg", emoji: "🦵", meaning: "腿", category: "body", level: "g1" },
  { id: "arm", word: "arm", emoji: "💪", meaning: "胳膊", category: "body", level: "g1" },
  { id: "tooth", word: "tooth", emoji: "🦷", meaning: "牙齿", category: "body", level: "g1" },
  { id: "finger", word: "finger", emoji: "☝️", meaning: "手指", category: "body", level: "g1" },
  { id: "face", word: "face", emoji: "🙂", meaning: "脸", category: "body", level: "g1" },

  // ———————— 家人 family ————————
  { id: "daddy", word: "daddy", emoji: "👨", meaning: "爸爸", category: "family", level: "kg" },
  { id: "mommy", word: "mommy", emoji: "👩", meaning: "妈妈", category: "family", level: "kg" },
  { id: "brother", word: "brother", emoji: "👦", meaning: "兄弟", category: "family", level: "kg" },
  { id: "sister", word: "sister", emoji: "👧", meaning: "姐妹", category: "family", level: "kg" },
  { id: "grandpa", word: "grandpa", emoji: "👴", meaning: "爷爷", category: "family", level: "kg" },
  { id: "grandma", word: "grandma", emoji: "👵", meaning: "奶奶", category: "family", level: "kg" },
  { id: "baby", word: "baby", emoji: "👶", meaning: "宝宝", category: "family", level: "kg" },
  { id: "boy", word: "boy", emoji: "👦", meaning: "男孩", category: "family", level: "kg" },
  { id: "girl", word: "girl", emoji: "👧", meaning: "女孩", category: "family", level: "kg" },

  // ———————— 衣物 clothing ————————
  { id: "shirt", word: "shirt", emoji: "👕", meaning: "衬衫", category: "clothing", level: "kg" },
  { id: "pants", word: "pants", emoji: "👖", meaning: "裤子", category: "clothing", level: "kg" },
  { id: "dress", word: "dress", emoji: "👗", meaning: "裙子", category: "clothing", level: "kg" },
  { id: "hat", word: "hat", emoji: "👒", meaning: "帽子", category: "clothing", level: "kg" },
  { id: "shoe", word: "shoe", emoji: "👟", meaning: "鞋子", category: "clothing", level: "kg" },
  { id: "sock", word: "sock", emoji: "🧦", meaning: "袜子", category: "clothing", level: "kg" },
  { id: "coat", word: "coat", emoji: "🧥", meaning: "外套", category: "clothing", level: "g1" },
  { id: "skirt", word: "skirt", emoji: "👚", meaning: "短裙", category: "clothing", level: "g1" },
  { id: "jacket", word: "jacket", emoji: "🦺", meaning: "夹克", category: "clothing", level: "g1" },

  // ———————— 学习用品 school ————————
  { id: "school", word: "school", emoji: "🏫", meaning: "学校", category: "school", level: "g1" },
  { id: "book", word: "book", emoji: "📕", meaning: "书", category: "school", level: "g1" },
  { id: "bag", word: "bag", emoji: "🎒", meaning: "书包", category: "school", level: "g1" },
  { id: "pencil", word: "pencil", emoji: "✏️", meaning: "铅笔", category: "school", level: "g1" },
  { id: "pen", word: "pen", emoji: "🖊️", meaning: "钢笔", category: "school", level: "g1" },
  { id: "ruler", word: "ruler", emoji: "📏", meaning: "尺子", category: "school", level: "g1" },
  { id: "eraser", word: "eraser", emoji: "🧽", meaning: "橡皮", category: "school", level: "g1" },
  { id: "teacher", word: "teacher", emoji: "🧑‍🏫", meaning: "老师", category: "school", level: "g1" },
  { id: "desk", word: "desk", emoji: "🪑", meaning: "书桌", category: "school", level: "g1" },
  { id: "chair", word: "chair", emoji: "💺", meaning: "椅子", category: "school", level: "g1" },
  { id: "blackboard", word: "blackboard", emoji: "🟫", meaning: "黑板", category: "school", level: "g1" },

  // ———————— 自然 nature ————————
  { id: "sun", word: "sun", emoji: "☀️", meaning: "太阳", category: "nature", level: "kg" },
  { id: "star", word: "star", emoji: "⭐", meaning: "星星", category: "nature", level: "kg" },
  { id: "moon", word: "moon", emoji: "🌙", meaning: "月亮", category: "nature", level: "kg" },
  { id: "cloud", word: "cloud", emoji: "☁️", meaning: "云", category: "nature", level: "kg" },
  { id: "rain", word: "rain", emoji: "🌧️", meaning: "雨", category: "nature", level: "kg" },
  { id: "snow", word: "snow", emoji: "❄️", meaning: "雪", category: "nature", level: "kg" },
  { id: "tree", word: "tree", emoji: "🌳", meaning: "树", category: "nature", level: "kg" },
  { id: "flower", word: "flower", emoji: "🌸", meaning: "花", category: "nature", level: "kg" },
  { id: "grass", word: "grass", emoji: "🌿", meaning: "草", category: "nature", level: "g1" },
  { id: "river", word: "river", emoji: "🏞️", meaning: "河流", category: "nature", level: "g1" },
  { id: "mountain", word: "mountain", emoji: "⛰️", meaning: "山", category: "nature", level: "g1" },
  { id: "wind", word: "wind", emoji: "🌬️", meaning: "风", category: "nature", level: "g1" },
  { id: "fire", word: "fire", emoji: "🔥", meaning: "火", category: "nature", level: "g1" },
  { id: "leaf", word: "leaf", emoji: "🍃", meaning: "叶子", category: "nature", level: "g1" },
  { id: "sky", word: "sky", emoji: "🌌", meaning: "天空", category: "nature", level: "g1" },

  // ———————— 交通工具 vehicle ————————
  { id: "car", word: "car", emoji: "🚗", meaning: "汽车", category: "vehicle", level: "kg" },
  { id: "bus", word: "bus", emoji: "🚌", meaning: "公交车", category: "vehicle", level: "kg" },
  { id: "bike", word: "bike", emoji: "🚲", meaning: "自行车", category: "vehicle", level: "kg" },
  { id: "plane", word: "plane", emoji: "✈️", meaning: "飞机", category: "vehicle", level: "kg" },
  { id: "boat", word: "boat", emoji: "🚤", meaning: "小船", category: "vehicle", level: "kg" },
  { id: "train", word: "train", emoji: "🚂", meaning: "火车", category: "vehicle", level: "g1" },
  { id: "truck", word: "truck", emoji: "🚚", meaning: "卡车", category: "vehicle", level: "g1" },
  { id: "taxi", word: "taxi", emoji: "🚕", meaning: "出租车", category: "vehicle", level: "g1" },
  { id: "ship", word: "ship", emoji: "🚢", meaning: "轮船", category: "vehicle", level: "g1" },
  { id: "rocket", word: "rocket", emoji: "🚀", meaning: "火箭", category: "vehicle", level: "g1" },

  // ———————— 动作 action ————————
  { id: "run", word: "run", emoji: "🏃", meaning: "跑", category: "action", level: "kg" },
  { id: "walk", word: "walk", emoji: "🚶", meaning: "走", category: "action", level: "kg" },
  { id: "eat", word: "eat", emoji: "🍽️", meaning: "吃", category: "action", level: "kg" },
  { id: "drink", word: "drink", emoji: "🥤", meaning: "喝", category: "action", level: "kg" },
  { id: "sleep", word: "sleep", emoji: "😴", meaning: "睡觉", category: "action", level: "kg" },
  { id: "sing", word: "sing", emoji: "🎤", meaning: "唱歌", category: "action", level: "kg" },
  { id: "play", word: "play", emoji: "🤾", meaning: "玩", category: "action", level: "kg" },
  { id: "jump", word: "jump", emoji: "⤴️", meaning: "跳", category: "action", level: "g1" },
  { id: "read", word: "read", emoji: "📖", meaning: "读", category: "action", level: "g1" },
  { id: "write", word: "write", emoji: "✍️", meaning: "写", category: "action", level: "g1" },
  { id: "draw", word: "draw", emoji: "🎨", meaning: "画", category: "action", level: "g1" },
  { id: "swim", word: "swim", emoji: "🏊", meaning: "游泳", category: "action", level: "g1" },
  { id: "fly", word: "fly", emoji: "🕊️", meaning: "飞", category: "action", level: "g1" },
  { id: "cry", word: "cry", emoji: "😢", meaning: "哭", category: "action", level: "g1" },
  { id: "laugh", word: "laugh", emoji: "😆", meaning: "笑", category: "action", level: "g1" },
  { id: "dance", word: "dance", emoji: "💃", meaning: "跳舞", category: "action", level: "g1" },
  { id: "clap", word: "clap", emoji: "👏", meaning: "拍手", category: "action", level: "g1" },
  { id: "listen", word: "listen", emoji: "🎧", meaning: "听", category: "action", level: "g1" },
  { id: "speak", word: "speak", emoji: "🗣️", meaning: "说", category: "action", level: "g1" },
  { id: "clean", word: "clean", emoji: "🧹", meaning: "打扫", category: "action", level: "g1" },
  { id: "sit", word: "sit", emoji: "🪑", meaning: "坐", category: "action", level: "g1" },
  { id: "stand", word: "stand", emoji: "🧍", meaning: "站", category: "action", level: "g1" },
  { id: "open", word: "open", emoji: "👐", meaning: "打开", category: "action", level: "g1" },
  { id: "close", word: "close", emoji: "🤝", meaning: "关上", category: "action", level: "g1" },
  { id: "look", word: "look", emoji: "👀", meaning: "看", category: "action", level: "g1" },

  // ———————— 情绪 emotion ————————
  { id: "happy", word: "happy", emoji: "😊", meaning: "开心", category: "emotion", level: "kg" },
  { id: "sad", word: "sad", emoji: "😢", meaning: "难过", category: "emotion", level: "kg" },
  { id: "angry", word: "angry", emoji: "😠", meaning: "生气", category: "emotion", level: "g1" },
  { id: "tired", word: "tired", emoji: "😩", meaning: "累", category: "emotion", level: "g1" },
  { id: "hungry", word: "hungry", emoji: "🤤", meaning: "饿", category: "emotion", level: "g1" },
  { id: "thirsty", word: "thirsty", emoji: "🥤", meaning: "渴", category: "emotion", level: "g1" },
  { id: "afraid", word: "afraid", emoji: "😨", meaning: "害怕", category: "emotion", level: "g1" },
  { id: "surprised", word: "surprised", emoji: "😲", meaning: "惊讶", category: "emotion", level: "g1" },
  { id: "sleepy", word: "sleepy", emoji: "😪", meaning: "困", category: "emotion", level: "g1" },

  // ———————— 日常用品 daily ————————
  { id: "water", word: "water", emoji: "💧", meaning: "水", category: "daily", level: "kg" },
  { id: "milk", word: "milk", emoji: "🥛", meaning: "牛奶", category: "daily", level: "kg" },
  { id: "cup", word: "cup", emoji: "☕", meaning: "杯子", category: "daily", level: "kg" },
  { id: "bowl", word: "bowl", emoji: "🥣", meaning: "碗", category: "daily", level: "kg" },
  { id: "spoon", word: "spoon", emoji: "🥄", meaning: "勺子", category: "daily", level: "kg" },
  { id: "bed", word: "bed", emoji: "🛏️", meaning: "床", category: "daily", level: "kg" },
  { id: "key", word: "key", emoji: "🔑", meaning: "钥匙", category: "daily", level: "kg" },
  { id: "phone", word: "phone", emoji: "📱", meaning: "电话", category: "daily", level: "kg" },
  { id: "ball", word: "ball", emoji: "⚽", meaning: "球", category: "daily", level: "kg" },
  { id: "gift", word: "gift", emoji: "🎁", meaning: "礼物", category: "daily", level: "kg" },
  { id: "toy", word: "toy", emoji: "🧸", meaning: "玩具", category: "daily", level: "kg" },
  { id: "plate", word: "plate", emoji: "🍽️", meaning: "盘子", category: "daily", level: "g1" },
  { id: "fork", word: "fork", emoji: "🍴", meaning: "叉子", category: "daily", level: "g1" },
  { id: "door", word: "door", emoji: "🚪", meaning: "门", category: "daily", level: "g1" },
  { id: "window", word: "window", emoji: "🪟", meaning: "窗户", category: "daily", level: "g1" },
  { id: "light", word: "light", emoji: "💡", meaning: "灯", category: "daily", level: "g1" },
  { id: "clock", word: "clock", emoji: "⏰", meaning: "钟表", category: "daily", level: "g1" },
  { id: "balloon", word: "balloon", emoji: "🎈", meaning: "气球", category: "daily", level: "g1" },
  { id: "kite", word: "kite", emoji: "🪁", meaning: "风筝", category: "daily", level: "g1" },
  { id: "soap", word: "soap", emoji: "🧼", meaning: "肥皂", category: "daily", level: "g1" },
  { id: "towel", word: "towel", emoji: "🧴", meaning: "毛巾", category: "daily", level: "g1" },

  // ———————— 形状 shape ————————
  { id: "circle", word: "circle", emoji: "⚪", meaning: "圆形", category: "shape", level: "kg" },
  { id: "square", word: "square", emoji: "🟦", meaning: "正方形", category: "shape", level: "kg" },
  { id: "triangle", word: "triangle", emoji: "🔺", meaning: "三角形", category: "shape", level: "kg" },
  { id: "star-shape", word: "star", emoji: "⭐", meaning: "星形", category: "shape", level: "kg" },
  { id: "heart", word: "heart", emoji: "❤️", meaning: "心形", category: "shape", level: "kg" },
  { id: "rectangle", word: "rectangle", emoji: "🟥", meaning: "长方形", category: "shape", level: "g1" },

  // ———————— 场所 place ————————
  { id: "home", word: "home", emoji: "🏠", meaning: "家", category: "place", level: "kg" },
  { id: "zoo", word: "zoo", emoji: "🐘", meaning: "动物园", category: "place", level: "g1" },
  { id: "park", word: "park", emoji: "🌳", meaning: "公园", category: "place", level: "g1" },
  { id: "farm", word: "farm", emoji: "🚜", meaning: "农场", category: "place", level: "g1" },
  { id: "store", word: "store", emoji: "🏪", meaning: "商店", category: "place", level: "g1" },
  { id: "hospital", word: "hospital", emoji: "🏥", meaning: "医院", category: "place", level: "g1" },
  // ———————— 问候 greeting（一年级交际用语） ————————
  { id: "hello", word: "hello", emoji: "👋", meaning: "你好", category: "greeting", level: "g1" },
  { id: "hi", word: "hi", emoji: "🖐️", meaning: "嗨", category: "greeting", level: "g1" },
  { id: "goodbye", word: "goodbye", emoji: "👋", meaning: "再见", category: "greeting", level: "g1" },
  { id: "thank", word: "thank", emoji: "🙏", meaning: "谢谢", category: "greeting", level: "g1" },

  // ———————— 补充一年级常见词 ————————
  { id: "schoolbag", word: "schoolbag", emoji: "🎒", meaning: "书包", category: "school", level: "g1" },
  { id: "classroom", word: "classroom", emoji: "🏫", meaning: "教室", category: "school", level: "g1" },
  { id: "doll", word: "doll", emoji: "🪆", meaning: "娃娃", category: "daily", level: "g1" },
  { id: "block", word: "block", emoji: "🧱", meaning: "积木", category: "daily", level: "g1" },
  { id: "house", word: "house", emoji: "🏠", meaning: "房子", category: "place", level: "g1" },
  { id: "hen", word: "hen", emoji: "🐔", meaning: "母鸡", category: "animals", level: "g1" },
].filter((w) => w.emoji || (w.icon && ICONS[w.icon])); // 保留有图（emoji 或 SVG）的词

const BY_WORD = new Map(WORDS.map((w) => [w.word.toLowerCase(), w]));
const BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export function getWord(id) {
  return BY_ID.get(id) || null;
}

/** 按英文单词查词库条目（忽略大小写）；查不到返回最小条目 {word}。 */
export function entryByWord(word) {
  if (!word) return null;
  return BY_WORD.get(String(word).toLowerCase()) || { word };
}

/** 某学段全部词。 */
export function byLevel(level) {
  return WORDS.filter((w) => w.level === level);
}

/** 某分类全部词。 */
export function byCategory(category) {
  return WORDS.filter((w) => w.category === category);
}

/** 从给定词池随机抽取 n 个不重复的词。 */
export function pickFrom(pool, n) {
  const arr = (pool || []).slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

/** 从完整主词库随机抽取 n 个（向后兼容）。 */
export function pickWords(n) {
  return pickFrom(WORDS, n);
}
