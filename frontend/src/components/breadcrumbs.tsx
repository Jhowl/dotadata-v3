import Link from "next/link";

interface BreadcrumbItem {
  title: string;
  url?: string | null;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="flex items-center gap-2">
            {item.url ? (
              <Link href={item.url} className="hover:text-foreground">
                {item.title}
              </Link>
            ) : (
              <span className="text-foreground">{item.title}</span>
            )}
            {index < items.length - 1 ? <span className="text-muted-foreground">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
