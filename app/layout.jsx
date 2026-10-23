import "./globals.css";

export const metadata = {
  title: "Island Arena — Battle Royale",
  description: "Drop into an original 3D multiplayer survival arena."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
