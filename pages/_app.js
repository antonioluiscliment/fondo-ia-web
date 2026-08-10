import { AppConfigProvider } from "../lib/appConfig";
import { Analytics } from "@vercel/analytics/next";

export default function App({ Component, pageProps }) {
  return (
    <AppConfigProvider>
      <Component {...pageProps} />
      <Analytics />
    </AppConfigProvider>
  );
}
