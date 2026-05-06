import { redirect } from "next/navigation";

const API_PUBLIC = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year } = await params;
  redirect(`${API_PUBLIC}/seasons/${encodeURIComponent(year)}/export.csv`);
}
