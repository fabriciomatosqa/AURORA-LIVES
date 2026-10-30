export type Room={id:string;name:string;kind:'text'};
export type Message={id:string;roomId:string;author:string;text:string;createdAt:string};
const ROOT='http://127.0.0.1:8787';
async function call<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await fetch(ROOT+path,{...options,headers:{'Content-Type':'application/json',...options?.headers}});
  if(!response.ok)throw new Error('Erro HTTP '+response.status);
  return response.json() as Promise<T>;
}
export const health=()=>call<{status:string;version:string}>('/api/health');
export const rooms=()=>call<Room[]>('/api/rooms');
export const addRoom=(name:string)=>call<Room>('/api/rooms',{method:'POST',body:JSON.stringify({name})});
export const history=(id:string)=>call<Message[]>('/api/rooms/'+encodeURIComponent(id)+'/messages');
export const publish=(id:string,author:string,text:string)=>call<Message>('/api/rooms/'+encodeURIComponent(id)+'/messages',{method:'POST',body:JSON.stringify({author,text})});
export const stream=(id:string)=>new EventSource(ROOT+'/api/rooms/'+encodeURIComponent(id)+'/events');