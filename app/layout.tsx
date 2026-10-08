import "./globals.css";

export const metadata = {
  title: "Job Copilot",
  description: "A private workspace for creating, editing and organizing resume notes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
