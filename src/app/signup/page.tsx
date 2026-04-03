import { redirect } from 'next/navigation';

type SignupPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams.next;
  redirect(nextPath && nextPath.startsWith('/') ? `/?next=${encodeURIComponent(nextPath)}` : '/');
}
