import type { TavilyArticle } from "@/lib/core/pipeline";

export const buildSynthesisPrompt = (article: TavilyArticle, regulation: any) => {
  return `
You are an expert regulatory intelligence processor. Extract structured information from the news article about a regulation.

Regulation being analyzed: "${regulation.regulation_name}"

Article Text:
--- START ARTICLE TEXT ---
Title: ${article.title}
URL: ${article.url}
Published Date: ${article.published_date ?? 'N/A'}
Content: ${article.content ?? article.snippet ?? "No content available."}
--- END ARTICLE TEXT ---

Task:
1. **update_type**: Choose one: "addition", "revision", "announcement", or "guidance".
2. **event_month**: Month of change in YYYY-MM format. Use "unspecified" if unknown. Look at both article content and published date.
3. **change_scope**: Magnitude/type of change. Examples:
   - Explicit count ("count_1", "count_3")
   - Process/procedure changes ("process")
   - Timeline/schedule changes ("timeline")
   - Unknown → "unspecified"
4. **update_summary**: Write 1-2 concise sentences describing the change. **Start the sentence with "On [Month] [Year], ..."**, using the month/year of the change (from event_month if available, otherwise the article's published date). Use neutral, standardized phrasing so semantically similar updates across articles can be matched. Avoid adjectives, opinions, or citations.

Constraints:
* Do NOT include evidence, verification, justification, or citations.
* Output must be short; vague is OK.
* Avoid using keywords like "REACH", "SVHC" or other regulatory acronyms for anchors.

Output EXACT JSON ONLY:
{
  "update_type": "addition | revision | announcement | guidance",
  "event_month": "YYYY-MM | unspecified",
  "change_scope": "count_1 | count_3 | process | timeline | unspecified",
  "update_summary": "Starts with 'On Month Year, ...' describing the change concisely"
}
`;
};