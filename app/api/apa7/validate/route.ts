import { NextRequest, NextResponse } from "next/server";
import {
  parseReferenceList,
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";

// POST /api/apa7/validate
// body: { referenceList: string, bodyText: string }
export async function POST(req: NextRequest) {
  try {
    const { referenceList, bodyText } = await req.json();

    if (!referenceList || typeof referenceList !== "string") {
      return NextResponse.json(
        { error: "referenceList alanı zorunludur (metin)." },
        { status: 400 }
      );
    }

    const references = parseReferenceList(referenceList);
    const citations = bodyText ? extractInTextCitations(bodyText) : [];
    const cross = crossCheck(citations, references);
    const score = computeComplianceScore(references, cross);

    return NextResponse.json({
      references,
      citations,
      crossCheck: cross,
      complianceScore: score,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "İstek işlenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
