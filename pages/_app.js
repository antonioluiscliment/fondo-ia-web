import { AppConfigProvider } from "../lib/appConfig";

export default function App({ Component, pageProps }) {
  return (
    <AppConfigProvider>
      <Component {...pageProps} />
    </AppConfigProvider>
  );
}
