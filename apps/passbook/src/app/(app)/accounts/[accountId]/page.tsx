import { AccountDetailWorkspace } from "~/components/accounts/account-detail-workspace";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <AccountDetailWorkspace accountId={accountId} />
    </main>
  );
}
