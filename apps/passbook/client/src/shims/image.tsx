import type { ImgHTMLAttributes } from "react";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  unoptimized?: boolean;
  fill?: boolean;
  priority?: boolean;
};

export default function Image({
  src,
  alt,
  width,
  height,
  className,
  style,
  onError,
  ...props
}: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onError={onError}
      {...props}
    />
  );
}
