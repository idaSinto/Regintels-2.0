import type { TavilyArticle } from "@/lib/core/pipeline";

export const buildSynthesisPrompt = (article: TavilyArticle, regulation: any) => {
  const searchQueries = Array.isArray(regulation.searchQueries) ? regulation.searchQueries : [];
  const triggerWords = Array.isArray(regulation.triggerWords) ? regulation.triggerWords : [];
  const excludedTerms = Array.isArray(regulation.excludedTerms) ? regulation.excludedTerms : [];
  const regulationLabel = regulation.regulationName ?? regulation.regulation_name ?? regulation.id ?? 'unknown regulation';

  return `
You are an expert regulatory intelligence processor. Extract structured information from the news article about a regulation.

Regulation being analyzed: "${regulationLabel}"

Search intent:
- Search queries: ${searchQueries.length ? searchQueries.join(', ') : 'N/A'}
- Trigger words: ${triggerWords.length ? triggerWords.join(', ') : 'N/A'}
- Excluded terms: ${excludedTerms.length ? excludedTerms.join(', ') : 'N/A'}

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
5. If the article is not clearly about the search intent above, return the closest matching regulatory update only if the article explicitly supports it. Do not substitute adjacent frameworks or a more general regulation just because they are related.

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
