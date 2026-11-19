"use client";

import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/PageLoader";

/*
  ssr: false, the app depends on window, storage and an in memory token
  from its first render. The server sends the same full screen spinner
  the app already shows while it verifies the session, so there is no
  visual jump between the server HTML and the mounted app.
*/
const SpaApp = dynamic(() => import("@/spa/SpaApp"), {
  ssr: false,
  loading: () => <PageLoader />,
});

const SpaShell = () => <SpaApp />;

export default SpaShell;
