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

톤 규칙:
- 단정하지 말고 "~처럼 보여요", "~일 가능성이 있어요", "~에 가까워 보여요"처럼 자연스러운 가능성 표현을 쓰세요.
- "사진 한 장만으로는 정확히 알 수 없습니다" 같은 병원 안내문 느낌의 문장은 피하고, "사진에 보이는 모습만 보면", "사진만으로는 놓칠 수 있는 부분도 있어요"처럼 부드럽게 말하세요.
- 너무 딱딱한 표현인 "수의학적 진단", "확정 진단", "치료 지시" 같은 말은 결과 본문에 넣지 마세요.
- 보호자가 바로 이해할 수 있게 각 항목은 1~3문장으로 짧고 자연스럽게 작성하세요.
- cuteThought는 반려동물의 진짜 생각을 단정하지 말고, 사진을 보고 느껴지는 분위기를 반려동물 시점처럼 짧게 표현하세요.
- cuteThought는 공유하고 싶을 정도로 자연스러운 한 문장만 쓰고, 따옴표는 넣지 마세요.
- cuteThought에서 "~같아요"를 반복적으로 쓰지 말고, 너무 유치하거나 과장된 표현은 피하세요.
- cuteThought는 예시 문구를 그대로 쓰지 말고 사진 상황에 맞게 새로 작성하세요.
- cuteThought는 실제 보호자가 짧게 적을 법한 말투로 쓰세요. 예: "나랑 조금만 놀아줄래?", "여기 한번 봐줘!", "조금 더 가까이 와줄래?"
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
      temperature: 0.3,
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

    if (
      !normalized.mood ||
      !normalized.signals ||
      !normalized.possibleReason ||
      !normalized.guardianResponse ||
      !normalized.cuteThought
    ) {
      return null;
    }

    return normalized;
  } catch (error) {
    console.error("Failed to parse OpenAI analysis response:", {
      error,
      content,
    });
    return null;
  }
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
