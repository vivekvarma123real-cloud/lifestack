import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "../components/ThemeToggle";

export const metadata: Metadata = {
  title: "LifeStack",
  description: "Plan Goals. Build Habits. Transform Your Life.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
        <link rel="manifest" href="/manifest.json"/>
        <meta name="theme-color" content="#06060f"/>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', sans-serif", background: "var(--bg)" }}>
        <script dangerouslySetInnerHTML={{__html:`
          (function() {
            try {
              var saved = localStorage.getItem('lifestack-theme') || 'light';
              if (saved === 'dark') { 
                document.documentElement.classList.add('dark-theme'); 
                document.documentElement.removeAttribute('data-theme');
              } else {
                document.documentElement.setAttribute('data-theme', 'light');
              }
            } catch (e) {}
          })();
        `}}/>
        <script dangerouslySetInnerHTML={{__html:`const _ce=console.error.bind(console);console.error=(...a)=>{if(a[0]?.name==="AbortError"||String(a[0]).includes("Lock broken"))return;_ce(...a)};`}}/>
        <script dangerouslySetInnerHTML={{__html:`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('PWA ServiceWorker registered with scope: ', reg.scope);
              }, function(err) {
                console.log('PWA ServiceWorker registration failed: ', err);
              });
            });
          }
        `}}/>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}