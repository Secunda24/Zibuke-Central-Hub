"use client";
import {useSyncExternalStore} from 'react';
let now=0;
const listeners=new Set<()=>void>();
let timer:ReturnType<typeof setInterval>|undefined;
function subscribe(listener:()=>void){
 listeners.add(listener);
 now=Date.now();
 if(!timer)timer=setInterval(()=>{now=Date.now();listeners.forEach(fn=>fn());},1000);
 return ()=>{listeners.delete(listener);if(!listeners.size){clearInterval(timer);timer=undefined;}};
}
export function useNow(){return useSyncExternalStore(subscribe,()=>now,()=>0);}
