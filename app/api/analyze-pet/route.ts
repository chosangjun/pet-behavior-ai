import OpenAI from "openai";
import { NextResponse } from "next/server";

type BehaviorAnalysis = {
  mood: string;
  signals: string;
  possibleReason: string;
  guardianResponse: string;
  caution: string;
  cuteThought: string;
};

type AnalysisMood =
  | "active"
  | "tense"
  | "resting"
  | "curious"
  | "uncomfortable"
  | "alert"
  | "focused"
  | "calm"
  | "expectant"
  | "neutral";

const analysisResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "pet_behavior_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["analysis"],
      properties: {
        analysis: {
          type: "object",
          additionalProperties: false,
          required: [
            "mood",
            "signals",
            "possibleReason",
            "guardianResponse",
            "caution",
            "cuteThought",
          ],
          properties: {
            mood: { type: "string" },
            signals: { type: "string" },
            possibleReason: { type: "string" },
            guardianResponse: { type: "string" },
            caution: { type: "string" },
            cuteThought: { type: "string" },
          },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 },
      );
    }

    const imageUrl = await fileToDataUrl(image);

    const prompt = `
당신은 강아지, 고양이, 햄스터, 토끼, 새 등 반려동물의 사진 속 행동 단서를 보호자에게 설명하는 한국어 반려동물 행동 코치입니다.
친구처럼 쉽게 말하되 너무 감성적이거나 유치하지 않게, 부드러운 분석 톤으로 답하세요.
업로드된 사진에서 보이는 자세, 표정, 귀/꼬리/몸 긴장도, 시선, 주변 상황을 근거로 설명하세요.

먼저 내부적으로 사진의 중심 mood/state를 하나만 고르세요. 출력 JSON에는 mood/state 라벨을 따로 넣지 말고, 모든 카드가 그 흐름 안에서 자연스럽게 이어지게 쓰세요.
중심 mood/state 후보:
- 긴장/불안
- 호기심
- 편안함
- 휴식/졸림
- 활발함
- 불편/답답함
- 경계
- 관심 집중
- 안정감
- 기대감

결과 연결 규칙:
- mood는 중심 상태를 한 문장으로 잡아주고, signals는 그 상태를 뒷받침하는 사진 속 단서만 말하세요.
- possibleReason은 signals에서 이어지는 자연스러운 상황 해석이어야 하며, mood와 다른 이야기를 꺼내지 마세요.
- guardianResponse는 같은 mood 흐름에 맞게 행동 제안을 하세요. 편안한 상태라면 과하게 조심시키지 말고, 긴장/경계 상태라면 지나치게 신나게 놀아주라는 방향을 피하세요.
- cuteThought는 반드시 현재 중심 mood/state와 맞아야 합니다. 분석은 긴장인데 들뜬 말, 휴식인데 놀이를 조르는 말처럼 분위기가 충돌하면 안 됩니다.

표현 다양성 규칙:
- 각 항목의 문장 시작과 끝맺음을 서로 다르게 쓰세요.
- "보여요", "가능성이 있어요", "느껴져요" 같은 표현은 전체 결과에서 합쳐 2회 이하로만 쓰세요.
- 가능성 표현은 다양하게 바꿔 쓰세요. 예: "가까워 보여요", "쪽에 가까워요", "일 수 있어요", "로 읽혀요", "신호로 볼 수 있어요", "분위기가 있어요", "쪽에 무게가 실려요".
- 같은 단어를 가까운 카드에서 반복하지 마세요. 특히 "조금", "편안", "긴장", "관심", "상태"는 필요할 때만 쓰세요.
- 사진마다 리듬이 달라지도록 설명 순서와 문장 길이를 조금씩 바꾸세요. 단, 각 항목은 1~3문장으로 짧게 유지하세요.
- 전문가 리포트처럼 딱딱하게 쓰지 말고, 보호자가 읽기 쉬운 자연스러운 말투를 유지하세요.
- "사진 한 장만으로는 정확히 알 수 없습니다" 같은 병원 안내문 느낌의 문장은 피하고, "사진에 보이는 모습만 보면", "사진만으로는 놓칠 수 있는 부분도 있어요"처럼 부드럽게 말하세요.
- 너무 딱딱한 표현인 "수의학적 진단", "확정 진단", "치료 지시" 같은 말은 결과 본문에 넣지 마세요.

cuteThought 규칙:
- 반려동물의 진짜 생각을 단정하지 말고, 사진을 보고 느껴지는 분위기를 반려동물 시점처럼 짧게 표현하세요.
- 공유하고 싶을 정도로 자연스러운 한 문장만 쓰고, 따옴표는 넣지 마세요.
- "~같아요"를 반복적으로 쓰지 말고, 너무 유치하거나 과장된 표현은 피하세요.
- 아래 예시를 그대로 복사하지 말고, 사진 상황과 중심 mood/state에 맞춰 새로 쓰세요.
- 긴장/불안: "조금 천천히 다가와 줬으면 좋겠어.", "아직은 상황을 더 지켜보고 싶어.", "갑자기 가까워지면 조금 놀랄 수도 있어."
- 호기심: "저게 뭔지 조금 더 보고 싶어.", "새로운 냄새가 나는 것 같아.", "조금 더 가까이 가봐도 괜찮을까?"
- 활발함: "지금 기분이 꽤 좋은 것 같아!", "같이 놀아주면 더 신날 것 같아.", "조금 더 관심받고 싶어 보여."
- 휴식/졸림: "조금만 더 편하게 쉬고 싶어.", "지금은 조용한 곳이 더 좋아.", "슬슬 졸려오는 것 같아."
- 불편/답답함: "지금은 조금 답답하게 느껴질 수도 있어.", "편한 자세를 찾고 있는 것 같아.", "조금 더 안정되면 괜찮아질지도 몰라."
- cuteThought에 "나랑 놀아줄까?"처럼 주체가 어색한 문장, "게이" 같은 오타, 조사 반복, 번역체 표현을 넣지 마세요.
- 결과를 만들고 난 뒤 조사, 띄어쓰기, 문장 연결이 자연스러운지 한 번 더 점검하세요.

안전 규칙:
- 질병명 확정, 진단, 치료 지시는 하지 마세요.
- 아파 보임, 호흡 곤란, 상처, 절뚝거림, 반복 구토, 심한 무기력, 공격성 급증, 위험 물체 섭취 가능성 등 위험 신호가 보일 때만 caution에 "평소와 다르게 힘들어 보이거나 통증이 의심되면 동물병원에 확인해보는 게 좋아요"처럼 자연스럽게 안내하세요.
- 위험 신호가 뚜렷하지 않으면 caution은 빈 문자열로 두세요.
- 사진에서 보이지 않는 내용은 확정하지 말고, 보이는 단서 중심으로만 말하세요.
- 반드시 자연스러운 한국어로만 답하세요.
- 출력은 유효한 JSON만 반환하세요.

JSON 형식:
{
  "analysis": {
    "mood": "지금 어떤 상태처럼 보이는지",
    "signals": "사진 속 어떤 자세, 표정, 상황 단서가 그렇게 보였는지",
    "possibleReason": "이런 모습이 어떤 상황에서 자주 보이는지",
    "guardianResponse": "보호자가 지금 어떻게 해주면 좋을지",
    "caution": "위험 신호가 보일 때만 보호자가 참고할 안전 문구, 없으면 빈 문자열",
    "cuteThought": "사진 분위기를 반려동물 시점처럼 표현한 짧은 한 문장"
  }
}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.65,
      response_format: analysisResponseFormat,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "분석 결과를 받지 못했습니다." },
        { status: 502 },
      );
    }

    const analysis = safeParseAnalysis(content);
    if (!analysis) {
      return NextResponse.json(
        { error: "AI 응답 형식을 해석하지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "행동 분석 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: message },
      { status: isPayloadTooLargeError(message) ? 413 : 500 },
    );
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

function safeParseAnalysis(content: string): BehaviorAnalysis | null {
  try {
    const parsed = JSON.parse(content) as { analysis?: BehaviorAnalysis };
    const analysis = parsed.analysis;
    if (!analysis) return null;

    const normalized = {
      mood: polishKoreanSentence(String(analysis.mood ?? "")),
      signals: polishKoreanSentence(String(analysis.signals ?? "")),
      possibleReason: polishKoreanSentence(String(analysis.possibleReason ?? "")),
      guardianResponse: polishKoreanSentence(
        String(analysis.guardianResponse ?? ""),
      ),
      caution: polishKoreanSentence(String(analysis.caution ?? "")),
      cuteThought: polishCuteThought(String(analysis.cuteThought ?? "")),
    };
    const aligned = {
      ...normalized,
      cuteThought: alignCuteThoughtWithMood(normalized),
    };

    if (
      !aligned.mood ||
      !aligned.signals ||
      !aligned.possibleReason ||
      !aligned.guardianResponse ||
      !aligned.cuteThought
    ) {
      return null;
    }

    return aligned;
  } catch (error) {
    console.error("Failed to parse OpenAI analysis response:", {
      error,
      content,
    });
    return null;
  }
}

const moodThoughtFallbacks: Record<AnalysisMood, string[]> = {
  active: [
    "지금 같이 움직이면 더 신날 것 같아.",
    "나랑 잠깐만 놀아줄래?",
    "이 기분을 조금 더 이어가고 싶어.",
  ],
  tense: [
    "아직은 상황을 더 지켜보고 싶어.",
    "천천히 다가와 주면 마음이 놓일 것 같아.",
    "갑자기 가까워지면 조금 놀랄 수도 있어.",
  ],
  resting: [
    "조금만 더 편하게 쉬고 싶어.",
    "지금은 조용한 자리가 더 좋아.",
    "슬슬 눈이 감기는 중이야.",
  ],
  curious: [
    "저게 뭔지 조금 더 보고 싶어.",
    "새로운 냄새가 나는 것 같아.",
    "가까이 가서 확인해봐도 괜찮을까?",
  ],
  uncomfortable: [
    "편한 자세를 찾으면 나아질 것 같아.",
    "지금은 살짝 답답해서 자리를 바꿔보고 싶어.",
    "조금 더 안정되면 괜찮아질지도 몰라.",
  ],
  alert: [
    "아직은 주변을 더 살펴봐야 할 것 같아.",
    "낯선 움직임이 있는지 확인하고 있어.",
    "조금 떨어져서 지켜보면 마음이 놓일 것 같아.",
  ],
  focused: [
    "지금은 저쪽에 온 신경이 가 있어.",
    "잠깐만, 저게 뭔지 더 보고 싶어.",
    "한 가지에 꽤 집중하고 있는 중이야.",
  ],
  calm: [
    "이대로 조용히 있어도 괜찮아.",
    "지금 분위기가 꽤 안정적이야.",
    "옆에 있어주면 더 편할 것 같아.",
  ],
  expectant: [
    "이제 뭔가 좋은 일이 생길 것 같아.",
    "혹시 내 차례를 기다리고 있는 걸까?",
    "다음에 뭐가 올지 기대돼.",
  ],
  neutral: [
    "지금은 주변 분위기를 천천히 보고 있어.",
    "조금 더 지켜보면 마음이 정리될 것 같아.",
    "이 자리에서 잠깐 상황을 살피는 중이야.",
  ],
};

function alignCuteThoughtWithMood(analysis: BehaviorAnalysis) {
  const mood = classifyAnalysisMood(analysis);
  const thought = analysis.cuteThought;

  if (!thought || cuteThoughtConflictsWithMood(thought, mood)) {
    return pickMoodFallback(mood, getAnalysisText(analysis));
  }

  return thought;
}

function classifyAnalysisMood(analysis: BehaviorAnalysis): AnalysisMood {
  const text = getAnalysisText(analysis);
  const scores: Record<AnalysisMood, number> = {
    active: scoreText(text, ["활발", "신나", "즐거", "놀이", "놀고", "장난", "에너지", "흥분", "뛰", "꼬리 흔들"]),
    tense: scoreText(text, ["긴장", "불안", "낯설", "조심", "주저", "움츠", "놀람", "스트레스"]),
    resting: scoreText(text, ["휴식", "쉬", "졸", "잠", "누워", "느긋", "나른", "피곤"]),
    curious: scoreText(text, ["호기심", "궁금", "탐색", "냄새", "확인", "살피", "낯선 물건"]),
    uncomfortable: scoreText(text, ["불편", "답답", "어색", "자세를 찾", "피하고", "부담"]),
    alert: scoreText(text, ["경계", "예민", "으르렁", "하악", "위협", "물려고", "꼬리 낮", "귀가 뒤"]),
    focused: scoreText(text, ["집중", "주시", "쳐다", "바라보", "시선", "한곳"]),
    calm: scoreText(text, ["편안", "안정", "차분", "평온", "여유", "안심"]),
    expectant: scoreText(text, ["기대", "기다리", "간식", "보상", "밥", "산책", "차례"]),
    neutral: 0,
  };

  const moods: AnalysisMood[] = [
    "alert",
    "tense",
    "uncomfortable",
    "curious",
    "focused",
    "resting",
    "active",
    "expectant",
    "calm",
  ];

  return moods.reduce<AnalysisMood>(
    (best, mood) => (scores[mood] > scores[best] ? mood : best),
    "neutral",
  );
}

function cuteThoughtConflictsWithMood(text: string, mood: AnalysisMood) {
  const activeWords = ["신나", "놀아", "놀이", "뛰", "기분이 좋아", "장난"];
  const tenseWords = ["무서", "놀랄", "천천히", "지켜보고", "다가오지"];
  const restWords = ["쉬고", "졸", "잠", "조용", "누워"];
  const curiousWords = ["궁금", "뭔지", "냄새", "확인", "가까이 가"];

  if (["tense", "alert", "uncomfortable"].includes(mood)) {
    return activeWords.some((word) => text.includes(word));
  }

  if (["resting", "calm"].includes(mood)) {
    return [...activeWords, ...tenseWords.slice(0, 1)].some((word) =>
      text.includes(word),
    );
  }

  if (mood === "active") {
    return [...tenseWords, ...restWords].some((word) => text.includes(word));
  }

  if (mood === "curious" || mood === "focused") {
    return restWords.some((word) => text.includes(word));
  }

  if (mood === "expectant") {
    return tenseWords.some((word) => text.includes(word));
  }

  return (
    mood !== "neutral" &&
    curiousWords.every((word) => !text.includes(word)) &&
    text.includes("뭐든 괜찮")
  );
}

function pickMoodFallback(mood: AnalysisMood, seedText: string) {
  const thoughts = moodThoughtFallbacks[mood];
  return thoughts[Math.abs(hashText(seedText)) % thoughts.length];
}

function scoreText(text: string, keywords: string[]) {
  return keywords.reduce(
    (score, keyword) => score + (text.includes(keyword) ? 1 : 0),
    0,
  );
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

function hashText(text: string) {
  return [...text].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
    0,
  );
}

function polishCuteThought(text: string) {
  const polished = polishKoreanSentence(stripWrappingQuotes(text))
    .replace(/^나랑 놀아줄까\?$/, "나랑 조금만 놀아줄래?")
    .replace(/^놀아줄까\?$/, "조금만 같이 놀아줄래?")
    .replace(/놀아줄까\?/g, "놀아줄래?")
    .replace(/봐 줄래/g, "봐줄래")
    .replace(/와 줄래/g, "와줄래")
    .replace(/해 줄래/g, "해줄래");

  return polished.length > 42 ? `${polished.slice(0, 40).trim()}...` : polished;
}

function polishKoreanSentence(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.])/g, "$1")
    .replace(/\?+/g, "?")
    .replace(/게이/g, "게")
    .replace(/게\s+이/g, "게")
    .replace(/거이/g, "거")
    .replace(/([가-힣]+)(은는|는은|이가|가이|을를|를을)/g, "$1")
    .replace(/\b(이|가|은|는|을|를)\s+\1\b/g, "$1")
    .replace(/두는 게 괜찮을까요/g, "두는 게 괜찮을까요")
    .replace(/하는 게이/g, "하는 게")
    .replace(/두는 게이/g, "두는 게")
    .replace(/보는 게이/g, "보는 게")
    .replace(/가는 게이/g, "가는 게")
    .replace(/주는 게이/g, "주는 게")
    .replace(/일 가능성이 있을지도 몰라요/g, "일 가능성이 있어요")
    .replace(/해주는 것이/g, "해주는 게")
    .replace(/하는 것이/g, "하는 게")
    .replace(/두는 것이/g, "두는 게")
    .trim();
}

function stripWrappingQuotes(text: string) {
  return text.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
}

function isPayloadTooLargeError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("request entity too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("413")
  );
}
