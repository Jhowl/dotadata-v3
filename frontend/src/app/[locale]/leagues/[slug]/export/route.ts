import { redirect } from "next/navigation";

const API_PUBLIC = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  redirect(`${API_PUBLIC}/leagues/${encodeURIComponent(slug)}/export.csv`);
}
