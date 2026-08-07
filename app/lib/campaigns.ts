export const campaignStatuses=["draft","internal_review","advertiser_review","approved","active","paused","completed","archived"] as const;
export const campaignPackages=["starter","growth","category_partner","custom"] as const;
export const creativeTypes=["card","full_image","article","gallery","category_partner"] as const;
export function safeHttpUrl(value:string){try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.toString():null}catch{return null}}
export function text(value:unknown,max=500){return typeof value==="string"?value.trim().slice(0,max):""}
export function enumValue<T extends readonly string[]>(value:unknown,values:T,fallback:T[number]){return values.includes(value as T[number])?value as T[number]:fallback}
export function platformFromRequest(request:Request){return /mobile|android|iphone|ipad/i.test(request.headers.get("user-agent")||"")?"mobile":"web"}
