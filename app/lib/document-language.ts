export function documentLanguageForPath(pathname:string){
  if(pathname.startsWith("/dv/"))return{language:"dv",direction:"rtl" as const};
  if(pathname.startsWith("/en/"))return{language:"en",direction:"ltr" as const};
  return null;
}

export function isHtmlResponse(response:Response){
  return response.headers.get("content-type")?.toLowerCase().includes("text/html")??false;
}

export function shouldTransformDocument(request:Request,response:Response){
  const pathname=new URL(request.url).pathname;
  return request.method==="GET"&&!pathname.startsWith("/api/")&&Boolean(documentLanguageForPath(pathname))&&isHtmlResponse(response);
}
