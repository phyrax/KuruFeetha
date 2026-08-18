import type {Metadata} from "next";
import {SITE_DESCRIPTION,SITE_NAME,SITE_URL} from "./seo.ts";

type StaticPageMetadata={path:"/"|"/advertise"|"/advertising-policy"|"/political-ads";title:string;description:string};

function metadata({path,title,description}:StaticPageMetadata):Metadata{
  const url=new URL(path,SITE_URL).toString();
  return{title,description,alternates:{canonical:url},openGraph:{title,description,url,siteName:SITE_NAME}};
}

export const homeMetadata=metadata({path:"/",title:`${SITE_NAME} — Maldives, in brief`,description:SITE_DESCRIPTION});
export const advertiseMetadata=metadata({path:"/advertise",title:"Advertise with KuruFeetha",description:"Bilingual sponsorship and brand-studio opportunities for reaching readers across the Maldives."});
export const advertisingPolicyMetadata=metadata({path:"/advertising-policy",title:"Advertising policy — KuruFeetha",description:"KuruFeetha standards for sponsored content, advertiser verification, disclosure, and political advertising."});
export const politicalAdsMetadata=metadata({path:"/political-ads",title:"Political advertising archive — KuruFeetha",description:"Public record of verified political advertising published by KuruFeetha."});
