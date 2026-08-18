import { KuruFeethaApp } from "./components/KuruFeethaApp";
import { HomepageDiscovery } from "./components/HomepageDiscovery.tsx";
import { TransparencyLinks } from "./components/TransparencyPage";
import { homeMetadata } from "./lib/static-page-metadata.ts";

export const dynamic = "force-dynamic";
export const metadata = homeMetadata;

export default function Home() {
  return <><KuruFeethaApp /><HomepageDiscovery/><TransparencyLinks className="public-transparency-footer"/></>;
}
