use super::types::{BrandAnalysisResult, MentionAnalysis, SentimentScore, ThemeInsight};
use crate::scraper::RedditPost;

/// Build the analysis prompt used by both OpenAI and Claude providers.
pub fn build_analysis_prompt(brand_name: &str, posts: &[RedditPost]) -> String {
    let posts_text: String = posts
        .iter()
        .enumerate()
        .map(|(i, post)| {
            let comments_text: String = post
                .comments
                .iter()
                .take(5)
                .map(|c| format!("  - {} (score: {}): {}", c.author, c.score, c.body))
                .collect::<Vec<_>>()
                .join("\n");

            format!(
                "POST {}: [r/{}] {} (score: {})\nAuthor: {}\nContent: {}\nTop Comments:\n{}\n---",
                i + 1,
                post.subreddit,
                post.title,
                post.score,
                post.author,
                post.selftext.as_deref().unwrap_or("[link post]"),
                comments_text
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    format!(
        r#"Analyze the following Reddit posts about the brand "{brand_name}".

For each post, determine:
1. Sentiment score (-2 to +2, where -2 is very negative and +2 is very positive)
2. Main topics discussed
3. Key points about the brand
4. Whether it's a recommendation or complaint
5. The author's intent

Then provide an overall analysis with:
- Overall sentiment score and confidence
- Top recurring themes with examples
- Actionable recommendations for the brand

POSTS TO ANALYZE:
{posts_text}

Respond in this exact JSON format:
{{
  "overall_sentiment": {{
    "score": <number -2 to 2>,
    "confidence": <number 0 to 1>
  }},
  "mention_analyses": [
    {{
      "post_id": "<post id>",
      "sentiment": {{"score": <number>, "confidence": <number>}},
      "topics": ["topic1", "topic2"],
      "key_points": ["point1", "point2"],
      "is_recommendation": <boolean>,
      "is_complaint": <boolean>,
      "author_intent": "<brief description>"
    }}
  ],
  "top_themes": [
    {{
      "theme": "<theme name>",
      "frequency": <count>,
      "sentiment": <average sentiment>,
      "example_quotes": ["quote1", "quote2"]
    }}
  ],
  "recommendations": ["recommendation1", "recommendation2"],
  "summary": "<2-3 sentence summary>"
}}"#,
        brand_name = brand_name,
        posts_text = posts_text
    )
}

/// Parse the LLM JSON response into a structured BrandAnalysisResult.
/// Shared by both OpenAI and Claude providers.
pub fn parse_analysis_response(
    brand_name: &str,
    text: &str,
    posts: &[RedditPost],
) -> Result<BrandAnalysisResult, String> {
    // Extract JSON from response (might be wrapped in markdown code blocks)
    let json_text = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let parsed: serde_json::Value = serde_json::from_str(json_text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let overall_sentiment = SentimentScore::from_score(
        parsed["overall_sentiment"]["score"]
            .as_f64()
            .unwrap_or(0.0),
        parsed["overall_sentiment"]["confidence"]
            .as_f64()
            .unwrap_or(0.5),
    );

    let mention_analyses: Vec<MentionAnalysis> = parsed["mention_analyses"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .enumerate()
                .map(|(i, m)| MentionAnalysis {
                    post_id: m["post_id"]
                        .as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| {
                            posts.get(i).map(|p| p.id.clone()).unwrap_or_default()
                        }),
                    sentiment: SentimentScore::from_score(
                        m["sentiment"]["score"].as_f64().unwrap_or(0.0),
                        m["sentiment"]["confidence"].as_f64().unwrap_or(0.5),
                    ),
                    topics: m["topics"]
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default(),
                    key_points: m["key_points"]
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default(),
                    is_recommendation: m["is_recommendation"].as_bool().unwrap_or(false),
                    is_complaint: m["is_complaint"].as_bool().unwrap_or(false),
                    author_intent: m["author_intent"]
                        .as_str()
                        .unwrap_or("unknown")
                        .to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    let top_themes: Vec<ThemeInsight> = parsed["top_themes"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|t| ThemeInsight {
                    theme: t["theme"].as_str().unwrap_or("").to_string(),
                    frequency: t["frequency"].as_i64().unwrap_or(0) as i32,
                    sentiment: t["sentiment"].as_f64().unwrap_or(0.0),
                    example_quotes: t["example_quotes"]
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default(),
                })
                .collect()
        })
        .unwrap_or_default();

    let recommendations: Vec<String> = parsed["recommendations"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let summary = parsed["summary"]
        .as_str()
        .unwrap_or("Analysis complete")
        .to_string();

    Ok(BrandAnalysisResult {
        brand_name: brand_name.to_string(),
        overall_sentiment,
        mention_analyses,
        top_themes,
        recommendations,
        summary,
    })
}
