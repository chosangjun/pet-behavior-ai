export const MAX_UPLOAD_SIZE_MB = 4;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
export const PHOTO_UPLOAD_LIMIT_LABEL = `${MAX_UPLOAD_SIZE_MB}MB`;

export function isFileTooLarge(file: File) {
  return file.size > MAX_UPLOAD_SIZE_BYTES;
}

export function getPhotoTooLargeMessage() {
  return "사진을 분석하기 좋은 크기로 조정하지 못했어요. 다른 사진으로 다시 시도해 주세요.";
}
