interface Props {
  src?: string;
  size?: number;
}

/** Small item icon; renders nothing if the URL is unknown. */
export function ItemIcon({ src, size = 24 }: Props) {
  if (!src) {
    return <span style={{ display: "inline-block", width: size, height: size }} />;
  }
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      style={{ objectFit: "contain", flex: "0 0 auto", verticalAlign: "middle" }}
    />
  );
}
