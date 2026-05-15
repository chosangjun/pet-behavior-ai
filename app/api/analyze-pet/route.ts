import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getPhotoTooLargeMessage, isFileTooLarge } from "@/app/uploadLimits";

type BehaviorAnalysis = {
  mood: string;
  signals: string;
  possibleReason: string;
  guardianResponse: string;
  caution: string;
  cuteThought: string;
  summaryText: string;
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
            "summaryText",
          ],
          properties: {
            mood: { type: "string" },
            signals: { type: "string" },
            possibleReason: { type: "string" },
            guardianResponse: { type: "string" },
            caution: { type: "string" },
            cuteThought: { type: "string" },
            summaryText: { type: "string" },
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

    if (isFileTooLarge(image)) {
      return NextResponse.json(
        { error: getPhotoTooLargeMessage() },
        { status: 413 },
      );
    }

    const imageUrl = await fileToDataUrl(image);

    const systemPrompt = `
당신은 반려동물 사진을 보고 보호자가 공감할 수 있는 한국어 행동 해석을 작성하는 반려동물 앱의 분석 작가입니다.
목표는 감정 이름을 붙이는 것이 아니라, 사진 속 행동 단서가 만드는 의미와 분위기를 부드럽게 풀어주는 것입니다.

반드시 지킬 원칙:
- 먼저 사진 속 동물이 강아지인지 고양이인지 판단한 뒤, 해당 동물의 행동 참고 기준만 내부적으로 사용하세요.
- 행동 참고 기준은 해석을 돕는 참고용입니다. 사진에서 실제로 보이는 단서와 연결될 때만 반영하고, 기준표에 있다는 이유만으로 끼워 넣지 마세요.
- 단순히 "행복", "긴장", "호기심" 같은 감정 라벨로 끝내지 말고 행동 의미, 사진 분위기, 보호자 공감이 함께 느껴지게 쓰세요.
- 사진에서 확인되는 단서만 근거로 삼고, 보이지 않는 사실은 확정하지 마세요.
- 사진에서 보이지 않는 귀, 꼬리, 입 모양, 눈 상태는 언급하거나 추측하지 마세요.
- 질병 진단, 공격성 확정, 불안장애, 통증 확정, 치료 지시처럼 전문적 단정으로 읽히는 표현은 피하세요.
- 보호자에게 말하듯 자연스럽게 쓰되, 과하게 전문가인 척하거나 보고서처럼 딱딱하게 쓰지 마세요.
- 모든 결과는 자연스러운 한국어 JSON만 반환하세요.
`.trim();

    const userPrompt = `
사진을 분석해 기존 UI 섹션에 들어갈 문장을 생성해주세요.

먼저 내부적으로 중심 분위기를 하나만 잡으세요. 출력에는 라벨을 따로 쓰지 말고, 여섯 섹션과 공유 문구가 같은 흐름으로 이어지게 작성합니다.
중심 분위기 후보는 긴장/불안, 호기심, 편안함, 휴식/졸림, 활발함, 불편/답답함, 경계, 관심 집중, 안정감, 기대감, 중립입니다.

분석 순서:
1. 사진 속 동물이 강아지인지 고양이인지 먼저 판단합니다.
2. 사진에서 실제로 보이는 단서만 적어봅니다.
3. 아래 참고 기준 중, 그 단서와 직접 연결되는 항목만 조용히 참고합니다.
4. 최종 문장에는 기준표를 나열하지 말고, 사진 속 모습에서 읽히는 행동 의미와 분위기로 자연스럽게 풀어냅니다.

사진을 볼 때 아래 단서를 나누어 관찰한 뒤 자연스럽게 종합하세요:
- 표정과 눈빛
- 시선 방향
- 자세와 몸 방향
- 귀, 꼬리, 입 주변 분위기(사진에서 실제로 보일 때만)
- 주변 환경과 상황
- 보호자와의 거리감이나 반응 가능성

강아지 행동 참고 기준:
- 몸을 낮춤 -> 조심스러움, 탐색 가능성
- 몸이 편하게 늘어짐 -> 안정감, 휴식 가능성
- 시선이 한 방향에 고정 -> 주변 자극 관찰 가능성
- 보호자를 바라봄 -> 기대, 교감 가능성
- 입을 벌리고 혀가 보임 -> 편안함, 더위 가능성
- 귀가 뒤로 젖혀짐 -> 긴장, 불편함 가능성
- 꼬리가 높음 -> 자신감, 흥분 가능성
- 꼬리가 낮거나 말림 -> 조심스러움, 불안 가능성
- 몸이 앞으로 향함 -> 관심, 집중 가능성
- 주변 냄새를 탐색하는 자세 -> 호기심 가능성
- 가만히 앉아 주변을 바라봄 -> 상황 관찰 가능성
- 몸의 긴장감이 적음 -> 편안함, 안정감 가능성

고양이 행동 참고 기준:
- 눈을 천천히 감음 -> 안정감, 신뢰 가능성
- 몸을 둥글게 말음 -> 휴식, 안정감 가능성
- 귀가 뒤로 젖혀짐 -> 경계, 불편함 가능성
- 꼬리를 빠르게 흔듦 -> 예민함, 긴장 가능성
- 편하게 누워 배를 보임 -> 안정감 가능성
- 시선이 한곳에 집중 -> 관찰, 호기심 가능성
- 몸을 낮추고 움직임 -> 조심스러운 탐색 가능성
- 앞발을 몸 아래 넣고 앉음 -> 편안한 휴식 가능성
- 주변을 천천히 둘러봄 -> 환경 탐색 가능성
- 보호자를 바라봄 -> 관심, 교감 가능성
- 몸의 긴장감이 적음 -> 안정감 가능성
- 털이 부풀어 보임 -> 긴장, 경계 가능성

톤:
- 단정하지 말고 "~처럼 보여요", "~일 수 있어요", "~에 가까워 보여요", "~느껴져요", "~로 읽혀요", "~쪽에 무게가 실려요"처럼 부드럽게 추정하세요.
- 왜 그렇게 해석했는지 짧은 근거를 자연스럽게 포함하세요.
- 예: "시선이 한쪽으로 또렷하게 향해 있고 몸의 긴장감이 크지 않은 걸 보면 주변 자극을 관찰하는 분위기에 가까워 보여요."
- "귀가 뒤로 젖혀졌어요", "꼬리가 낮아요", "입을 벌리고 있어요"처럼 사진에서 확인되지 않은 신체 단서를 임의로 보태지 마세요.
- 사진이 일부만 보이거나 단서가 부족하면, 보이는 범위 안에서만 설명하고 해석 강도를 낮추세요.
- 같은 끝맺음과 같은 단어를 가까운 섹션에서 반복하지 마세요. 특히 "조심스러워 보여요", "긴장", "관심", "상태", "조금"이 반복되지 않게 표현을 바꾸세요.
- 섹션마다 문장 시작 방식도 되도록 바꾸세요. 예: "지금은", "사진 속 모습은", "이런 장면에서는", "옆에서", "어쩌면"처럼 리듬을 달리하세요.
- 각 섹션은 1~3문장으로 짧게 쓰세요.
- "이 아이"는 쓰지 말고, 주어를 생략하거나 "사진 속 모습은", "강아지는", "고양이는", "반려동물은"처럼 사진에 맞춰 쓰세요.

섹션별 작성 지침:
1. mood
- UI 제목: "지금 이런 상태 같아요"
- 현재 분위기와 감정 흐름을 요약하세요.
- 감정 이름보다 상황 설명 중심으로 쓰세요.

2. signals
- UI 제목: "사진에서는 이렇게 보여요"
- 실제 사진 속 단서를 근거로 설명하세요. 이 섹션은 반드시 관찰 가능한 내용에서 출발해야 합니다.
- 눈빛, 시선, 자세, 몸 방향, 귀/꼬리/입 주변, 주변 상황 중 보이는 것을 자연스럽게 언급하세요.
- 보이는 단서가 적다면 적은 단서만으로도 충분하며, 없는 단서를 채워 넣지 마세요.

3. possibleReason
- UI 제목: "이럴 때 자주 그래요"
- 이런 행동이 자주 나타날 수 있는 상황을 부드럽게 추정하세요.
- 사진 내용과 끊기지 않게 연결하고 단정하지 마세요.

4. guardianResponse
- UI 제목: "이렇게 해주면 좋아요"
- 보호자가 부담 없이 바로 해줄 수 있는 행동 팁 1개만 제안하세요.
- 과한 훈련법이나 의학 조언은 피하세요.

5. cuteThought
- UI 제목: "이런 생각일지도"
- 짧고 귀엽고 공감되는 한 줄로 쓰세요.
- 설명체로 길어지지 않게 하고 따옴표는 넣지 마세요.
- 예시 톤: "지금은 천천히 주변을 익혀가는 중이야.", "여기 분위기를 조금 더 보고 싶어.", "내 속도로 천천히 움직여볼래."

6. caution
- UI 제목: "참고하면 좋아요"
- 보호자 참고용 짧은 한 줄만 쓰세요.
- 과한 경고 문구는 피하고, 참고할 내용이 크지 않으면 빈 문자열로 두세요.
- 단, 호흡 곤란, 상처, 절뚝거림, 반복 구토, 심한 무기력, 위험 물체 섭취 가능성처럼 사진상 뚜렷한 위험 신호가 보일 때만 동물병원 확인을 부드럽게 안내하세요.
- 사진만으로 전문적 문제를 확정하는 표현은 쓰지 마세요.

공유 카드용 summaryText:
- 화면 섹션과 별도로 생성하세요.
- 1~2줄 감성 문장 스타일로, 사진의 분위기를 압축하세요.
- cuteThought와 똑같이 쓰지 말고, 보호자가 공유 카드에서 읽기 좋은 문장으로 작성하세요.
- 예: "천천히 주변을 살피는 눈빛 속에 오늘의 분위기가 담겨 있어요.", "익숙한 거리에서 마음을 고르는 조용한 순간이에요."

출력 JSON 형식:
{
  "analysis": {
    "mood": "지금 이런 상태 같아요 섹션 문장",
    "signals": "사진에서는 이렇게 보여요 섹션 문장",
    "possibleReason": "이럴 때 자주 그래요 섹션 문장",
    "guardianResponse": "이렇게 해주면 좋아요 섹션 문장",
    "caution": "참고하면 좋아요 섹션 문장 또는 빈 문자열",
    "cuteThought": "이런 생각일지도 섹션 한 줄",
    "summaryText": "공유 카드용 1~2줄 감성 문장"
  }
}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.65,
      response_format: analysisResponseFormat,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
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
      mood: normalizeMoodDescription(String(analysis.mood ?? "")),
      signals: polishKoreanSentence(String(analysis.signals ?? "")),
      possibleReason: polishKoreanSentence(String(analysis.possibleReason ?? "")),
      guardianResponse: polishKoreanSentence(
        String(analysis.guardianResponse ?? ""),
      ),
      caution: polishKoreanSentence(String(analysis.caution ?? "")),
      cuteThought: polishCuteThought(String(analysis.cuteThought ?? "")),
      summaryText: polishShareSummary(String(analysis.summaryText ?? "")),
    };
    const aligned = {
      ...normalized,
      cuteThought: alignCuteThoughtWithMood(normalized),
    };
    const finalAnalysis = {
      ...aligned,
      caution: alignCautionWithMood(aligned),
      summaryText: aligned.summaryText || buildShareSummaryFallback(aligned),
    };

    if (
      !finalAnalysis.mood ||
      !finalAnalysis.signals ||
      !finalAnalysis.possibleReason ||
      !finalAnalysis.guardianResponse ||
      !finalAnalysis.cuteThought ||
      !finalAnalysis.summaryText
    ) {
      return null;
    }

    return finalAnalysis;
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
    "몸을 조금 더 움직여보고 싶어.",
    "지금은 반응이 오면 더 즐거울 것 같아.",
  ],
  tense: [
    "아직은 상황을 더 지켜보고 싶어.",
    "천천히 다가와 주면 마음이 놓일 것 같아.",
    "갑자기 가까워지면 조금 놀랄 수도 있어.",
    "아직은 조금 조심스럽게 느껴져.",
    "주변을 조금 더 확인해보고 싶어.",
    "낯선 자극은 천천히 받아들이고 싶어.",
  ],
  resting: [
    "조금만 더 편하게 쉬고 싶어.",
    "지금은 조용한 자리가 더 좋아.",
    "포근한 자리에서 조금 더 있고 싶어.",
    "잠깐 아무 생각 없이 쉬고 싶어.",
    "이 자리가 편해서 조금 더 머물고 싶어.",
  ],
  curious: [
    "저게 뭔지 조금 더 보고 싶어.",
    "새로운 냄새가 나는 것 같아.",
    "가까이 가서 확인해봐도 괜찮을까?",
    "주변이 계속 신경 쓰여.",
    "낯선 게 있어서 한 번 더 살펴보고 싶어.",
  ],
  uncomfortable: [
    "편한 자세를 찾으면 나아질 것 같아.",
    "지금은 살짝 답답해서 자리를 바꿔보고 싶어.",
    "조금 더 안정되면 괜찮아질지도 몰라.",
    "공간이 조금 더 편해지면 좋겠어.",
    "지금은 몸을 편하게 둘 자리를 찾고 싶어.",
  ],
  alert: [
    "아직은 주변을 더 살펴봐야 할 것 같아.",
    "낯선 움직임이 있는지 확인하고 있어.",
    "조금 떨어져서 지켜보면 마음이 놓일 것 같아.",
    "바로 다가오기보다 시간을 조금 줬으면 좋겠어.",
    "주변 변화가 잠잠해질 때까지 보고 싶어.",
  ],
  focused: [
    "지금은 저쪽에 온 신경이 가 있어.",
    "잠깐만, 저게 뭔지 더 보고 싶어.",
    "한 가지에 꽤 집중하고 있는 중이야.",
    "지금은 저 방향이 제일 신경 쓰여.",
    "조금만 더 보고 나면 마음이 풀릴 것 같아.",
  ],
  calm: [
    "이대로 조용히 있어도 괜찮아.",
    "지금 분위기가 꽤 안정적이야.",
    "옆에 있어주면 더 편할 것 같아.",
    "이 정도 거리감이 딱 좋아.",
    "차분한 분위기가 계속되면 좋겠어.",
  ],
  expectant: [
    "이제 뭔가 좋은 일이 생길 것 같아.",
    "혹시 내 차례를 기다리고 있는 걸까?",
    "다음에 뭐가 올지 기대돼.",
    "곧 익숙한 일이 시작될 것 같아.",
    "무언가를 기다리는 시간이야.",
  ],
  neutral: [
    "지금은 주변 분위기를 천천히 보고 있어.",
    "조금 더 지켜보면 마음이 정리될 것 같아.",
    "이 자리에서 잠깐 상황을 살피는 중이야.",
    "아직은 분위기를 파악하는 중이야.",
    "조용히 주변을 둘러보고 있어.",
  ],
};

const cautionFallbacks: Partial<Record<AnalysisMood, string[]>> = {
  tense: [
    "긴장한 반응이 오래 이어진다면 주변 자극을 줄이고 익숙한 공간에서 쉬게 해주세요.",
    "불안한 모습이 반복되면 바로 다가가기보다 조용한 환경에서 천천히 안정을 찾게 해주세요.",
    "평소보다 예민한 분위기가 계속된다면 소리나 움직임 같은 자극을 잠시 줄여보세요.",
    "낯선 자극을 의식하는 흐름이 길어지면 한발 물러서서 스스로 진정할 시간을 주세요.",
  ],
  uncomfortable: [
    "불편해 보이는 자세가 계속되면 자리나 주변 환경을 한 번 살펴봐 주세요.",
    "답답한 반응이 반복된다면 몸을 편히 둘 수 있는 공간을 먼저 만들어주세요.",
    "평소와 다른 불편함이 이어지면 움직임과 표정을 천천히 살펴봐 주세요.",
    "자세를 자주 바꾸거나 피하려는 흐름이 이어지면 쉬는 자리와 주변 소음을 확인해보세요.",
  ],
  alert: [
    "경계하는 분위기가 오래 이어지면 낯선 자극을 줄이고 거리를 살짝 둬 주세요.",
    "예민한 반응이 반복될 때는 억지로 만지기보다 스스로 진정할 시간을 주세요.",
    "주변을 계속 살핀다면 소리나 사람 움직임처럼 부담될 만한 요소를 줄여보세요.",
    "시선이 계속 한곳에 묶여 있다면 바로 다가가지 말고 차분한 거리를 유지해 주세요.",
  ],
  resting: [
    "평소와 다르게 기운이 없어 보이는 모습이 이어지면 움직임과 식욕, 반응을 천천히 살펴봐 주세요.",
    "회복 중처럼 조용히 쉬는 분위기라면 무리하게 깨우기보다 편한 자리를 유지해 주세요.",
    "평소보다 오래 처져 보인다면 하루 흐름을 살피고 필요한 경우 도움을 받아보세요.",
    "쉬는 시간이 길어지면서 반응까지 둔해진다면 평소 컨디션과 다른 점이 있는지 확인해보세요.",
  ],
  curious: [
    "주변을 천천히 살필 수 있도록 여유를 주는 것도 좋아요.",
    "스스로 주변을 확인할 수 있도록 잠시 기다려 주세요.",
    "관심이 머무는 대상을 무리하게 치우기보다 천천히 살펴보게 해주세요.",
    "새로운 자극을 확인하는 중이라면 편안한 거리에서 지켜봐 주세요.",
  ],
  focused: [
    "관심이 향한 곳을 충분히 확인할 수 있도록 잠시 시간을 주세요.",
    "시선이 머무는 방향을 따라 조용히 상황을 살펴봐 주세요.",
    "집중이 이어지는 동안에는 갑자기 부르기보다 부드럽게 반응을 기다려 주세요.",
    "확인하려는 흐름을 끊지 않도록 편안한 거리를 유지해 주세요.",
  ],
  calm: [
    "지금처럼 편안한 분위기를 유지해 주면 좋아요.",
    "안정감을 느낄 수 있도록 조용한 환경을 이어가 주세요.",
    "차분히 머무는 흐름이 이어지도록 큰 자극은 잠시 피해 주세요.",
    "스스로 주변을 확인할 수 있도록 천천히 기다려 주는 것도 좋아요.",
  ],
  neutral: [
    "주변을 천천히 살필 수 있도록 여유를 주세요.",
    "지금 흐름을 방해하지 않게 조용히 지켜봐 주세요.",
    "반응을 서두르기보다 현재 분위기를 조금 더 이어가 주세요.",
    "스스로 상황을 확인할 수 있도록 편안한 거리를 남겨주세요.",
  ],
  active: [
    "에너지가 올라온 흐름이라면 짧고 안전한 놀이로 받아주세요.",
    "흥이 이어질 때는 주변 물건을 정리하고 가볍게 움직일 공간을 만들어주세요.",
    "반응을 기다리는 분위기라면 짧게 놀아주고 쉬는 흐름으로 이어가 주세요.",
  ],
  expectant: [
    "기다리는 흐름이 길어지지 않도록 익숙한 루틴을 차분히 이어가 주세요.",
    "기대감이 올라와 있다면 차례를 천천히 알려주며 반응을 받아주세요.",
    "무언가를 기다리는 분위기라면 짧은 말과 익숙한 행동으로 흐름을 정리해 주세요.",
  ],
};

const calmReferenceMoods: AnalysisMood[] = [
  "calm",
  "curious",
  "focused",
  "neutral",
  "active",
  "expectant",
];

const concernWords = [
  "긴장",
  "불안",
  "스트레스",
  "예민",
  "경계",
  "움츠",
  "놀라",
  "통증",
  "아파",
  "아픔",
  "호흡",
  "상처",
  "절뚝",
  "구토",
  "무기력",
  "공격성",
  "위험",
];

function alignCuteThoughtWithMood(analysis: BehaviorAnalysis) {
  const mood = classifyAnalysisMood(analysis);
  const thought = analysis.cuteThought;

  if (!thought || cuteThoughtConflictsWithMood(thought, mood)) {
    return pickMoodFallback(mood, getAnalysisText(analysis));
  }

  return thought;
}

function alignCautionWithMood(analysis: BehaviorAnalysis) {
  const caution = polishKoreanSentence(analysis.caution);
  const mood = classifyAnalysisMood(analysis);

  if (caution) {
    const softened = softenCaution(caution);
    if (!cautionConflictsWithMood(softened, mood)) return softened;

    const aligned = pickCautionFallback(mood, getMoodSignalText(analysis));
    return aligned ?? "";
  }

  if (!shouldAddCautionFallback(mood, analysis)) return "";

  return pickCautionFallback(mood, getMoodSignalText(analysis)) ?? "";
}

function shouldAddCautionFallback(mood: AnalysisMood, analysis: BehaviorAnalysis) {
  if (["tense", "uncomfortable", "alert"].includes(mood)) return true;

  if (mood !== "resting") return false;

  const text = getAnalysisText(analysis);
  return [
    "회복",
    "평소와 다르",
    "기운이 없",
    "무기력",
    "피곤",
    "처져",
    "불편",
    "통증",
    "아파",
  ].some((keyword) => text.includes(keyword));
}

function cautionConflictsWithMood(caution: string, mood: AnalysisMood) {
  if (!caution) return false;

  if (["tense", "uncomfortable", "alert"].includes(mood)) return false;

  if (mood === "resting") {
    return hasConcernWords(caution) && !hasRestingConcern(caution);
  }

  if (calmReferenceMoods.includes(mood)) {
    return hasConcernWords(caution);
  }

  return false;
}

function hasConcernWords(text: string) {
  return concernWords.some((word) => text.includes(word));
}

function hasRestingConcern(text: string) {
  return ["회복", "평소와 다르", "기운이 없", "무기력", "처져", "둔해"].some(
    (word) => text.includes(word),
  );
}

function pickCautionFallback(mood: AnalysisMood, seedText: string) {
  const candidates = cautionFallbacks[mood];
  if (!candidates?.length) return null;

  return candidates[Math.abs(hashText(seedText)) % candidates.length];
}

function classifyAnalysisMood(analysis: BehaviorAnalysis): AnalysisMood {
  const text = getMoodSignalText(analysis);
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
    analysis.summaryText,
  ].join(" ");
}

function getMoodSignalText(analysis: BehaviorAnalysis) {
  return [
    analysis.mood,
    analysis.signals,
    analysis.possibleReason,
    analysis.guardianResponse,
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
    .replace(/천천히 눈을 감고 싶어/g, "조용히 쉬고 싶어")
    .replace(/눈을 감고 싶어/g, "편하게 쉬고 싶어")
    .replace(/눈이 감기는 중이야/g, "포근하게 쉬는 중이야")
    .replace(/눈이 감겨/g, "쉬고 싶어")
    .replace(/잠들고 싶어/g, "조용히 쉬고 싶어")
    .replace(/^나랑 놀아줄까\?$/, "나랑 조금만 놀아줄래?")
    .replace(/^놀아줄까\?$/, "조금만 같이 놀아줄래?")
    .replace(/놀아줄까\?/g, "놀아줄래?")
    .replace(/봐 줄래/g, "봐줄래")
    .replace(/와 줄래/g, "와줄래")
    .replace(/해 줄래/g, "해줄래");

  return polished;
}

function polishShareSummary(text: string) {
  return polishKoreanSentence(stripWrappingQuotes(text))
    .replace(/\s*\n+\s*/g, "\n")
    .trim();
}

function buildShareSummaryFallback(analysis: BehaviorAnalysis) {
  const mood = classifyAnalysisMood(analysis);
  const fallbacks: Record<AnalysisMood, string> = {
    active: "생기 있는 몸짓 안에 함께하고 싶은 마음이 담긴 순간이에요.",
    tense: "천천히 주변을 살피며 마음을 고르는 시간이 담겨 있어요.",
    resting: "조용히 쉬어가는 분위기 속에 편안한 시간이 머물러요.",
    curious: "낯선 것을 바라보는 눈빛에 궁금한 마음이 살짝 담겨 있어요.",
    uncomfortable: "편한 자리를 찾아가려는 작은 신호가 느껴지는 순간이에요.",
    alert: "주변의 변화를 신중하게 살피는 눈빛이 담겨 있어요.",
    focused: "한곳을 바라보는 시선 속에 오늘의 집중이 머물러요.",
    calm: "차분한 거리감 속에 안정적인 분위기가 담겨 있어요.",
    expectant: "무언가를 기다리는 마음이 부드럽게 묻어나는 순간이에요.",
    neutral: "주변을 천천히 받아들이는 담백한 순간이 담겨 있어요.",
  };

  return fallbacks[mood];
}

function softenCaution(text: string) {
  return text
    .replace(/평소와 다르게 힘들어 보이거나 통증이 의심되면/g, "평소와 다른 불편한 신호가 이어지면")
    .replace(/통증이 의심되면/g, "불편한 신호가 이어지면")
    .replace(/힘들어 보이면/g, "움직임이 둔해 보이면")
    .replace(/즉시 동물병원/g, "동물병원")
    .replace(/반드시 동물병원/g, "동물병원");
}

function normalizeMoodDescription(text: string) {
  const polished = polishKoreanSentence(text);
  const compact = polished.replace(/\s+/g, "");
  const withoutPunctuation = compact.replace(/[.?!]/g, "");
  const moodDescriptions: Record<string, string> = {
    "긴장/불안": "주변을 조심스럽게 받아들이는 쪽에 무게가 실려요.",
    긴장: "주변을 조심스럽게 받아들이는 쪽에 무게가 실려요.",
    불안: "낯선 자극을 신중하게 확인하는 흐름이에요.",
    호기심: "주변을 더 알아보고 싶은 기색이 앞서요.",
    편안함: "몸의 힘이 풀리고 차분히 머무는 분위기예요.",
    편안: "몸의 힘이 풀리고 차분히 머무는 분위기예요.",
    "휴식/졸림": "조용한 자리에서 쉬는 흐름으로 읽혀요.",
    휴식: "조용한 자리에서 쉬는 흐름으로 읽혀요.",
    졸림: "나른하게 쉬어가려는 분위기가 있어요.",
    활발함: "몸짓에 생기가 돌고 반응을 기다리는 흐름이에요.",
    활발: "몸짓에 생기가 돌고 반응을 기다리는 흐름이에요.",
    "불편/답답함": "자세나 공간을 편하게 맞추려는 기색이 있어요.",
    불편: "자세나 공간을 편하게 맞추려는 기색이 있어요.",
    답답함: "몸을 둘 자리를 다시 찾는 쪽에 가까워요.",
    경계: "주변 상황을 신중하게 살피는 쪽에 가까워요.",
    "관심집중": "한곳에 시선과 관심이 모인 흐름이에요.",
    "관심 집중": "한곳에 시선과 관심이 모인 흐름이에요.",
    안정감: "차분하게 머무는 분위기에 가까워요.",
    기대감: "무언가를 기대하며 기다리는 모습에 가까워요.",
  };

  if (moodDescriptions[withoutPunctuation]) {
    return moodDescriptions[withoutPunctuation];
  }

  const isShortLabel =
    !/[.?!]/.test(polished) &&
    !/(보여요|느껴져요|있어요|가까워요|같아요|모습이에요|분위기예요|상태예요)$/.test(
      polished,
    ) &&
    polished.length <= 12;

  if (isShortLabel) {
    return `${polished} 쪽으로 분위기가 잡혀요.`;
  }

  return polished;
}

function polishKoreanSentence(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.])/g, "$1")
    .replace(/\?+/g, "?")
    .replace(/느껴집니다/g, "느껴져요")
    .replace(/전달합니다/g, "전해져요")
    .replace(/관찰됩니다/g, "보여요")
    .replace(/보입니다/g, "보여요")
    .replace(/지금 이 아이는/g, "지금은")
    .replace(/이 아이는/g, "사진 속 모습은")
    .replace(/이 아이가/g, "사진 속 반려동물이")
    .replace(/이 아이를/g, "반려동물을")
    .replace(/이 아이에게/g, "반려동물에게")
    .replace(/이 아이한테/g, "반려동물에게")
    .replace(/이 아이의/g, "사진 속 모습의")
    .replace(/이 아이/g, "반려동물")
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
