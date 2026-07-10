export function getImageUrl(url: string | null, fallback: string = '/placeholder.png') {
  return url || fallback;
}

export const imageLoaderConfig = (resolverProps: any) => {
  return `${resolverProps.src}?w=${resolverProps.width}&q=${resolverProps.quality || 75}`;
};