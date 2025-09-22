// app/_document.tsx ou pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
    return (
        <Html>
            <Head>
                {/* Snippet obrigatório do Google AdSense */}
                <meta name="google-adsense-account" content="ca-pub-3245357129779122"></meta>
                <script
                    async
                    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3245357129779122"
                    crossOrigin="anonymous"
                ></script>
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
