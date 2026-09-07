import "./globals.css";
export const metadata = {
  title: "Folio — Business workspace",
  description:
    "A clear, simple ERP workspace for your growing business. Frontend prototype.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
