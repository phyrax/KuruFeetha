const YOUTUBE_ID=/^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value:unknown):string|null{
  const input=typeof value==="string"?value.trim():"";
  if(!input)return null;
  if(YOUTUBE_ID.test(input))return input;
  try{
    const url=new URL(/^https?:\/\//i.test(input)?input:`https://${input}`);
    const host=url.hostname.toLowerCase().replace(/^www\./,"");
    let candidate="";
    if(host==="youtu.be")candidate=url.pathname.split("/").filter(Boolean)[0]||"";
    else if(host==="youtube.com"||host==="m.youtube.com"||host==="youtube-nocookie.com"){
      candidate=url.searchParams.get("v")||url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1]||"";
    }
    return YOUTUBE_ID.test(candidate)?candidate:null;
  }catch{return null}
}

export function youtubeEmbedUrl(id:string){return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`}
