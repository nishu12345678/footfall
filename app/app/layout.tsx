import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexProviders } from "@/components/convex-providers";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <ConvexProviders>{children}</ConvexProviders>
    </ConvexAuthNextjsServerProvider>
  );
}
