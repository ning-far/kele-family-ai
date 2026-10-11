import React from 'react';
import { loadAppState, parseAppState, saveAppState, STORAGE_KEY, STORAGE_VERSION } from './storage';
import { rhythmSongs, rhythmBackgrounds } from './rhythm';
import {currentMemberStorage,memberContext} from './member-context.ts';
import {LearningExportPanel} from './LearningExportPanel.tsx';

export function DataManagement() {
  const [message, setMessage] = React.useState('');
  const [showRecords, setShowRecords] = React.useState(false);
  const records = showRecords ? loadAppState().rhythm.records : [];
  const exportData = () => {
    try {
      const raw = currentMemberStorage()?.getItem(STORAGE_KEY) || JSON.stringify(parseAppState(null));
      const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kele-backup.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('备份已导出，请妥善保存。');
    } catch { setMessage('无法导出，请检查浏览器存储权限。'); }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    const revision=memberContext.getSnapshot().revision;
    try {
      if (file.size > 1024 * 1024) throw new Error('备份文件超过 1MB，请选择正确的备份。');
      const raw = await file.text();
      if(memberContext.getSnapshot().revision!==revision)throw new Error('使用成员已切换，备份未恢复，请重新选择。');
      const value = JSON.parse(raw);
      if (!value || value.schemaVersion !== STORAGE_VERSION || !value.config || !value.rhythm) throw new Error('备份格式或版本不支持，当前数据已保留。');
      if (!window.confirm('恢复这份备份将覆盖本机配置和游戏成绩，是否继续？')) return;
      saveAppState(parseAppState(raw));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '恢复失败，当前数据已保留。'); }
  };
  return <><LearningExportPanel/><section className="notice"><h2>本机数据备份</h2><p>备份包含此浏览器的配置和游戏成绩，可在另一台设备恢复。</p><button className="secondary" onClick={exportData}>导出备份</button><label style={{display:'block',marginTop:16}}>恢复备份<input type="file" accept=".json,application/json" onChange={event=>{void restore(event.target.files?.[0]);event.target.value='';}} /></label><p role="status">{message}</p><button className="secondary" onClick={()=>setShowRecords(!showRecords)}>{showRecords?'收起游戏记录':'查看游戏记录'}</button>{showRecords && <div>{records.length===0?<p>还没有游戏记录，去玩一首歌吧。</p>:<ol>{records.map(record=><li key={record.id}><strong>{rhythmSongs.find(song=>song.id===record.songId)?.title}</strong> · {record.score} 分 · {rhythmBackgrounds.find(background=>background.id===record.backgroundId)?.title}<br/><small>{new Date(record.playedAt).toLocaleString('zh-CN')}</small></li>)}</ol>}</div>}</section></>;
}
