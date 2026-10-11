import {useState} from 'react';
import {useLoad} from '@tarojs/taro';
import {View,Text,Button} from '@tarojs/components';
import {modes,findMode} from '@kele/mode-registry';
export default function Index(){
 const [selected,setSelected]=useState<string>();const mode=findMode(selected);
 useLoad(options=>{const target=findMode(options.mode);if(target)setSelected(target.id);});
 return <View className="page"><View className="title">{mode?.title??'今天，想做点什么？'}</View><View className="notice">本地基础工程 · 游戏、语音和云同步尚未接入</View>{mode?<><Text>{mode.description}</Text><View className="notice">入口已建立，实际功能将在后续开发。无需开发板也可独立使用。</View><Button className="back" onClick={()=>setSelected(undefined)}>返回模式</Button></>:modes.map(item=><View className="mode" key={item.id} onClick={()=>setSelected(item.id)}><View className="mode-title">{item.title}</View><View className="description">{item.description}</View></View>)}</View>;
}
