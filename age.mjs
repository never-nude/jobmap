export function jobAge(postedAt,now=Date.now()){
 if(!postedAt||!Number.isFinite(Date.parse(postedAt)))return {key:'unknown',color:'#7c8996',label:'Date unavailable',days:null};
 const days=Math.max(0,Math.floor((now-Date.parse(postedAt))/86400000));
 return {key:days<=7?'blue':days<=14?'green':days<=30?'yellow':'red',color:days<=7?'#2278d0':days<=14?'#20916b':days<=30?'#d4a600':'#d24c4c',label:days===0?'Listed today':`${days}d ago`,days};
}
