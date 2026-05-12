import OpenAI from "openai";
import { NextResponse } from "next/server";

type BehaviorAnalysis = {
  mood: string;
  signals: string;
  possibleReason: string;
  guardianResponse: string;
  caution: string;
};

const unrelatedAnswer =
  "사진이나 방금 분석한 행동과 이어지는 질문으로 물어봐 주시면 더 자연스럽게 이어서 볼 수 있어요.";

const FOLLOW_UP_VALIDATION_MESSAGE =
  "궁금한 점을 문장으로 입력해 주세요.";

const MEANINGLESS_FOLLOW_UP_MESSAGE =
  FOLLOW_UP_VALIDATION_MESSAGE;

const UNRELATED_FOLLOW_UP_MESSAGE =
  FOLLOW_UP_VALIDATION_MESSAGE;

const followUpResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "pet_behavior_follow_up",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["answer", "isRelated"],
      properties: {
        answer: { type: "string" },
        isRelated: { type: "boolean" },
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
    const question = String(formData.get("question") ?? "").trim();
    const analysisText = String(
      formData.get("analysis") ??
        formData.get("recommendations") ??
        formData.get("recommendationResults") ??
        "",
    ).trim();

    if (!question) {
      return NextResponse.json(
        { error: MEANINGLESS_FOLLOW_UP_MESSAGE },
        { status: 400 },
      );
    }

    const validationError = getFollowUpValidationError(question);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 },
      );
    }

    const analysis = parseAnalysis(analysisText);
    if (!analysis) {
      console.error("Failed to parse follow-up analysis payload:", {
        analysisText,
        recommendations: formData.get("recommendations"),
        recommendationResults: formData.get("recommendationResults"),
        question,
      });
      return NextResponse.json(
        {
          error:
            "분석 결과를 다시 불러오는 중 문제가 발생했어요. 다시 분석 후 질문해 주세요.",
        },
        { status: 400 },
      );
    }

    const imageUrl = await fileToDataUrl(image);

    const prompt = `
당신은 강아지, 고양이, 햄스터, 토끼, 새 등 반려동물 사진 기반 행동 분석을 돕는 한국어 반려동물 행동 코치입니다.
사용자의 업로드 사진과 기존 분석 결과를 참고해서 추가 질문에 한 번만 답하세요.

규칙:
- 반드시 한국어로 답하세요.
- 답변은 1~3문장으로 짧고 자연스럽게 작성하세요.
- 기존 분석 결과를 다시 요약하거나 반복하지 마세요.
- 질문이 불분명하면 기존 분석 결과로 대신 답하지 말고 isRelated를 false로 반환하세요.
- 답변 첫머리에 사진 설명, 상태 설명, 기존 분석 요약을 붙이지 말고 사용자 질문에 대한 핵심 답부터 바로 말하세요.
- 질문과 직접 관련된 내용만 답하고, 질문과 상관없는 사진 단서는 언급하지 마세요.
- 사용자가 "우유", "간식", "안아도 돼?"처럼 짧게 물어도 의미가 분명하면 바로 답하세요.
- 먹거리, 접촉, 놀이, 안정 방법처럼 반려동물 돌봄과 이어지는 질문은 사진에 직접 보이지 않아도 관련 질문으로 보고 짧게 답하세요.
- 예: 질문이 "우유"라면 "우유는 일부 강아지에게 소화 문제를 일으킬 수 있어서 많이 주는 건 조심하는 게 좋아요."처럼 바로 답하세요.
- 친구처럼 쉽게 말하되 너무 감성적이거나 유치하지 않게, 부드러운 분석 톤을 유지하세요.
- 단정하지 말고 "~처럼 보여요", "~일 가능성이 있어요", "~에 가까워 보여요"처럼 자연스러운 가능성 표현을 쓰세요.
- "사진 한 장만으로는 정확히 알 수 없습니다" 같은 병원 안내문 느낌의 문장은 피하고, "사진에 보이는 모습만 보면", "사진만으로는 놓칠 수 있는 부분도 있어요"처럼 말하세요.
- 사진에서 보이지 않는 내용은 확정하지 마세요.
- 답변을 만든 뒤 조사, 띄어쓰기, 문장 연결이 자연스러운지 한 번 더 점검하세요.
- "게이", 조사 반복, 어색한 번역체 표현, 실제 사람이 잘 쓰지 않는 말투는 피하세요.
- 통증, 부상, 호흡 이상, 심한 무기력, 갑작스러운 공격성, 위험 물질 섭취 가능성이 언급되거나 의심되면 "평소와 다르게 힘들어 보이거나 통증이 의심되면 동물병원에 확인해보는 게 좋아요"처럼 자연스럽게 안내하세요.
- 질문이 사진 또는 기존 분석과 무관하면 "${unrelatedAnswer}"라고만 답하세요.

기존 분석:
${JSON.stringify(analysis, null, 2)}

사용자 질문:
${question}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      response_format: followUpResponseFormat,
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
        { error: "추가 질문 답변을 받지 못했습니다." },
        { status: 502 },
      );
    }

    const followUp = safeParseFollowUp(content);
    if (!followUp) {
      return NextResponse.json(
        { error: "답변을 정리하는 중 문제가 발생했어요. 다시 질문해 주세요." },
        { status: 502 },
      );
    }

    if (!followUp.isRelated) {
      return NextResponse.json(
        { error: UNRELATED_FOLLOW_UP_MESSAGE },
        { status: 400 },
      );
    }

    return NextResponse.json({ answer: followUp.answer });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "추가 질문 처리 중 오류가 발생했습니다.";
    console.error("Follow-up question API failed.", {
      error,
      message,
    });
    return NextResponse.json(
      { error: message },
      { status: isPayloadTooLargeError(message) ? 413 : 500 },
    );
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

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

function parseAnalysis(content: string): BehaviorAnalysis | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") {
      console.error("Follow-up analysis payload is not an object:", {
        parsed,
        content,
      });
      return null;
    }

    const payload = parsed as Partial<BehaviorAnalysis> & {
      analysis?: Partial<BehaviorAnalysis>;
    };
    const analysis = payload.analysis ?? payload;
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
      console.error("Follow-up analysis payload is missing required fields:", {
        normalized,
        content,
      });
      return null;
    }

    return normalized;
  } catch (error) {
    console.error("Failed to parse follow-up analysis JSON:", {
      error,
      content,
    });
    return null;
  }
}

function safeParseFollowUp(
  content: string,
): { answer: string; isRelated: boolean } | null {
  try {
    const parsed = JSON.parse(content) as {
      answer?: unknown;
      isRelated?: unknown;
    };
    const answer = polishKoreanSentence(String(parsed.answer ?? ""));
    const isRelated =
      typeof parsed.isRelated === "boolean"
        ? parsed.isRelated
        : answer !== unrelatedAnswer;

    if (!answer) return null;

    return { answer, isRelated };
  } catch (error) {
    console.error("Failed to parse OpenAI follow-up response:", {
      error,
      content,
    });
    return null;
  }
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
    .replace(/해주는 것이/g, "해주는 게")
    .replace(/하는 것이/g, "하는 게")
    .replace(/두는 것이/g, "두는 게")
    .replace(/주는 것이/g, "주는 게")
    .replace(/두는 게이/g, "두는 게")
    .replace(/보는 게이/g, "보는 게")
    .replace(/가는 게이/g, "가는 게")
    .replace(/주는 게이/g, "주는 게")
    .replace(/일 가능성이 있을지도 몰라요/g, "일 가능성이 있어요")
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
