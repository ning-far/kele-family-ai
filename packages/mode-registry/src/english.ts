export type EnglishLearningMode = { id:string; title:string; goal:string; input:'touch'|'audio'|'text'|'mixed'; output:'recognition'|'listening'|'speaking'|'reading'|'writing'|'vocabulary'|'translation' };
export const englishLearningModes:EnglishLearningMode[] = [
 {id:'recognize',title:'认识单词',goal:'看见单词能认出并理解图片或中文含义',input:'touch',output:'recognition'},
 {id:'listening',title:'听力理解',goal:'听懂单词和短句',input:'audio',output:'listening'},
 {id:'speak',title:'跟我读',goal:'模仿发音并获得清晰度反馈',input:'audio',output:'speaking'},
 {id:'reading',title:'阅读理解',goal:'读懂短句和简单对话',input:'mixed',output:'reading'},
 {id:'writing',title:'写一写',goal:'根据提示拼写单词和句子',input:'text',output:'writing'},
 {id:'my-words',title:'我的单词库',goal:'复习生词、易错词和已掌握词',input:'touch',output:'vocabulary'},
 {id:'translator',title:'中英互译',goal:'理解常用中文和英文表达的对应关系',input:'mixed',output:'translation'},
];
export function findEnglishMode(id:string){return englishLearningModes.find(mode=>mode.id===id);}
