import { PropertyWorkspace } from "~/components/properties/workspace";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyWorkspace id={id} />;
}
