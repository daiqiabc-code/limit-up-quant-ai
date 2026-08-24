export function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children?: React.ReactNode }) {
  return <div className="mx-auto max-w-[1400px] px-4 py-4 pb-16 md:pb-6">{children}</div>;
}