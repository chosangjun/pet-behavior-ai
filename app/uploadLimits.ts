export const MAX_UPLOAD_SIZE_MB = 4;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
export const PHOTO_UPLOAD_LIMIT_LABEL = `${MAX_UPLOAD_SIZE_MB}MB`;

export function isFileTooLarge(file: File) {
  return file.size > MAX_UPLOAD_SIZE_BYTES;
}

export function getPhotoTooLargeMessage() {
  return "사진 용량이 커서 분석이 중단됐어요. 사진을 한 번 캡처하거나 작은 사진으로 다시 올려주세요.";
}
