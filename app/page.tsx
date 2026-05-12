"use client";

import { ChangeEvent, useEffect, useState } from "react";

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

const followUpMoodParts: Record<
  FollowUpMood,
  {
    starts: string[];
    focuses: string[];
    endings: string[];
  }
> = {
  active: {
    starts: ["지금처럼 신나 보이면", "놀고 싶은 분위기라면", "기분이 올라와 보일 때", "활발해 보이는 상태라면"],
    focuses: ["더 놀아줘도 괜찮은 상태", "장난감을 꺼내도 좋은 분위기", "같이 움직여줘도 좋은 타이밍", "기분이 올라온 상태"],
    endings: ["일까요?", "에 가까울까요?", "로 보면 될까요?"],
  },
  tense: {
    starts: ["조금 긴장해 보이면", "낯설어하는 분위기라면", "아직 마음을 살피는 중이면", "편해지기 전이라면"],
    focuses: ["잠시 기다려주는 게", "천천히 다가가는 게", "조용히 지켜보는 게", "거리를 조금 두는 게"],
    endings: ["이 나을까요?", "이 더 편할까요?", "이 좋을까요?"],
  },
  resting: {
    starts: ["쉬고 싶은 분위기라면", "졸려 보이는 상태라면", "편하게 늘어져 있다면", "움직임이 적어 보이면"],
    focuses: ["지금은 쉬게 두는 게", "조용히 기다려주는 게", "만지는 건 나중으로 미루는 게", "잠깐 지켜만 보는 게"],
    endings: ["이 좋을까요?", "이 더 편할까요?", "이 나을까요?"],
  },
  curious: {
    starts: ["궁금해하는 분위기라면", "주변을 살피는 중이면", "관심이 생긴 모습이라면", "가까이 확인하고 싶은 상태라면"],
    focuses: ["천천히 맡아보게 두는 게", "스스로 다가오게 기다리는 게", "가볍게 말을 걸어보는 게", "새로운 것을 살펴보게 두는 게"],
    endings: ["이 좋을까요?", "이 괜찮을까요?", "에 가까울까요?"],
  },
  alert: {
    starts: ["경계하는 분위기라면", "예민하게 살피는 중이면", "불편한 신호가 섞여 보이면", "아직 안심하지 못한 상태라면"],
    focuses: ["다가가지 않고 기다리는 게", "공간을 조금 비워주는 게", "자극을 줄여주는 게", "천천히 거리를 두는 게"],
    endings: ["이 좋을까요?", "이 더 나을까요?", "이 편할까요?"],
  },
  neutral: {
    starts: ["이 분위기라면", "사진 속 모습만 보면", "지금 상태에서는", "방금 반응을 보면"],
    focuses: ["조금 더 지켜보는 게", "부드럽게 말을 걸어보는 게", "반응을 살핀 뒤 움직이는 게", "편하게 두는 게"],
    endings: ["이 좋을까요?", "이 나을까요?", "에 가까울까요?"],
  },
};

const naturalFollowUpQuestions: Record<FollowUpMood, string[]> = {
  active: [
    "나랑 조금만 더 놀고 싶은 걸까요?",
    "장난감을 꺼내줘도 괜찮을까요?",
    "지금 같이 움직여줘도 좋을까요?",
    "조금 더 놀아줘도 될까요?",
  ],
  tense: [
    "조금 떨어져서 기다려줄까요?",
    "천천히 다가가도 괜찮을까요?",
    "지금은 조용히 지켜보는 게 좋을까요?",
    "편해질 때까지 기다려줄까요?",
  ],
  resting: [
    "지금은 쉬게 두는 게 좋을까요?",
    "잠깐 지켜만 봐도 괜찮을까요?",
    "만지는 건 조금 나중에 할까요?",
    "조용히 기다려주는 게 나을까요?",
  ],
  curious: [
    "여기 한번 봐줘도 될까요?",
    "스스로 다가오게 기다려줄까요?",
    "가볍게 말을 걸어봐도 괜찮을까요?",
    "조금 더 가까이 와줄까요?",
  ],
  alert: [
    "지금은 거리를 조금 두는 게 좋을까요?",
    "다가가지 않고 기다려줄까요?",
    "자극을 줄여주는 게 나을까요?",
    "공간을 조금 비워줄까요?",
  ],
  neutral: [
    "조금 더 지켜봐도 괜찮을까요?",
    "부드럽게 말을 걸어볼까요?",
    "지금은 편하게 두는 게 좋을까요?",
    "반응을 보고 천천히 움직일까요?",
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
    (candidate) => !recentPlaceholders.includes(candidate),
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

  if (hasSafetyCaution(analysis) || scores.alert > 0) return "alert";
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
  const parts = followUpMoodParts[mood];
  const analysisText = analysis ? normalizeQuestionText(getAnalysisText(analysis)) : "";
  const composedCandidates = parts.starts.flatMap((start) =>
    parts.focuses.flatMap((focus) =>
      parts.endings.map((ending) =>
        normalizeQuestion(`${start} ${focus}${ending}`),
      ),
    ),
  );
  const candidates = [
    ...naturalFollowUpQuestions[mood].map(normalizeQuestion),
    ...composedCandidates,
  ];
  const deduped = [...new Set(candidates)].filter(
    (candidate) =>
      !isDuplicateWithAnalysis(candidate, analysisText) &&
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

function hasSafetyCaution(analysis: BehaviorAnalysis) {
  if (!analysis.caution.trim()) return false;

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
  "사진 용량이 커서 분석이 중단됐어요. 사진을 한 번 캡처하거나 작은 사진으로 다시 올려주세요.";

const GENERAL_ANALYSIS_ERROR_MESSAGE =
  "사진을 분석하는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";

const FOLLOW_UP_VALIDATION_MESSAGE =
  "궁금한 점을 문장으로 입력해 주세요.";

const MEANINGLESS_FOLLOW_UP_MESSAGE =
  FOLLOW_UP_VALIDATION_MESSAGE;

const UNRELATED_FOLLOW_UP_MESSAGE =
  FOLLOW_UP_VALIDATION_MESSAGE;

const AMBIGUOUS_FOLLOW_UP_MESSAGE =
  FOLLOW_UP_VALIDATION_MESSAGE;

const awkwardPlaceholderPhrases = [
  "말 줄",
  "주는 편",
  "두는 편",
  "가는 편",
  "보는 편",
  "움직이는 편",
];

const ambiguousShortQuestions = [
  "강아지",
  "고양이",
  "반려동물",
  "동물",
  "사진",
  "행동",
  "기분",
  "상태",
];

const followUpRelatedKeywords = [
  "강아지",
  "고양이",
  "반려",
  "동물",
  "사진",
  "행동",
  "기분",
  "감정",
  "상태",
  "표정",
  "자세",
  "몸",
  "눈",
  "귀",
  "꼬리",
  "입",
  "발",
  "털",
  "소리",
  "짖",
  "울",
  "하악",
  "으르렁",
  "물",
  "핥",
  "배고",
  "밥",
  "먹",
  "사료",
  "우유",
  "간식",
  "불안",
  "긴장",
  "편안",
  "불편",
  "무서",
  "놀",
  "쉬",
  "졸",
  "졸려",
  "졸린",
  "잠",
  "피곤",
  "자",
  "아파",
  "아프",
  "통증",
  "힘들",
  "만져",
  "쓰다듬",
  "안아",
  "다가",
  "기다",
  "달래",
  "보호자",
  "주인",
  "반응",
  "해줘",
  "줘도",
  "괜찮",
  "좋",
  "나을",
  "가까",
  "보이나",
  "보여",
  "왜",
  "뭐",
  "무슨",
  "어떻게",
  "해도",
  "돼",
];

const unrelatedFollowUpKeywords = [
  "점심",
  "저녁",
  "아침",
  "메뉴",
  "번역",
  "영어",
  "비트코인",
  "주식",
  "코인",
  "날씨",
  "뉴스",
  "대통령",
  "숙제",
  "코딩",
  "노래",
  "영화",
  "여행",
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

  if (isAmbiguousShortFollowUpQuestion(normalized)) {
    return AMBIGUOUS_FOLLOW_UP_MESSAGE;
  }

  if (isUnrelatedFollowUpQuestion(normalized)) {
    return UNRELATED_FOLLOW_UP_MESSAGE;
  }

  if (!hasFollowUpQuestionSignal(normalized)) {
    return UNRELATED_FOLLOW_UP_MESSAGE;
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

function isAmbiguousShortFollowUpQuestion(question: string) {
  const compact = question
    .replace(/\s/g, "")
    .replace(/[?!.~,요]+$/g, "")
    .toLowerCase();

  return ambiguousShortQuestions.includes(compact);
}

function isUnrelatedFollowUpQuestion(question: string) {
  const compact = question.replace(/\s/g, "").toLowerCase();
  const hasUnrelatedKeyword = unrelatedFollowUpKeywords.some((keyword) =>
    compact.includes(keyword),
  );
  const hasRelatedKeyword = followUpRelatedKeywords.some((keyword) =>
    compact.includes(keyword),
  );

  return hasUnrelatedKeyword && !hasRelatedKeyword;
}

function hasFollowUpQuestionSignal(question: string) {
  const compact = question.replace(/\s/g, "").toLowerCase();

  if (followUpRelatedKeywords.some((keyword) => compact.includes(keyword))) {
    return true;
  }

  return /[?？]$/.test(question) && /[가-힣]/.test(question);
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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
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

  const refreshFollowUpPlaceholder = (nextAnalysis?: BehaviorAnalysis | null) => {
    const nextPlaceholder = getFollowUpPlaceholder(
      nextAnalysis,
      recentFollowUpPlaceholders,
    );
    setFollowUpPlaceholder(nextPlaceholder);
    setRecentFollowUpPlaceholders((recent) =>
      [nextPlaceholder, ...recent].slice(0, 10),
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadedFile(null);
    setAnalysis(null);
    setErrorMessage(null);
    setValidationStatus("idle");
    setValidationMessage(null);
    resetFollowUpState();
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(URL.createObjectURL(file));
    setUploadedFile(file);
    setAnalysis(null);
    setErrorMessage(null);
    setValidationStatus("idle");
    setValidationMessage(null);
    resetFollowUpState();
  };

  const startAnalysis = async () => {
    if (!uploadedFile || isAnalyzing || validationStatus !== "valid") return;

    setIsAnalyzing(true);
    setIsOptimizing(true);
    setErrorMessage(null);
    setAnalysis(null);
    resetFollowUpState();

    try {
      const optimizedFile = await optimizeImageForApi(uploadedFile);
      setIsOptimizing(false);

      const formData = new FormData();
      formData.append("image", optimizedFile);

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
      setIsOptimizing(false);
      setIsAnalyzing(false);
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
      const optimizedFile = await optimizeImageForApi(uploadedFile);
      const formData = new FormData();
      formData.append("image", optimizedFile);
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Pet behavior insight
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight">
            반려동물 마음코치
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            반려동물 사진 속 자세, 표정, 주변 상황을 보고 어떤 기분일
            가능성이 있는지와 보호자가 취할 수 있는 반응을 알려드립니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_-18px_rgba(68,64,60,0.55)] ring-1 ring-stone-200">
          <h2 className="text-base font-semibold">사진 업로드</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            반려동물의 몸 전체나 얼굴, 꼬리, 귀, 주변 상황이 함께 보이면 더
            구체적으로 분석할 수 있습니다.
          </p>
          <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-800">
            업로드한 사진은 분석 요청에만 사용되며 앱에 저장하지 않습니다.
          </p>

          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm font-semibold text-stone-700 transition hover:border-teal-500 hover:bg-teal-50">
            사진 선택
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
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
                다른 사진 선택
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
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
            disabled={!uploadedFile || isAnalyzing || validationStatus !== "valid"}
            className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {isAnalyzing
              ? isOptimizing
                ? "이미지 준비 중..."
                : "행동 분석 중..."
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
            ) : isAnalyzing ? (
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-teal-700" />
                <p className="text-sm text-stone-600">
                  {isOptimizing
                    ? "사진 크기를 조정하고 있습니다..."
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
                    disabled={hasAskedFollowUp || isAskingFollowUp}
                    rows={3}
                    placeholder={followUpPlaceholder}
                    className="mt-3 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-stone-100"
                  />
                  <button
                    type="button"
                    onClick={askFollowUpQuestion}
                    disabled={
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

function stripWrappingQuotes(text: string) {
  return text.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
}

async function optimizeImageForApi(file: File): Promise<File> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const maxDimension = 1536;
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

  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/webp" : "image/jpeg";
  const optimizedBlob = await canvasToBlob(canvas, outputType, 0.84);
  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");

  return new File([optimizedBlob], `${baseName}-optimized.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
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
