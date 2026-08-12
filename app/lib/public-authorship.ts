export type PublicAuthor={id:string;kind:"person"|"organization";nameEn:string|null;nameDv:string|null;status:"active"|"inactive"};
export type PublicContentType="news"|"opinion"|"editorial"|"press_release";

export function publicAuthorName(author:PublicAuthor,language:"en"|"dv"){
  return (language==="dv"?author.nameDv||author.nameEn:author.nameEn||author.nameDv)?.trim()||"";
}

export function publicAuthorNames(authors:PublicAuthor[],language:"en"|"dv"){
  return authors.map(author=>publicAuthorName(author,language)).filter(Boolean);
}

export function joinedAuthorNames(authors:PublicAuthor[],language:"en"|"dv"){
  const names=publicAuthorNames(authors,language);
  if(names.length<2)return names[0]??"";
  const conjunction=language==="dv"?" އަދި ":" and ";
  return names.length===2?names.join(conjunction):`${names.slice(0,-1).join(", ")},${conjunction}${names.at(-1)}`;
}

export const contentTypeLabels:Record<PublicContentType,string>={news:"News",opinion:"Opinion",editorial:"Editorial",press_release:"Press Release"};
