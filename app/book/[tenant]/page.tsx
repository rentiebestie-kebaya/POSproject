import PublicBooking from "@/views/PublicBooking";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return <PublicBooking tenantSlug={tenant} />;
}
