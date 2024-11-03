import { Inter } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import "@/styles/globals.css";
import { TokenInitializer } from "@/components/TokenInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Web3 Scripts",
  description: "Web3 Scripts Dashboard",
  icons: {
    icon: '/bitcoin.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TokenInitializer />
        <Navigation />
        {children}
      </body>
    </html>
  );
} 