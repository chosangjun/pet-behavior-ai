import OpenAI from "openai";
import { NextResponse } from "next/server";

const validationResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "pet_image_validation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["isValid", "reason"],
      properties: {
        isValid: { type: "boolean" },
        reason: { type: "string" },
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

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageUrl = `data:${image.type};base64,${base64}`;

    const prompt = `
You validate images for a Korean pet behavior analysis app.
ALLOW if the main subject appears to be a common companion pet, even if partially visible.
Common companion pets include dogs, cats, hamsters, rabbits, birds, guinea pigs, ferrets, turtles, fish, lizards, snakes, and similar animals kept as pets.
BLOCK only if there is clearly no pet as a main subject, such as a person-only photo, food photo, landscape, object, document, or unrelated scene.
If uncertain, choose ALLOW.
Return raw JSON only, with no markdown fences:
{"isValid": true, "reason": ""}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: validationResponseFormat,
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

    const content = completion.choices[0]?.message?.content ?? "";
    const validation = safeParseValidation(content);
    if (!validation) {
      return NextResponse.json(
        { error: "AI ?묐떟 ?뺤떇???댁꽍?섏? 紐삵뻽?듬땲??" },
        { status: 502 },
      );
    }

    if (!validation.isValid) {
      return NextResponse.json({
        isValid: false,
        reason: "반려동물이 잘 보이는 사진으로 다시 올려주세요.",
      });
    }

    return NextResponse.json({ isValid: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "이미지 확인 중 오류가 발생했습니다.";
    return NextResponse.json(
      { error: message },
      { status: isPayloadTooLargeError(message) ? 413 : 500 },
    );
  }
}

function safeParseValidation(
  content: string,
): { isValid: boolean; reason: string } | null {
  try {
    const parsed = JSON.parse(content) as {
      isValid?: unknown;
      reason?: unknown;
    };

    if (typeof parsed.isValid !== "boolean") return null;

    return {
      isValid: parsed.isValid,
      reason: String(parsed.reason ?? "").trim(),
    };
  } catch (error) {
    console.error("Failed to parse OpenAI validation response:", {
      error,
      content,
    });
    return null;
  }
}

function isPayloadTooLargeError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("request entity too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("413")
  );
}
