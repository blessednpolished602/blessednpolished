// A single animated placeholder block.
// Always pass sizing + rounding via className — e.g.:
//   <Skeleton className="aspect-[4/3] rounded-2xl" />
//   <Skeleton className="h-4 w-2/3 rounded-full" />
export default function Skeleton({ className = "" }) {
    return <div className={`animate-pulse bg-neutral-100 ${className}`} />;
}
