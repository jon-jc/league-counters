import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-7 rounded-md",
  sm: "size-9 rounded-lg",
  md: "size-12 rounded-lg",
  lg: "size-16 rounded-xl",
  xl: "size-24 rounded-2xl",
} as const;

export function ChampionAvatar({
  src,
  alt,
  size = "md",
  className,
}: {
  src: string;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = { xs: 28, sm: 36, md: 48, lg: 64, xl: 96 }[size];
  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      /* Data Dragon icons are already small and correctly sized; running them
         through the optimizer costs transforms for no visual gain. */
      unoptimized
      className={cn(
        "shrink-0 border border-line bg-surface-2 object-cover",
        SIZES[size],
        className,
      )}
    />
  );
}
