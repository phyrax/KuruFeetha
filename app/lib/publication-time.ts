export function maldivesPublicationTime(value:number,language:"en"|"dv"){
  return new Intl.DateTimeFormat(language==="dv"?"dv-MV":"en-GB",{dateStyle:"long",timeStyle:"short",timeZone:"Indian/Maldives"}).format(new Date(value));
}
