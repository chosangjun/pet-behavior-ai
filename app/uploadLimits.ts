export const MAX_UPLOAD_SIZE_MB = 10;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
export const PHOTO_UPLOAD_LIMIT_LABEL = `${MAX_UPLOAD_SIZE_MB}MB`;

export function isFileTooLarge(file: File) {
  return file.size > MAX_UPLOAD_SIZE_BYTES;
}

export function getPhotoTooLargeMessage() {
  return `사진 용량이 너무 커서 분석할 수 없어요. ${PHOTO_UPLOAD_LIMIT_LABEL} 이하 사진으로 다시 올려주세요.`;
}
