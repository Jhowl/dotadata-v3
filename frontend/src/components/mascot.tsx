import Image, { type StaticImageData } from "next/image";

import emptyImg from "../../public/mascot/empty.png";
import footerImg from "../../public/mascot/footer.png";
import heroImg from "../../public/mascot/hero.png";
import notFoundImg from "../../public/mascot/not-found.png";
import peekLeftImg from "../../public/mascot/peek-left.png";
import peekRightImg from "../../public/mascot/peek-right.png";
import seasonsImg from "../../public/mascot/seasons.png";

const VARIANTS: Record<MascotVariant, { src: StaticImageData; sizes: string }> = {
  hero: { src: heroImg, sizes: "(min-width: 1280px) 30rem, (min-width: 1024px) 26rem, 0px" },
  peekRight: { src: peekRightImg, sizes: "(min-width: 1024px) 16rem, (min-width: 768px) 14rem, 0px" },
  peekLeft: { src: peekLeftImg, sizes: "(min-width: 1024px) 16rem, (min-width: 768px) 14rem, 0px" },
  empty: { src: emptyImg, sizes: "(min-width: 768px) 10rem, 9rem" },
  notFound: { src: notFoundImg, sizes: "(min-width: 768px) 20rem, 16rem" },
  footer: { src: footerImg, sizes: "(min-width: 1024px) 8rem, (min-width: 768px) 7rem, 0px" },
  seasons: { src: seasonsImg, sizes: "(min-width: 1280px) 15rem, (min-width: 768px) 14rem, 0px" },
};

export type MascotVariant =
  | "hero"
  | "peekRight"
  | "peekLeft"
  | "empty"
  | "notFound"
  | "footer"
  | "seasons";

interface MascotProps {
  variant: MascotVariant;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function Mascot({
  variant,
  className,
  alt = "",
  priority = false,
}: MascotProps) {
  const { src, sizes } = VARIANTS[variant];
  return (
    <Image
      src={src}
      alt={alt}
      sizes={sizes}
      priority={priority}
      placeholder="empty"
      draggable={false}
      className={className}
      aria-hidden={alt === "" ? true : undefined}
    />
  );
}
