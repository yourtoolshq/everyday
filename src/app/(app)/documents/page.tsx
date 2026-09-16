import { DocumentsWorkspace } from "~/components/documents/documents-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const documents = await api.documents.overview();
  return <DocumentsWorkspace initialDocuments={documents} />;
}
