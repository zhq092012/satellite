/**
 * 拼接图谱服务根地址和相对路径。
 *
 * @param imgUrl 图谱相对路径
 * @returns `VITE_PICTURE_URL` 与路径直接相接的完整地址
 */
export function getImgServerPath(imgUrl: string) {
  return import.meta.env.VITE_PICTURE_URL + imgUrl
}

/**
 * 拼接多媒体服务根地址和相对路径。
 *
 * @param mediaUrl 多媒体相对路径
 * @returns `VITE_MEDIA_URL` 与路径直接相接的完整地址
 */
export function getMediaServerPath(mediaUrl: string) {
  return import.meta.env.VITE_MEDIA_URL + mediaUrl
}
