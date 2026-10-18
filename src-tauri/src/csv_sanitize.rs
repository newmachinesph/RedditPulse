/// Sanitize a string value for safe CSV inclusion.
/// Prevents formula injection by prefixing dangerous leading characters with a single quote.
/// Characters that trigger formula execution in spreadsheets: =, +, -, @, |, \t, \r, \n
pub fn sanitize_csv_field(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Check if the first character could trigger formula execution
    let first_char = trimmed.chars().next().unwrap();
    if matches!(first_char, '=' | '+' | '-' | '@' | '\t' | '\r' | '\n' | '|') {
        format!("'{}", trimmed)
    } else {
        trimmed.to_string()
    }
}

/// Sanitize and quote a value for CSV, escaping internal double quotes.
pub fn csv_quote(value: &str) -> String {
    let sanitized = sanitize_csv_field(value);
    let escaped = sanitized.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}
