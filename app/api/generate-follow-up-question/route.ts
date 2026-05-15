import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getPhotoTooLargeMessage, isFileTooLarge } from "@/app/uploadLimits";

type BehaviorAnalysis = {
  mood: string;
  signals: string;
  possibleReason: string;
  guardianResponse: string;
  caution: string;
};

const generatedQuestionResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "pet_behavior_generated_follow_up_question",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["candidates", "question"],
      properties: {
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: { type: "string" },
        },
        question: { type: "string" },
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
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const formData = await request.formData();
    const image = formData.get("image");
    const analysisText = String(formData.get("analysis") ?? "").trim();

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (isFileTooLarge(image)) {
      return NextResponse.json({ error: getPhotoTooLargeMessage() }, { status: 413 });
    }

    const analysis = parseAnalysis(analysisText);
    if (!analysis) {
      return NextResponse.json({ error: "분석 결과 정보가 필요합니다." }, { status: 400 });
    }

    const imageUrl = await fileToDataUrl(image);
    const prompt = `
당신은 반려동물 사진 분석 뒤, 보호자가 자연스럽게 이어서 물어볼 만한 질문을 설계하는 한국어 UX 라이터입니다.
업로드된 사진과 기존 분석 결과를 함께 보고, 내부적으로 후보 질문 2~3개를 먼저 만든 뒤 그중 가장 좋은 follow-up 질문 1개만 최종 선택하세요.

질문 생성 원칙:
- 반드시 사진 속 실제 분위기와 행동 단서에서 출발하세요.
- 사진에서 보이는 시선, 자세, 거리감, 몸의 방향, 주변을 살피는 분위기처럼 관찰 가능한 단서를 우선 참고하세요.
- 기존 분석 결과와 자연스럽게 이어지는 질문이어야 합니다.
- 보호자가 지금 사진을 보고 실제로 궁금해할 법한 질문만 만드세요.
- 사진에 없는 상황을 새로 가정하지 마세요.
- 사진에 보이지 않는 물건, 소리, 장소 변화, 음식, 산책, 장난감, 낯선 사람 같은 요소를 억지로 끌어오지 마세요.
- 랜덤한 돌봄 팁 질문이 아니라, 이 사진 장면에서 가장 자연스럽게 이어지는 궁금증만 후보로 만드세요.
- 질문은 짧고 부드럽고 대화하듯 자연스럽게 쓰세요.
- 전문가 인터뷰처럼 딱딱하게 쓰지 마세요.
- 후보 질문끼리는 문장 구조가 너무 비슷하지 않게 만드세요.
- 같은 종결 패턴이나 같은 어순을 기계적으로 반복하지 마세요.
- 특히 "~하나요?", "평소에도 ~하나요?" 패턴으로만 반복하지 마세요.
- 구체 예시 문장을 흉내 내지 말고, 관찰한 장면에 맞춰 새로 쓰세요.
- 각 후보는 1문장이어야 합니다.
- 최종 question에는 후보 중 가장 좋은 1개를 그대로 넣으세요.
- 한국어만 사용하세요.
- "이 아이"라는 표현은 쓰지 마세요.
- 사진만으로 단정하지 말고, 질문 자체도 과한 확정을 피하세요.

후보 생성 단계:
1. 사진 속 실제 단서와 직접 연결되는 질문만 2~3개 만드세요.
2. 서로 다른 관찰 초점을 쓰세요. 예: 시선, 자세, 거리감, 탐색 분위기 중 사진에서 실제로 보이는 것만 활용하세요.
3. 서로 너무 비슷한 문장 구조는 피하세요.

최종 선택 기준:
1. 사진 분위기와의 연결성이 가장 높은 질문
2. 기존 분석 결과 다음에 가장 자연스럽게 이어지는 질문
3. 보호자가 실제로 눌러볼 가능성이 높은 질문
4. 사진에 없는 상황 가정이 가장 적은 질문
5. 가장 짧고 자연스럽고 감성적인 질문

기존 분석:
${JSON.stringify(analysis, null, 2)}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.8,
      response_format: generatedQuestionResponseFormat,
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
      return NextResponse.json({ error: "추가 질문을 만들지 못했습니다." }, { status: 502 });
    }

    const question = safeParseGeneratedQuestion(content);
    if (!question) {
      return NextResponse.json(
        { error: "추가 질문을 정리하는 중 문제가 발생했어요." },
        { status: 502 },
      );
    }

    return NextResponse.json({ question });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "추가 질문 생성 중 오류가 발생했습니다.";
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

function parseAnalysis(content: string): BehaviorAnalysis | null {
  try {
    const parsed = JSON.parse(content) as Partial<BehaviorAnalysis> & {
      analysis?: Partial<BehaviorAnalysis>;
    };
    const analysis = parsed.analysis ?? parsed;
    const normalized = {
      mood: String(analysis.mood ?? "").trim(),
      signals: String(analysis.signals ?? "").trim(),
      possibleReason: String(analysis.possibleReason ?? "").trim(),
      guardianResponse: String(analysis.guardianResponse ?? "").trim(),
      caution: String(analysis.caution ?? "").trim(),
    };

    if (
      !normalized.mood ||
      !normalized.signals ||
      !normalized.possibleReason ||
      !normalized.guardianResponse
    ) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

function safeParseGeneratedQuestion(content: string) {
  try {
    const parsed = JSON.parse(content) as {
      candidates?: unknown;
      question?: unknown;
    };
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.map((candidate) => polishQuestion(String(candidate ?? "")))
      : [];
    const question = polishQuestion(String(parsed.question ?? ""));
    if (candidates.length < 2 || candidates.length > 3) return null;
    if (!candidates.every(Boolean) || !question) return null;
    if (!candidates.includes(question)) return null;
    return question;
  } catch {
    return null;
  }
}

function polishQuestion(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.])/g, "$1")
    .replace(/\?+/g, "?")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
}

function isPayloadTooLargeError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("request entity too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("413")
  );
}
