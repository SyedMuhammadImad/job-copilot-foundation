import {createServerClient,type CookieOptions} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {publicConfig} from '@/lib/config';

export async function proxy(request:NextRequest){
  const configuration=publicConfig();
  if(!configuration)return NextResponse.redirect(new URL('/?setup=required',request.url));
  let response=NextResponse.next({request});
  const writes=new Map<string,{name:string,value:string,options:CookieOptions}>();
  const cacheHeaders:Record<string,string>={'Cache-Control':'private, no-store','Pragma':'no-cache','Expires':'0'};
  function copyState(target:NextResponse){
    for(const cookie of writes.values())target.cookies.set(cookie.name,cookie.value,cookie.options);
    for(const [key,value] of Object.entries(cacheHeaders))target.headers.set(key,value);
    return target;
  }
  const client=createServerClient(configuration.url,configuration.key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(cookies,headers)=>{
      for(const cookie of cookies){request.cookies.set(cookie.name,cookie.value);writes.set(cookie.name,cookie);}
      Object.assign(cacheHeaders,headers);response=copyState(NextResponse.next({request}));
    }
  }});
  let signedIn=false;
  try{const {data,error}=await client.auth.getClaims();signedIn=!error && !!data?.claims?.sub;}catch{signedIn=false;}
  if(!signedIn && request.nextUrl.pathname.startsWith('/dashboard'))return copyState(NextResponse.redirect(new URL('/login',request.url)));
  return copyState(response);
}
export const config={matcher:['/dashboard/:path*','/login']};
