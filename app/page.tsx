"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  MAX_UPLOAD_SIZE_BYTES,
  getPhotoTooLargeMessage,
} from "./uploadLimits";

type ValidationStatus = "idle" | "checking" | "valid" | "invalid";

type BehaviorAnalysis = {
  mood: string;
  signals: string;
  possibleReason: string;
  guardianResponse: string;
  caution: string;
  cuteThought: string;
};

type FollowUpMood = "active" | "tense" | "resting" | "curious" | "alert" | "neutral";

type FollowUpCategory =
  | "distance"
  | "play"
  | "activity"
  | "touch"
  | "calm"
  | "rest"
  | "curiosity"
  | "snack"
  | "guardian"
  | "environment";

const followUpCategoriesByMood: Record<FollowUpMood, FollowUpCategory[]> = {
  active: ["play", "activity", "guardian", "snack", "touch"],
  tense: ["distance", "calm", "environment", "guardian", "touch"],
  resting: ["rest", "touch", "calm", "distance", "guardian"],
  curious: ["curiosity", "environment", "guardian", "activity", "snack"],
  alert: ["distance", "calm", "environment", "touch", "guardian"],
  neutral: ["guardian", "curiosity", "rest", "play", "environment", "distance"],
};

const naturalFollowUpQuestions: Record<FollowUpCategory, string[]> = {
  distance: [
    "조금 더 기다려주는 편이 좋을까요?",
    "한 발짝 물러나 있으면 더 괜찮을까요?",
    "먼저 다가올 때까지 놔둘까요?",
    "지금은 거리를 살짝 두는 게 나을까요?",
    "눈을 덜 마주치면 부담이 줄까요?",
    "가까이 가지 말고 옆에만 있어줄까요?",
    "다가가기보다 가만히 있어도 될까요?",
    "혼자 생각할 시간을 주는 게 좋을까요?",
    "잠깐 모른 척해주면 더 편해질까요?",
    "손을 내밀기 전에 기다려볼까요?",
    "지금은 따라가지 않는 게 나을까요?",
    "먼저 냄새 맡게 두는 게 좋을까요?",
  ],
  play: [
    "지금은 같이 놀아줘도 괜찮을까요?",
    "장난감을 보여주면 좋아할까요?",
    "짧게 놀아주면 기분이 풀릴까요?",
    "공놀이를 해도 신나할 것 같나요?",
    "터그 놀이를 살짝 해봐도 될까요?",
    "먼저 장난감을 흔들어볼까요?",
    "놀자고 부르면 반가워할까요?",
    "가볍게 놀아주면 더 활기날까요?",
    "사냥 놀이처럼 움직여줘도 될까요?",
    "지금 에너지를 조금 빼줘도 좋을까요?",
    "놀이를 시작해도 무리 없을까요?",
    "짧고 신나는 놀이가 맞을까요?",
  ],
  activity: [
    "산책 가면 더 좋아할 것 같나요?",
    "잠깐 바깥 공기를 쐬면 나아질까요?",
    "몸을 조금 움직이면 기분이 바뀔까요?",
    "가벼운 산책을 제안해도 될까요?",
    "실내에서 짧게 움직여볼까요?",
    "조금 걸으면 답답함이 풀릴까요?",
    "활동을 늘리면 더 차분해질까요?",
    "창가 쪽으로 같이 가봐도 될까요?",
    "짧은 놀이 후 쉬게 하면 좋을까요?",
    "평소 루틴대로 움직여도 괜찮을까요?",
    "잠깐 자리 이동을 해볼까요?",
    "기분 전환을 도와주면 좋을까요?",
  ],
  touch: [
    "지금 만져도 괜찮은 분위기일까요?",
    "머리보다 몸 옆을 살짝 만져볼까요?",
    "쓰다듬는 건 나중이 나을까요?",
    "손을 가까이 대도 부담 없을까요?",
    "안아주기보다 옆에 있어줄까요?",
    "턱 밑을 살짝 만져봐도 될까요?",
    "등을 천천히 쓰다듬어도 좋을까요?",
    "만지기 전에 냄새 맡게 해줄까요?",
    "스킨십은 짧게만 하는 게 맞을까요?",
    "지금은 손대지 않는 게 나을까요?",
    "먼저 몸을 기대올 때까지 기다릴까요?",
    "가벼운 쓰다듬음은 괜찮아 보이나요?",
  ],
  calm: [
    "조용한 공간이 더 편할까요?",
    "조금 긴장한 상태에 가까워 보이나요?",
    "불을 살짝 낮추면 안정될까요?",
    "말을 줄이고 있어주면 나을까요?",
    "소리를 줄여주면 덜 예민해질까요?",
    "천천히 숨 고를 시간을 줄까요?",
    "차분한 목소리로 불러볼까요?",
    "담요나 방석을 가까이 둬볼까요?",
    "낯선 자극을 치워주는 게 좋을까요?",
    "지금은 안정감을 먼저 주면 될까요?",
    "편한 자리로 안내해도 괜찮을까요?",
    "조용히 옆에 있어주는 게 맞을까요?",
  ],
  rest: [
    "편하게 쉬게 두는 게 좋을까요?",
    "졸린 신호로 봐도 될까요?",
    "잠깐 낮잠 자게 놔둘까요?",
    "지금은 깨우지 않는 게 나을까요?",
    "쉬는 시간을 더 주면 좋을까요?",
    "담요를 덮어주면 싫어하지 않을까요?",
    "눕기 좋은 자리를 만들어줄까요?",
    "놀자고 부르지 않는 게 맞을까요?",
    "가만히 쉬고 싶은 마음일까요?",
    "휴식 모드로 봐도 괜찮을까요?",
    "조용히 자리를 비켜줄까요?",
    "오늘은 무리하지 않는 게 좋을까요?",
  ],
  curiosity: [
    "낯선 냄새를 궁금해하는 걸까요?",
    "새로운 소리에 관심이 생긴 걸까요?",
    "스스로 확인하게 두면 좋을까요?",
    "조금 더 탐색하게 놔둘까요?",
    "처음 보는 물건이 신경 쓰이나요?",
    "주변을 알아보는 중일까요?",
    "가까이 가서 냄새 맡고 싶은 걸까요?",
    "궁금해서 멈춰 있는 걸까요?",
    "확인할 시간을 주는 게 좋을까요?",
    "낯설지만 관심은 있는 걸까요?",
    "먼저 살펴보게 두면 괜찮을까요?",
    "호기심이 더 큰 상태로 보이나요?",
  ],
  snack: [
    "간식을 조금 줘도 괜찮을까요?",
    "배고파서 관심을 보이는 걸까요?",
    "사료 시간을 기다리는 걸까요?",
    "간식보다 물을 먼저 챙겨볼까요?",
    "먹을 걸 기대하는 눈빛일까요?",
    "작은 보상 간식이 도움이 될까요?",
    "지금 간식으로 달래도 될까요?",
    "밥그릇 쪽을 확인해볼까요?",
    "훈련 간식을 꺼내면 집중할까요?",
    "배가 고픈 신호일 수도 있을까요?",
    "먹는 것보다 관심이 필요한 걸까요?",
    "간식은 조금만 주는 게 맞을까요?",
  ],
  guardian: [
    "지금은 관심을 받고 싶은 걸까요?",
    "보호자 반응을 기다리는 걸까요?",
    "이름을 부르면 좋아할까요?",
    "눈을 맞추고 말 걸어도 될까요?",
    "옆에 앉아 있으면 안심할까요?",
    "칭찬해주면 더 좋아질까요?",
    "제가 먼저 다가가도 될까요?",
    "가볍게 말을 걸면 반응할까요?",
    "보호자를 확인하려는 모습일까요?",
    "안심시키는 말이 도움이 될까요?",
    "관심을 조금 더 줘도 괜찮을까요?",
    "혼자 두기보다 함께 있어줄까요?",
  ],
  environment: [
    "낯선 장소라 조심하는 걸까요?",
    "주변 소리가 신경 쓰이는 걸까요?",
    "공간을 조금 정리해주면 좋을까요?",
    "익숙한 물건을 곁에 둬볼까요?",
    "새로운 환경에 적응하는 중일까요?",
    "사람이 적은 곳이 더 나을까요?",
    "문 쪽 움직임을 신경 쓰는 걸까요?",
    "바닥 느낌이 어색한 걸까요?",
    "냄새가 바뀌어서 확인하는 걸까요?",
    "조용한 방으로 옮겨볼까요?",
    "익숙한 자리로 데려가도 될까요?",
    "환경이 바뀐 게 영향을 준 걸까요?",
  ],
};

const riskSignalKeywords = [
  "통증",
  "고통",
  "힘들",
  "아파",
  "아프",
  "아픔",
  "부상",
  "상처",
  "호흡",
  "숨",
  "절뚝",
  "구토",
  "무기력",
  "공격",
  "공격성",
  "으르렁",
  "물려고",
  "물림",
  "위험",
  "섭취",
  "동물병원",
  "병원",
  "극심한 긴장",
  "극심한 스트레스",
  "극도",
  "강한 긴장",
  "심한 긴장",
];

function getFollowUpPlaceholder(
  analysis?: BehaviorAnalysis | null,
  recentPlaceholders: string[] = [],
) {
  const mood = getFollowUpMood(analysis);
  const candidates = buildFollowUpCandidates(mood, analysis);
  const freshCandidates = candidates.filter(
    (candidate) => !isRecentlyUsedPlaceholder(candidate, recentPlaceholders),
  );
  const source = freshCandidates.length > 0 ? freshCandidates : candidates;

  return source[Math.floor(Math.random() * source.length)] ?? "지금은 기다려주는 게 나을까요?";
}

function getFollowUpMood(analysis?: BehaviorAnalysis | null): FollowUpMood {
  if (!analysis) return "neutral";

  const text = getAnalysisText(analysis);
  const scores: Record<FollowUpMood, number> = {
    active: scoreText(text, ["활발", "신나", "즐거", "놀이", "놀고", "장난", "흥미", "흥분", "에너지", "꼬리 흔들"]),
    tense: scoreText(text, ["긴장", "불안", "낯설", "조심", "주저", "움츠", "놀람", "스트레스", "불편"]),
    resting: scoreText(text, ["휴식", "쉬", "졸", "잠", "편안", "차분", "느긋", "늘어", "안정"]),
    curious: scoreText(text, ["호기심", "궁금", "탐색", "살피", "관심", "냄새", "확인", "쳐다", "주시"]),
    alert: scoreText(text, ["경계", "예민", "으르렁", "공격", "물려고", "위협", "하악", "귀가 뒤", "꼬리 낮"]),
    neutral: 0,
  };

  if (hasRiskSignal(analysis) || scores.alert > 0) return "alert";
  if (scores.tense > 0 && scores.tense >= scores.active) return "tense";

  const moods: FollowUpMood[] = ["active", "resting", "curious", "tense"];
  return moods.reduce<FollowUpMood>(
    (best, mood) => (scores[mood] > scores[best] ? mood : best),
    "neutral",
  );
}

function buildFollowUpCandidates(
  mood: FollowUpMood,
  analysis?: BehaviorAnalysis | null,
) {
  const analysisText = analysis ? normalizeQuestionText(getAnalysisText(analysis)) : "";
  const categories = followUpCategoriesByMood[mood];
  const fallbackCategories = mood === "neutral" ? [] : followUpCategoriesByMood.neutral;
  const candidates = [...categories, ...fallbackCategories].flatMap((category) =>
    naturalFollowUpQuestions[category].map(normalizeQuestion),
  );
  const deduped = [...new Set(candidates)].filter(
    (candidate) =>
      !isDuplicateWithAnalysis(candidate, analysisText) &&
      !isTooSimilarToAnalysis(candidate, analysisText) &&
      isNaturalFollowUpPlaceholder(candidate),
  );

  return shuffleItems(deduped.length > 0 ? deduped : candidates);
}

function scoreText(text: string, keywords: string[]) {
  return keywords.reduce(
    (score, keyword) => score + (text.includes(keyword) ? 1 : 0),
    0,
  );
}

function normalizeQuestion(question: string) {
  return polishFollowUpQuestion(
    question
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.])/g, "$1")
    .replace(/\?+/g, "?")
    .replace(/게이/g, "게")
    .replace(/게\s+이/g, "게")
    .replace(/거이/g, "거")
    .replace(/걸 까요/g, "걸까요")
    .replace(/될 까요/g, "될까요")
    .replace(/좋을 까요/g, "좋을까요")
    .replace(/나을 까요/g, "나을까요")
    .replace(/보면 될까요/g, "봐도 될까요")
    .trim(),
  );
}

function polishFollowUpQuestion(question: string) {
  const simplified = simplifyAwkwardQuestionPhrases(question);
  const withoutRepeatedWords = removeRepeatedQuestionWords(simplified);
  const withoutRepeatedContext = removeRepeatedConditionalContext(
    withoutRepeatedWords,
  );
  const shortened = shortenLongQuestion(withoutRepeatedContext);

  return shortened
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.])/g, "$1")
    .replace(/\?+/g, "?")
    .replace(/게이/g, "게")
    .replace(/게\s+이/g, "게")
    .replace(/([가-힣]+)(은는|는은|이가|가이|을를|를을)/g, "$1")
    .trim();
}

function isNaturalFollowUpPlaceholder(question: string) {
  if (awkwardPlaceholderPhrases.some((phrase) => question.includes(phrase))) {
    return false;
  }

  const words = getMeaningfulQuestionWords(question);
  const uniqueWords = new Set(words);

  return uniqueWords.size >= Math.min(words.length, 3);
}

function simplifyAwkwardQuestionPhrases(question: string) {
  return question
    .replace(/주는 편이/g, "주는 게")
    .replace(/두는 편이/g, "두는 게")
    .replace(/가는 편이/g, "가는 게")
    .replace(/보는 편이/g, "보는 게")
    .replace(/움직이는 편이/g, "움직이는 게")
    .replace(/걸어보는 편이/g, "걸어보는 게")
    .replace(/해주는 것이/g, "해주는 게")
    .replace(/하는 것이/g, "하는 게")
    .replace(/두는 것이/g, "두는 게")
    .replace(/주는 것이/g, "주는 게")
    .replace(/두는 게이/g, "두는 게")
    .replace(/보는 게이/g, "보는 게")
    .replace(/가는 게이/g, "가는 게")
    .replace(/주는 게이/g, "주는 게")
    .replace(/상태일까요/g, "상태로 볼까요")
    .replace(/타이밍일까요/g, "좋을까요");
}

function removeRepeatedQuestionWords(question: string) {
  const softRepeatedWords = new Set([
    "조금",
    "천천히",
    "잠깐",
    "가볍게",
    "부드럽게",
    "편하게",
  ]);
  const seenWords = new Set<string>();

  return question
    .split(" ")
    .filter((word) => {
      const normalizedWord = word.replace(/[?!.~,]/g, "");
      if (!softRepeatedWords.has(normalizedWord)) return true;
      if (seenWords.has(normalizedWord)) return false;
      seenWords.add(normalizedWord);
      return true;
    })
    .join(" ");
}

function removeRepeatedConditionalContext(question: string) {
  const match = question.match(/^(.+?(?:라면|이면|때|에서는|보면))\s+(.+)$/);
  if (!match) return question;

  const [, condition, mainQuestion] = match;
  const conditionWords = getMeaningfulQuestionWords(condition);
  const mainWords = getMeaningfulQuestionWords(mainQuestion);
  const hasRepeatedContext = mainWords.some((word) =>
    conditionWords.includes(word),
  );

  return hasRepeatedContext && mainQuestion.length >= 10
    ? mainQuestion
    : question;
}

function shortenLongQuestion(question: string) {
  if (getReadableQuestionLength(question) <= 28) return question;

  const match = question.match(/^.+?(?:라면|이면|때|에서는|보면)\s+(.+)$/);
  const mainQuestion = match?.[1];

  return mainQuestion && mainQuestion.length >= 10 ? mainQuestion : question;
}

function getMeaningfulQuestionWords(text: string) {
  return text
    .replace(/[?!.~,]/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/(을|를|이|가|은|는|에|에서|으로|로|만|도)$/, ""))
    .filter((word) => word.length >= 2);
}

function getReadableQuestionLength(text: string) {
  return text.replace(/\s/g, "").length;
}

function normalizeQuestionText(text: string) {
  return text.replace(/\s+/g, "").replace(/[?!.~,]/g, "");
}

function isDuplicateWithAnalysis(candidate: string, analysisText: string) {
  if (!analysisText) return false;

  const normalizedCandidate = normalizeQuestionText(candidate);
  return (
    normalizedCandidate.length > 8 &&
    analysisText.includes(normalizedCandidate)
  );
}

function isTooSimilarToAnalysis(candidate: string, analysisText: string) {
  if (!analysisText) return false;

  const candidateWords = getMeaningfulQuestionWords(candidate);
  if (candidateWords.length < 4) return false;

  const overlapCount = candidateWords.filter((word) =>
    analysisText.includes(normalizeQuestionText(word)),
  ).length;

  return overlapCount >= 4 && overlapCount / candidateWords.length >= 0.75;
}

function isRecentlyUsedPlaceholder(
  candidate: string,
  recentPlaceholders: string[],
) {
  return recentPlaceholders.some(
    (recent) =>
      candidate === recent || getPlaceholderSimilarity(candidate, recent) >= 0.42,
  );
}

function getPlaceholderSimilarity(first: string, second: string) {
  const firstWords = new Set(getPlaceholderSimilarityWords(first));
  const secondWords = new Set(getPlaceholderSimilarityWords(second));
  const union = new Set([...firstWords, ...secondWords]);
  if (union.size === 0) return 0;

  const sharedCount = [...firstWords].filter((word) => secondWords.has(word)).length;
  return sharedCount / union.size;
}

function getPlaceholderSimilarityWords(text: string) {
  const weakWords = new Set([
    "지금",
    "조금",
    "살짝",
    "먼저",
    "더",
    "있는",
    "하는",
    "주는",
    "두는",
    "좋을",
    "나을",
    "괜찮",
    "될까",
    "까요",
  ]);

  return getMeaningfulQuestionWords(text)
    .map((word) =>
      word
        .replace(/(할까요|볼까요|될까요|일까요|까요|나요|어요|해도|줘도|하면|으로|처럼|까지)$/g, "")
        .replace(/(해주|해볼|봐도|두면|두는|주는|주면)$/g, ""),
    )
    .filter((word) => word.length >= 2 && !weakWords.has(word));
}

function hasSafetyCaution(analysis: BehaviorAnalysis) {
  return analysis.caution.trim().length > 0;
}

function hasRiskSignal(analysis: BehaviorAnalysis) {
  const text = getAnalysisText(analysis);
  return riskSignalKeywords.some((keyword) => text.includes(keyword));
}

function getAnalysisText(analysis: BehaviorAnalysis) {
  return [
    analysis.mood,
    analysis.signals,
    analysis.possibleReason,
    analysis.guardianResponse,
    analysis.caution,
    analysis.cuteThought,
  ].join(" ");
}

function shuffleItems<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

const PHOTO_TOO_LARGE_MESSAGE =
  getPhotoTooLargeMessage();

const COMPRESSED_IMAGE_TARGET_BYTES = Math.floor(MAX_UPLOAD_SIZE_BYTES * 0.9);
const IMAGE_COMPRESSION_STEPS = [
  { maxDimension: 1536, quality: 0.84 },
  { maxDimension: 1536, quality: 0.76 },
  { maxDimension: 1360, quality: 0.76 },
  { maxDimension: 1280, quality: 0.7 },
  { maxDimension: 1120, quality: 0.68 },
  { maxDimension: 960, quality: 0.64 },
];

const GENERAL_ANALYSIS_ERROR_MESSAGE =
  "사진을 분석하는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";

const FOLLOW_UP_VALIDATION_MESSAGE =
  "사진 속 반려동물과 관련된 질문을 입력해 주세요.";

const MEANINGLESS_FOLLOW_UP_MESSAGE =
  FOLLOW_UP_VALIDATION_MESSAGE;

const awkwardPlaceholderPhrases = [
  "말 줄",
  "주는 편",
  "두는 편",
  "가는 편",
  "보는 편",
  "움직이는 편",
];

function isPayloadTooLargeError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("request entity too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("413")
  );
}

function getFriendlyAnalysisError(message: string) {
  if (isPayloadTooLargeError(message)) {
    return PHOTO_TOO_LARGE_MESSAGE;
  }

  return GENERAL_ANALYSIS_ERROR_MESSAGE;
}

async function readApiPayload<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const responseText = await response.text();
  const responseSummary = `${response.status} ${response.statusText} ${responseText}`;

  if (isPayloadTooLargeError(responseSummary)) {
    throw new Error(PHOTO_TOO_LARGE_MESSAGE);
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function getFollowUpValidationError(question: string) {
  const normalized = normalizeFollowUpQuestion(question);

  if (isMeaninglessFollowUpQuestion(normalized)) {
    return MEANINGLESS_FOLLOW_UP_MESSAGE;
  }

  return null;
}

function normalizeFollowUpQuestion(question: string) {
  return question.replace(/\s+/g, " ").trim();
}

function isMeaninglessFollowUpQuestion(question: string) {
  const compact = question.replace(/\s/g, "");
  const lowerCompact = compact.toLowerCase();

  if (compact.length < 2) return true;
  if (/^[ㄱ-ㅎㅏ-ㅣㅋㅎㅠㅜㅡ\s?!.]+$/.test(question)) return true;
  if (/^[a-z]+$/.test(lowerCompact)) return true;
  if (/^(.)\1{3,}$/.test(compact)) return true;
  if (/^(.{2,6})\1+$/.test(lowerCompact)) return true;
  if (/([ㅋㅎㅠㅜㅡ])\1{2,}/.test(compact)) return true;
  if (!/[가-힣a-zA-Z0-9]/.test(compact)) return true;

  return false;
}

function getFriendlyFollowUpError(message: string) {
  if (isPayloadTooLargeError(message)) {
    return PHOTO_TOO_LARGE_MESSAGE;
  }

  if (
    message.includes("기존 분석 결과") ||
    message.includes("analysis") ||
    message.includes("분석 결과 정보")
  ) {
    return "분석 결과를 다시 불러오는 중 문제가 발생했어요. 다시 분석 후 질문해 주세요.";
  }

  return message || "질문을 이어가는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [isSavingShareCard, setIsSavingShareCard] = useState(false);
  const [shareCardMessage, setShareCardMessage] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("idle");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [hasAskedFollowUp, setHasAskedFollowUp] = useState(false);
  const [recentFollowUpPlaceholders, setRecentFollowUpPlaceholders] = useState<
    string[]
  >([]);
  const [followUpPlaceholder, setFollowUpPlaceholder] = useState(
    getFollowUpPlaceholder(),
  );
  const uploadRequestIdRef = useRef(0);

  const refreshFollowUpPlaceholder = (nextAnalysis?: BehaviorAnalysis | null) => {
    const nextPlaceholder = getFollowUpPlaceholder(
      nextAnalysis,
      recentFollowUpPlaceholders,
    );
    setFollowUpPlaceholder(nextPlaceholder);
    setRecentFollowUpPlaceholders((recent) =>
      [nextPlaceholder, ...recent].slice(0, 24),
    );
  };

  const resetFollowUpState = () => {
    setFollowUpQuestion("");
    setFollowUpAnswer(null);
    setFollowUpError(null);
    setIsAskingFollowUp(false);
    setHasAskedFollowUp(false);
    refreshFollowUpPlaceholder();
  };

  const resetPhotoState = () => {
    uploadRequestIdRef.current += 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadedFile(null);
    setAnalysis(null);
    setErrorMessage(null);
    setIsShareCardOpen(false);
    setShareCardMessage(null);
    setIsPreparingPhoto(false);
    setValidationStatus("idle");
    setValidationMessage(null);
    resetFollowUpState();
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const uploadRequestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = uploadRequestId;
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(URL.createObjectURL(file));
    setUploadedFile(null);
    setAnalysis(null);
    setErrorMessage(null);
    setIsShareCardOpen(false);
    setShareCardMessage(null);
    setIsPreparingPhoto(true);
    setValidationStatus("checking");
    setValidationMessage("사진을 분석하기 좋은 크기로 조정하고 있어요...");
    resetFollowUpState();

    try {
      const optimizedFile = await optimizeImageForApi(file);
      if (uploadRequestIdRef.current !== uploadRequestId) return;

      setPreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
        return URL.createObjectURL(optimizedFile);
      });
      setUploadedFile(optimizedFile);
      setValidationStatus("idle");
      setValidationMessage(null);
    } catch (error) {
      if (uploadRequestIdRef.current !== uploadRequestId) return;

      setUploadedFile(null);
      setValidationStatus("invalid");
      setValidationMessage(
        error instanceof Error
          ? error.message
          : "사진을 분석하기 좋은 크기로 조정하지 못했어요. 다른 사진으로 다시 시도해 주세요.",
      );
    } finally {
      if (uploadRequestIdRef.current === uploadRequestId) {
        setIsPreparingPhoto(false);
      }
    }
  };

  const startAnalysis = async () => {
    if (
      !uploadedFile ||
      isPreparingPhoto ||
      isAnalyzing ||
      validationStatus !== "valid"
    ) {
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysis(null);
    setIsShareCardOpen(false);
    setShareCardMessage(null);
    resetFollowUpState();

    try {
      const formData = new FormData();
      formData.append("image", uploadedFile);

      const response = await fetch("/api/analyze-pet", {
        method: "POST",
        body: formData,
      });

      const payload = await readApiPayload<{
        analysis?: BehaviorAnalysis;
        error?: string;
      }>(response, GENERAL_ANALYSIS_ERROR_MESSAGE);

      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error ?? GENERAL_ANALYSIS_ERROR_MESSAGE);
      }

      setAnalysis(payload.analysis);
      refreshFollowUpPlaceholder(payload.analysis);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? getFriendlyAnalysisError(error.message)
          : GENERAL_ANALYSIS_ERROR_MESSAGE,
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveShareCard = async () => {
    if (!analysis || !previewUrl || isSavingShareCard) return;

    setIsSavingShareCard(true);
    setShareCardMessage(null);

    try {
      const blob = await createShareCardImageBlob(previewUrl, analysis);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `momentpet-result-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setShareCardMessage("공유용 카드가 저장되었어요.");
    } catch (error) {
      console.error("Failed to save share card.", error);
      setShareCardMessage("저장 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSavingShareCard(false);
    }
  };

  const askFollowUpQuestion = async () => {
    if (!analysis) {
      console.error("Follow-up question blocked: analysis state is empty.", {
        analysis,
        uploadedFileName: uploadedFile?.name,
        followUpQuestion,
      });
      setFollowUpError(
        "분석 결과를 다시 불러오는 중 문제가 발생했어요. 다시 분석 후 질문해 주세요.",
      );
      return;
    }

    if (
      !uploadedFile ||
      isPreparingPhoto ||
      hasAskedFollowUp ||
      isAskingFollowUp ||
      !followUpQuestion.trim()
    ) {
      return;
    }

    const validationError = getFollowUpValidationError(followUpQuestion);
    if (validationError) {
      setFollowUpError(validationError);
      setFollowUpAnswer(null);
      return;
    }

    setIsAskingFollowUp(true);
    setFollowUpError(null);
    setFollowUpAnswer(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadedFile);
      formData.append("question", followUpQuestion.trim());
      const serializedAnalysis = JSON.stringify(analysis);
      formData.append("analysis", serializedAnalysis);
      formData.append("recommendations", serializedAnalysis);
      formData.append("recommendationResults", serializedAnalysis);

      console.debug("Sending follow-up question payload.", {
        question: followUpQuestion.trim(),
        analysis,
        serializedAnalysis,
      });

      const response = await fetch("/api/follow-up-question", {
        method: "POST",
        body: formData,
      });

      const payload = await readApiPayload<{
        answer?: string;
        error?: string;
        isRelated?: boolean;
      }>(
        response,
        "분석 결과를 다시 불러오는 중 문제가 발생했어요. 다시 분석 후 질문해 주세요.",
      );

      if (payload.error) {
        console.error("Follow-up question API returned an error.", {
          status: response.status,
          error: payload.error,
          payload,
          analysis,
        });
        throw new Error(payload.error);
      }

      if (!response.ok || !payload.answer) {
        console.error("Follow-up question API returned an invalid payload.", {
          status: response.status,
          payload,
          analysis,
        });
        throw new Error(
          "분석 결과를 다시 불러오는 중 문제가 발생했어요. 다시 분석 후 질문해 주세요.",
        );
      }

      setFollowUpAnswer(payload.answer);
      setHasAskedFollowUp(true);
    } catch (error) {
      setFollowUpError(
        error instanceof Error
          ? getFriendlyFollowUpError(error.message)
          : "질문을 이어가는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!uploadedFile) return;

    const allowedTypes = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);

    let isCancelled = false;

    const validateImage = async () => {
      if (!allowedTypes.has(uploadedFile.type)) {
        setValidationStatus("invalid");
        setValidationMessage("JPG, PNG, WEBP 형식의 반려동물 사진을 올려주세요.");
        return;
      }

      setValidationStatus("checking");
      setValidationMessage("사진 속 반려동물을 확인하고 있습니다...");

      try {
        const formData = new FormData();
        formData.append("image", uploadedFile);

        const response = await fetch("/api/validate-pet", {
          method: "POST",
          body: formData,
        });

        const payload = await readApiPayload<{
          isValid?: boolean;
          reason?: string;
          error?: string;
        }>(response, "이미지 확인에 실패했습니다.");

        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(payload.error ?? "이미지 확인에 실패했습니다.");
        }

        if (payload.isValid) {
          setValidationStatus("valid");
          setValidationMessage("분석 가능한 반려동물 사진으로 확인했습니다.");
          return;
        }

        setValidationStatus("invalid");
        setValidationMessage(
          payload.reason ?? "반려동물 사진인지 확인하기 어려웠어요.",
        );
      } catch (error) {
        if (isCancelled) return;
        setValidationStatus("invalid");
        setValidationMessage(
          error instanceof Error
            ? isPayloadTooLargeError(error.message)
              ? PHOTO_TOO_LARGE_MESSAGE
              : error.message
            : "반려동물 사진인지 확인하기 어려웠어요.",
        );
      }
    };

    void validateImage();

    return () => {
      isCancelled = true;
    };
  }, [uploadedFile]);

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-5 text-stone-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <section className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_-18px_rgba(68,64,60,0.55)] ring-1 ring-stone-200">
          <h1 className="text-[1.8rem] font-bold leading-tight tracking-normal text-teal-700">
            MomentPet
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            반려동물 사진 속 자세와 표정, 주변 상황을 바탕으로 현재 어떤
            상태에 가까워 보이는지와 보호자가 취할 수 있는 반응을
            알려드립니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_-18px_rgba(68,64,60,0.55)] ring-1 ring-stone-200">
          <h2 className="text-base font-semibold">사진 업로드</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            반려동물의 몸 전체나 얼굴, 꼬리, 귀, 주변 상황이 함께 보이면 더
            구체적으로 분석할 수 있습니다.
          </p>
          <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-800">
            업로드한 사진은 분석에만 사용되며 별도로 저장되지 않습니다.
          </p>

          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm font-semibold text-stone-700 transition hover:border-teal-500 hover:bg-teal-50">
            사진 촬영 또는 선택
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="sr-only"
            />
          </label>

          <div className="mt-4 overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setModalImageUrl(previewUrl)}
                className="group flex h-72 max-h-[62vh] w-full cursor-pointer items-center justify-center overflow-hidden"
              >
                <img
                  src={previewUrl}
                  alt="업로드한 반려동물 사진"
                  className="h-full w-full object-contain object-center transition duration-300 group-hover:scale-[1.02]"
                />
              </button>
            ) : (
              <div className="flex h-72 max-h-[62vh] items-center justify-center px-5 text-center text-sm text-stone-500">
                아직 선택한 사진이 없습니다.
              </div>
            )}
          </div>

          {previewUrl ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={resetPhotoState}
                className="rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 active:scale-[0.98]"
              >
                사진 제거
              </button>
              <label className="cursor-pointer rounded-xl bg-stone-200 px-4 py-3 text-center text-sm font-semibold text-stone-800 transition hover:bg-stone-300 active:scale-[0.98]">
                다른 사진 촬영 또는 선택
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="sr-only"
                />
              </label>
            </div>
          ) : null}

          {validationMessage ? (
            <p
              className={`mt-3 text-xs ${
                validationStatus === "invalid"
                  ? "text-rose-600"
                  : validationStatus === "valid"
                    ? "text-teal-700"
                    : "text-stone-500"
              }`}
            >
              {validationMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_-18px_rgba(68,64,60,0.55)] ring-1 ring-stone-200">
          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={
              !uploadedFile ||
              isPreparingPhoto ||
              isAnalyzing ||
              validationStatus !== "valid"
            }
            className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {isPreparingPhoto
              ? "사진 준비 중..."
              : isAnalyzing
                ? "행동 분석 중..."
              : "분석 시작하기"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            사진을 바탕으로 반려동물 행동을 가볍게 해석해드려요.
            <br />
            사진 기반 해석이라 실제 상태와는 다를 수 있으며, 수의학적 진단
            용도는 아닙니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_-18px_rgba(68,64,60,0.55)] ring-1 ring-stone-200">
          <h2 className="text-base font-semibold">분석 결과</h2>
          <div className="mt-3">
            {!previewUrl ? (
              <EmptyResult text="먼저 반려동물 사진을 올려주세요." />
            ) : isPreparingPhoto || isAnalyzing ? (
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-teal-700" />
                <p className="text-sm text-stone-600">
                  {isPreparingPhoto
                    ? "사진을 분석하기 좋은 크기로 조정하고 있어요..."
                    : "자세, 표정, 상황 단서를 살펴보고 있습니다..."}
                </p>
              </div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : analysis ? (
              <>
                <div className="grid gap-3">
                  <ResultCard title="지금 이런 상태 같아요" content={analysis.mood} />
                  <ResultCard title="사진에서는 이렇게 보여요" content={analysis.signals} />
                  <ResultCard title="이럴 때 자주 그래요" content={analysis.possibleReason} />
                  <ResultCard title="이렇게 해주면 좋아요" content={analysis.guardianResponse} />
                  <ResultCard
                    title="이런 생각일지도"
                    content={`"${stripWrappingQuotes(analysis.cuteThought)}"`}
                  />
                  {hasSafetyCaution(analysis) ? (
                    <ResultCard title="참고하면 좋아요" content={analysis.caution} tone="warning" />
                  ) : null}
                </div>

                <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                  <p className="text-sm font-semibold text-teal-900">
                    오늘의 순간을 카드로 남겨보세요.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-teal-800/80">
                    긴 분석 대신 사진과 핵심 분위기만 담은 공유용 요약 카드로 만들어드려요.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShareCardMessage(null);
                      setIsShareCardOpen(true);
                    }}
                    className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 active:scale-[0.98]"
                  >
                    공유용 카드 만들기
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <h3 className="text-sm font-semibold text-stone-900">
                    추가 질문 1회
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    분석 결과와 사진에 대해 한 번 더 물어볼 수 있습니다.
                  </p>
                  <textarea
                    value={followUpQuestion}
                    onChange={(event) => setFollowUpQuestion(event.target.value)}
                    disabled={isPreparingPhoto || hasAskedFollowUp || isAskingFollowUp}
                    rows={3}
                    placeholder={followUpPlaceholder}
                    className="mt-3 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                  />
                  <button
                    type="button"
                    onClick={askFollowUpQuestion}
                    disabled={
                      isPreparingPhoto ||
                      hasAskedFollowUp ||
                      isAskingFollowUp ||
                      !followUpQuestion.trim()
                    }
                    className="mt-2 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {isAskingFollowUp ? "답변 준비 중..." : "질문하기"}
                  </button>
                  {followUpError ? (
                    <p className="mt-3 text-xs text-rose-600">{followUpError}</p>
                  ) : null}
                  {followUpAnswer ? (
                    <div className="mt-3 rounded-xl border border-teal-100 bg-white p-3 text-sm leading-relaxed text-stone-700">
                      {followUpAnswer}
                    </div>
                  ) : null}
                  {hasAskedFollowUp ? (
                    <p className="mt-3 text-xs text-stone-500">
                      추가 질문은 1회 사용했습니다.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <EmptyResult text="분석 시작하기를 누르면 결과가 표시됩니다." />
            )}
          </div>
        </section>
      </div>

      <footer className="mx-auto mt-6 w-full max-w-md pb-1 text-center text-[11px] text-stone-400">
        Created by Sangjun
      </footer>

      {modalImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-stone-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">업로드 이미지</p>
              <button
                type="button"
                onClick={() => setModalImageUrl(null)}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800 hover:text-white"
              >
                닫기
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-stone-900">
              <img
                src={modalImageUrl}
                alt="확대한 업로드 이미지"
                className="h-[72vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      {isShareCardOpen && analysis && previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/60 p-4">
          <div className="my-auto w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_24px_54px_-28px_rgba(28,25,23,0.9)] ring-1 ring-stone-200">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-stone-950">
                  공유용 결과 카드
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  사진과 분석 분위기를 짧게 담았어요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareCardOpen(false)}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                닫기
              </button>
            </div>

            <ShareResultCard analysis={analysis} imageUrl={previewUrl} />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={saveShareCard}
                disabled={isSavingShareCard}
                className="rounded-xl bg-teal-700 px-3 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isSavingShareCard ? "저장 중..." : "저장하기"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setShareCardMessage("공유 기능은 곧 연결될 예정이에요.")
                }
                className="rounded-xl bg-stone-100 px-3 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-200"
              >
                공유하기
              </button>
            </div>

            {shareCardMessage ? (
              <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">
                {shareCardMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isConfirmModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_20px_40px_-24px_rgba(28,25,23,0.8)] ring-1 ring-stone-200">
            <h3 className="text-base font-semibold text-stone-950">
              이 사진으로 분석할까요?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              사진은 저장하지 않고 분석에만 사용됩니다.
              <br />
              결과는 사진 기반 행동 해석 예시이며 상황에 따라 달라질 수 있습니다.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsConfirmModalOpen(false);
                  await startAnalysis();
                }}
                className="rounded-xl bg-teal-700 px-3 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                시작
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-xl bg-stone-100 px-3 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function EmptyResult({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
      {text}
    </div>
  );
}

function ResultCard({
  title,
  content,
  tone = "default",
}: {
  title: string;
  content: string;
  tone?: "default" | "warning";
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-stone-200 bg-stone-50"
      }`}
    >
      <h3
        className={`text-xs font-semibold ${
          tone === "warning" ? "text-amber-800" : "text-teal-700"
        }`}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-700">{content}</p>
    </article>
  );
}

function ShareResultCard({
  analysis,
  imageUrl,
}: {
  analysis: BehaviorAnalysis;
  imageUrl: string;
}) {
  const summary = getShareSummary(analysis);
  const moodLabel = getShareMoodLabel(analysis);
  const aside = getShareAside(analysis);

  return (
    <article className="mx-auto aspect-[4/5.4] w-full max-w-[320px] overflow-hidden rounded-[1.75rem] bg-[#f8efe3] p-4 shadow-[0_18px_40px_-28px_rgba(68,64,60,0.85)] ring-1 ring-stone-200">
      <div className="flex h-full flex-col rounded-[1.35rem] bg-white/80 p-3 ring-1 ring-white">
        <div className="relative aspect-[1/1.16] overflow-hidden rounded-[1.15rem] bg-[#f5f1e8]">
          <img
            src={imageUrl}
            alt="공유용 결과 카드 반려동물 사진"
            className="h-full w-full object-contain"
            style={{ objectPosition: SHARE_CARD_IMAGE_POSITION }}
          />
        </div>
        <div className="flex flex-1 flex-col justify-between px-1 pb-1 pt-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">{moodLabel}</p>
            <p
              className="mt-2 overflow-hidden text-[1.12rem] font-bold leading-snug text-stone-900"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {summary}
            </p>
            {aside ? (
              <p
                className="mt-3 overflow-hidden text-xs italic leading-relaxed text-stone-500"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {aside}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3">
            <div className="flex items-center gap-2">
              <PawJellyIcon />
              <span className="text-sm font-bold text-teal-700">MomentPet</span>
            </div>
            <span className="text-[11px] font-medium text-stone-400">
              pet mood note
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function PawJellyIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative block h-7 w-7 rounded-full bg-rose-100"
    >
      <span className="absolute left-[9px] top-[11px] h-[11px] w-[10px] rounded-full bg-rose-300" />
      <span className="absolute left-[4px] top-[7px] h-[6px] w-[6px] rounded-full bg-rose-300" />
      <span className="absolute left-[10px] top-[4px] h-[6px] w-[6px] rounded-full bg-rose-300" />
      <span className="absolute right-[4px] top-[7px] h-[6px] w-[6px] rounded-full bg-rose-300" />
    </span>
  );
}

function stripWrappingQuotes(text: string) {
  return text.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
}

function getShareMoodLabel(analysis: BehaviorAnalysis) {
  const mood = getFollowUpMood(analysis);
  const labels: Record<FollowUpMood, string> = {
    active: "생기 있는 순간",
    tense: "조심스러운 순간",
    resting: "편안한 쉼",
    curious: "호기심 어린 순간",
    alert: "신중한 관찰",
    neutral: "오늘의 반려동물 마음",
  };

  return labels[mood];
}

function getShareSummary(analysis: BehaviorAnalysis) {
  const text = getAnalysisText(analysis);
  const mood = getFollowUpMood(analysis);
  const atmosphere = getShareAtmosphere(text, mood);
  const action = getShareAction(text, mood);
  const emotion = getShareEmotion(text, mood);
  const templateIndex = getStableTextIndex(text, 6);

  const templates = [
    `${atmosphere} 속에서 ${action} ${emotion}을 담고 있어요.`,
    `${action} ${emotion}이 차분히 전해지는 장면이에요.`,
    `${action} ${emotion} 쪽으로 마음이 머무는 순간이에요.`,
    `${atmosphere}와 ${emotion}이 자연스럽게 이어져요.`,
    `${action} 지금의 분위기를 천천히 받아들이고 있어요.`,
    `${emotion}을 품고 ${action} 오늘의 순간을 지나고 있어요.`,
  ];

  return templates[templateIndex];
}

function getShareAside(analysis: BehaviorAnalysis) {
  const thought = stripWrappingQuotes(analysis.cuteThought);
  if (!thought) return "";
  if (getReadableShareTextLength(thought) <= 28) return `“${thought}”`;

  const mood = getFollowUpMood(analysis);
  const fallbacks: Record<FollowUpMood, string> = {
    active: "“조금 더 함께하고 싶은 순간이야.”",
    tense: "“천천히 다가와 주면 좋겠어.”",
    resting: "“이 자리에서 조금 더 쉬고 싶어.”",
    curious: "“조금만 더 살펴보고 싶어.”",
    alert: "“잠시만 더 지켜보고 싶어.”",
    neutral: "“지금 이 분위기를 천천히 느끼고 있어.”",
  };

  return fallbacks[mood];
}

function getShareAtmosphere(text: string, mood: FollowUpMood) {
  if (includesAny(text, ["낯설", "조심", "불안", "긴장", "스트레스"])) {
    return "조심스럽고 차분한 공기";
  }

  if (includesAny(text, ["호기심", "궁금", "탐색", "살피", "관심", "확인"])) {
    return "주변을 살피는 호기심 어린 공기";
  }

  if (includesAny(text, ["놀이", "장난", "신나", "활발", "에너지", "즐거"])) {
    return "가볍고 생기 있는 공기";
  }

  if (includesAny(text, ["휴식", "쉬", "졸", "잠", "편안", "차분", "느긋", "안정"])) {
    return "편안하고 느긋한 공기";
  }

  const fallbacks: Record<FollowUpMood, string> = {
    active: "가볍고 생기 있는 공기",
    tense: "조심스럽고 차분한 공기",
    resting: "편안하고 느긋한 공기",
    curious: "주변을 살피는 호기심 어린 공기",
    alert: "조금 예민하고 신중한 공기",
    neutral: "잔잔한 일상의 공기",
  };

  return fallbacks[mood];
}

function getShareAction(text: string, mood: FollowUpMood) {
  if (includesAny(text, ["바라", "쳐다", "주시", "시선", "살피", "확인"])) {
    return "주변을 차분히 바라보며";
  }

  if (includesAny(text, ["쉬", "휴식", "누워", "앉아", "졸", "잠", "느긋"])) {
    return "편안한 자리에서 쉬며";
  }

  if (includesAny(text, ["보호자", "옆", "함께", "관심", "기대", "반응"])) {
    return "보호자 곁의 반응을 느끼며";
  }

  if (includesAny(text, ["놀이", "장난", "움직", "활발", "에너지", "꼬리"])) {
    return "몸짓으로 기분을 표현하며";
  }

  if (includesAny(text, ["냄새", "탐색", "궁금", "호기심", "새로운"])) {
    return "새로운 단서를 천천히 살피며";
  }

  const fallbacks: Record<FollowUpMood, string> = {
    active: "몸짓으로 기분을 표현하며",
    tense: "상황을 조심스럽게 살피며",
    resting: "편안한 자리에서 쉬며",
    curious: "새로운 단서를 천천히 살피며",
    alert: "주변 변화를 신중하게 살피며",
    neutral: "자연스러운 표정과 자세로",
  };

  return fallbacks[mood];
}

function getShareEmotion(text: string, mood: FollowUpMood) {
  if (includesAny(text, ["편안", "안정", "차분", "느긋", "여유"])) {
    return "안정감";
  }

  if (includesAny(text, ["궁금", "호기심", "관심", "탐색"])) {
    return "궁금함";
  }

  if (includesAny(text, ["즐거", "신나", "놀이", "활발", "에너지"])) {
    return "즐거움";
  }

  if (includesAny(text, ["불안", "긴장", "조심", "낯설", "주저"])) {
    return "조심스러운 마음";
  }

  const fallbacks: Record<FollowUpMood, string> = {
    active: "즐거움",
    tense: "조심스러운 마음",
    resting: "안정감",
    curious: "궁금함",
    alert: "신중한 마음",
    neutral: "잔잔한 감정",
  };

  return fallbacks[mood];
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getStableTextIndex(text: string, modulo: number) {
  const hash = Array.from(text).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

  return hash % modulo;
}

function getReadableShareTextLength(text: string) {
  return text.replace(/\s/g, "").length;
}

const SHARE_CARD_IMAGE_POSITION = "center top";
const SHARE_CARD_CANVAS_WIDTH = 1080;
const SHARE_CARD_CANVAS_HEIGHT = 1458;

async function createShareCardImageBlob(
  imageUrl: string,
  analysis: BehaviorAnalysis,
) {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_CANVAS_WIDTH;
  canvas.height = SHARE_CARD_CANVAS_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("공유용 카드를 만들 수 없습니다.");
  }

  const image = await loadImage(imageUrl);
  const summary = getShareSummary(analysis);
  const moodLabel = getShareMoodLabel(analysis);
  const aside = getShareAside(analysis);

  const outerPadding = 54;
  const innerPadding = 40;
  const contentInset = 14;
  const outerRadius = 95;
  const innerRadius = 73;
  const imageRadius = 62;
  const innerX = outerPadding;
  const innerY = outerPadding;
  const innerWidth = canvas.width - outerPadding * 2;
  const innerHeight = canvas.height - outerPadding * 2;
  const imageX = innerX + innerPadding;
  const imageY = innerY + innerPadding;
  const imageWidth = innerWidth - innerPadding * 2;
  const imageHeight = Math.round(imageWidth * 1.16);
  const textX = imageX + contentInset;
  const textWidth = imageWidth - contentInset * 2;
  const labelY = imageY + imageHeight + 88;
  const summaryY = labelY + 68;
  const summaryLineHeight = 62;
  const asideLineHeight = 40;
  const footerY = innerY + innerHeight - 132;
  const dividerY = footerY - 34;

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 0, 0, canvas.width, canvas.height, outerRadius, "#f8efe3");

  context.save();
  createRoundedRectPath(context, 0, 0, canvas.width, canvas.height, outerRadius);
  context.clip();

  drawRoundedRect(context, innerX, innerY, innerWidth, innerHeight, innerRadius, "#fffdf8");
  drawRoundedRect(context, imageX, imageY, imageWidth, imageHeight, imageRadius, "#f5f1e8");
  drawPetContainedImage(context, image, imageX, imageY, imageWidth, imageHeight, imageRadius);

  context.fillStyle = "#0f766e";
  context.font = '700 38px "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';
  context.textBaseline = "alphabetic";
  context.fillText(moodLabel, textX, labelY);

  context.fillStyle = "#1c1917";
  context.font = '700 56px "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';
  const summaryLines = getWrappedTextLines(context, summary, textWidth, 3);
  drawTextLines(context, summaryLines, textX, summaryY, summaryLineHeight);

  if (aside) {
    const asideY = summaryY + summaryLineHeight * summaryLines.length + 48;
    const maxAsideLines = Math.max(
      1,
      Math.floor((dividerY - asideY - 24) / asideLineHeight),
    );

    context.fillStyle = "#78716c";
    context.font = 'italic 500 31px "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';
    drawWrappedText(context, aside, textX, asideY, textWidth, asideLineHeight, maxAsideLines);
  }

  context.strokeStyle = "#e7e5e4";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(textX, dividerY);
  context.lineTo(textX + textWidth, dividerY);
  context.stroke();

  drawPawJelly(context, textX, footerY - 22, 58);

  context.fillStyle = "#0f766e";
  context.font = '700 42px "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';
  context.fillText("MomentPet", textX + 75, footerY + 18);

  context.fillStyle = "#a8a29e";
  context.font = '600 27px "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';
  context.textAlign = "right";
  context.fillText("pet mood note", textX + textWidth, footerY + 16);
  context.textAlign = "left";
  context.restore();

  return canvasToBlob(canvas, "image/png", 1);
}

function drawPetContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const containedImage = getContainedImagePlacement(image, width, height);

  context.save();
  createRoundedRectPath(context, x, y, width, height, radius);
  context.clip();

  context.drawImage(
    image,
    x + containedImage.x,
    y + containedImage.y,
    containedImage.width,
    containedImage.height,
  );
  context.restore();
}

function getContainedImagePlacement(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
  const containedWidth = image.width * scale;
  const containedHeight = image.height * scale;

  return {
    x: (targetWidth - containedWidth) / 2,
    y: 0,
    width: containedWidth,
    height: containedHeight,
  };
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  context.fillStyle = fillStyle;
  createRoundedRectPath(context, x, y, width, height, radius);
  context.fill();
}

function createRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines = getWrappedTextLines(context, text, maxWidth, maxLines);
  drawTextLines(context, lines, x, y, lineHeight);
}

function getWrappedTextLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  let didOmitText = false;

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines) {
      didOmitText = true;
      break;
    }
  }

  if (currentLine && lines.length < maxLines) lines.push(currentLine);

  return lines.slice(0, maxLines).map((line, index) => {
    const isLastVisibleLine = index === maxLines - 1;
    const visibleLine =
      isLastVisibleLine && didOmitText ? `${line.trimEnd()}...` : line;

    return fitTextToWidth(context, visibleLine, maxWidth);
  });
}

function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => {
    context.fillText(line, x, y + lineHeight * index);
  });
}

function fitTextToWidth(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (context.measureText(compact).width <= maxWidth) return compact;

  let end = compact.length;

  while (end > 0) {
    const candidate = compact.slice(0, end).trimEnd();
    if (context.measureText(candidate).width <= maxWidth) return candidate;
    end -= 1;
  }

  return compact;
}

function drawPawJelly(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.fillStyle = "#ffe4e6";
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fda4af";
  drawEllipse(context, x + 28, y + 34, 13, 15);
  drawEllipse(context, x + 15, y + 23, 9, 10);
  drawEllipse(context, x + 30, y + 15, 9, 10);
  drawEllipse(context, x + 45, y + 23, 9, 10);
}

function drawEllipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
) {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
}

async function optimizeImageForApi(file: File): Promise<File> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "pet-photo";
  let smallestBlob: Blob | null = null;

  for (const step of IMAGE_COMPRESSION_STEPS) {
    const canvas = drawImageToCanvas(image, step.maxDimension);
    const optimizedBlob = await canvasToBlob(canvas, "image/jpeg", step.quality);

    if (!smallestBlob || optimizedBlob.size < smallestBlob.size) {
      smallestBlob = optimizedBlob;
    }

    if (optimizedBlob.size <= COMPRESSED_IMAGE_TARGET_BYTES) {
      return new File([optimizedBlob], `${baseName}-optimized.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  }

  if (smallestBlob && smallestBlob.size <= MAX_UPLOAD_SIZE_BYTES) {
    return new File([smallestBlob], `${baseName}-optimized.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  throw new Error(
    "사진을 분석하기 좋은 크기로 조정하지 못했어요. 다른 사진으로 다시 시도해 주세요.",
  );
}

function drawImageToCanvas(
  image: HTMLImageElement,
  maxDimension: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 처리를 위한 캔버스를 만들지 못했습니다.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지를 읽지 못했습니다."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("이미지 파일 읽기에 실패했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지 로드에 실패했습니다."));
    image.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 압축 처리에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}
