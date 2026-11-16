export function Logo({ sub }: { sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-naranja">
        <i className="fa-solid fa-truck-fast text-texto" />
      </div>
      <div>
        <p className="text-lg leading-none font-extrabold">
          Flete<span className="text-naranja">Ya</span>
        </p>
        {sub && <p className="mt-1 text-[10px] font-semibold tracking-wider text-suave uppercase">{sub}</p>}
      </div>
    </div>
  );
}
