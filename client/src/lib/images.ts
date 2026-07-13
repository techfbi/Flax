// Inserts a Cloudinary transformation into an existing Cloudinary url,
// resized, auto compressed, auto format. If the url is not a
// Cloudinary url for any reason, returns it unchanged rather than
// producing something broken.
export const toThumbnail = (url: string, size = 48): string => {
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;

  // Requesting twice the display size keeps it sharp on high density
  // screens, still tiny next to the 1024px original. q_auto:good
  // avoids Cloudinary's most aggressive default compression tier.
  const pixelSize = size * 2;
  const insertAt = index + marker.length;
  return `${url.slice(0, insertAt)}w_${pixelSize},h_${pixelSize},c_fill,q_auto:good,f_auto/${url.slice(insertAt)}`;
};