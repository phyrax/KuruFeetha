export function documentLanguageForPath(pathname:string){
  if(pathname.startsWith("/dv/"))return{language:"dv",direction:"rtl" as const};
  if(pathname.startsWith("/en/"))return{language:"en",direction:"ltr" as const};
  return null;
}
