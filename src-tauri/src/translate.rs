//! Translating a message body, on demand, with free services and no key.
//!
//! Google Translate's unofficial endpoint is tried first: it needs no key,
//! costs nothing and translates English–Vietnamese well. When it fails,
//! MyMemory is tried: also free and keyless, with a small daily allowance
//! per IP address (5,000 characters a day). Nothing is translated unless
//! the user presses the button: the text of the message leaves the computer
//! only then, and only the plain-text body is sent, never attachments.

use serde::Serialize;

use crate::error::{Error, Result};

/// What a translation call returns: the translated text and which service did it.
#[derive(Serialize)]
pub struct Translation {
    text: String,
    provider: String,
    /// Language Google detected, when it says so ("en", "vi", ...).
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
}

/// Split `text` into pieces of at most `limit` characters, preferring line
/// breaks so sentences are not cut in half. A single over-long line is cut.
fn chunks(text: &str, limit: usize) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut cur = String::new();
    for line in text.split_inclusive('\n') {
        if !cur.is_empty() && cur.chars().count() + line.chars().count() > limit {
            out.push(std::mem::take(&mut cur));
        }
        if line.chars().count() > limit {
            let mut rest = line;
            while rest.chars().count() > limit {
                let cut: String = rest.chars().take(limit).collect();
                let cut_len = cut.len();
                out.push(cut);
                rest = &rest[cut_len..];
            }
            cur.push_str(rest);
        } else {
            cur.push_str(line);
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// Percent-encode a query value: everything except the unreserved
/// characters (letters, digits, `-_.~`) becomes %XX, UTF-8 byte by byte.
/// Hand-rolled because reqwest here runs with `default-features = false`
/// and no `query` feature, so `RequestBuilder::query` does not exist.
fn encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for &b in value.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// Read Google's answer: the translated sentences live in the first array,
/// the detected source language (when present) in the third slot.
fn parse_google(body: &str) -> Option<(String, Option<String>)> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    let mut text = String::new();
    for sentence in v.get(0)?.as_array()? {
        if let Some(t) = sentence.get(0).and_then(|x| x.as_str()) {
            text.push_str(t);
        }
    }
    let source = v.get(2).and_then(|x| x.as_str()).map(|s| s.to_string());
    if text.is_empty() {
        None
    } else {
        Some((text, source))
    }
}

/// Translate with Google's unofficial endpoint, chunk by chunk.
async fn via_google(
    client: &reqwest::Client,
    text: &str,
    target: &str,
) -> Result<(String, Option<String>)> {
    let mut out = String::new();
    let mut source: Option<String> = None;
    let target = encode(target);
    for chunk in chunks(text, 4000) {
        let url = format!(
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target}&dt=t&q={}",
            encode(&chunk),
        );
        let body = client
            .get(url)
            .send()
            .await
            .map_err(|e| Error(format!("Google Translate did not answer: {e}")))?
            .error_for_status()
            .map_err(|e| Error(format!("Google Translate refused the request: {e}")))?
            .text()
            .await
            .map_err(|e| Error(format!("Google Translate's answer could not be read: {e}")))?;
        let (t, s) = parse_google(&body)
            .ok_or_else(|| Error("Google Translate's answer could not be read.".to_string()))?;
        if source.is_none() {
            source = s;
        }
        out.push_str(&t);
    }
    Ok((out, source))
}

/// Read MyMemory's answer. A warning text instead of a translation (daily
/// allowance used up, request too long) counts as a failure.
fn parse_mymemory(body: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    if v.get("responseStatus")?.as_i64()? != 200 {
        return None;
    }
    let text = v
        .get("responseData")?
        .get("translatedText")?
        .as_str()?;
    if text.contains("MYMEMORY WARNING") || text.contains("QUERY LENGTH LIMIT") {
        return None;
    }
    Some(text.to_string())
}

/// Translate with MyMemory, chunk by chunk (its GET requests take ~400 characters).
async fn via_mymemory(client: &reqwest::Client, text: &str, target: &str) -> Result<String> {
    let langpair = encode(&format!("auto|{target}"));
    let mut out = String::new();
    for chunk in chunks(text, 400) {
        let url = format!(
            "https://api.mymemory.translated.net/get?q={}&langpair={langpair}",
            encode(&chunk),
        );
        let body = client
            .get(url)
            .send()
            .await
            .map_err(|e| Error(format!("MyMemory did not answer: {e}")))?
            .error_for_status()
            .map_err(|e| Error(format!("MyMemory refused the request: {e}")))?
            .text()
            .await
            .map_err(|e| Error(format!("MyMemory's answer could not be read: {e}")))?;
        let t = parse_mymemory(&body)
            .ok_or_else(|| Error("MyMemory's answer could not be read.".to_string()))?;
        out.push_str(&t);
    }
    Ok(out)
}

/// Translate `text` into `target` ("en" or "vi"). Google first, MyMemory
/// when Google fails. When the text is already in the target language the
/// original comes back with provider "same", so the reader can say so.
#[tauri::command]
pub async fn translate_text(text: String, target: String) -> Result<Translation> {
    if text.trim().is_empty() {
        return Ok(Translation {
            text,
            provider: "same".to_string(),
            source: None,
        });
    }
    let client = reqwest::Client::builder()
        .user_agent("VN Mail")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| Error(format!("Could not start the translation: {e}")))?;
    match via_google(&client, &text, &target).await {
        Ok((translated, source)) => {
            if source.as_deref() == Some(target.as_str()) {
                Ok(Translation {
                    text,
                    provider: "same".to_string(),
                    source,
                })
            } else {
                Ok(Translation {
                    text: translated,
                    provider: "Google".to_string(),
                    source,
                })
            }
        }
        Err(_) => {
            let translated = via_mymemory(&client, &text, &target).await?;
            Ok(Translation {
                text: translated,
                provider: "MyMemory".to_string(),
                source: None,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn google_answer_parses() {
        let body = r###"[[["Xin chào, cảm ơn email của bạn. ","Hello, thank you for your email. ",null,null,3],[ "Chúng tôi sẽ ra mắt trò chơi vào tuần tới.","We will launch the game next week.",null,null,3]],null,"en"]###;
        let (text, source) = parse_google(body).expect("parses");
        assert!(text.contains("Xin chào"));
        assert!(text.contains("tuần tới"));
        assert_eq!(source.as_deref(), Some("en"));
    }

    #[test]
    fn google_empty_answer_rejected() {
        assert!(parse_google(r###"[[],null,"en"]###).is_none());
        assert!(parse_google("not json").is_none());
    }

    #[test]
    fn mymemory_answer_parses() {
        let body = r###"{"responseData":{"translatedText":"Xin chào"},"responseStatus":200}"###;
        assert_eq!(parse_mymemory(body).as_deref(), Some("Xin chào"));
    }

    #[test]
    fn mymemory_quota_warning_rejected() {
        let body = r###"{"responseData":{"translatedText":"MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"},"responseStatus":429}"###;
        assert!(parse_mymemory(body).is_none());
    }

    #[test]
    fn encode_keeps_safe_chars_and_escapes_the_rest() {
        assert_eq!(encode("vi"), "vi");
        assert_eq!(encode("auto|vi"), "auto%7Cvi");
        assert_eq!(encode("Xin chào!"), "Xin%20ch%C3%A0o%21");
        assert_eq!(encode("a&b=c"), "a%26b%3Dc");
    }

    #[test]
    fn chunks_keep_lines_and_rejoin() {
        let text = "first line\nsecond line\nthird line\n";
        let pieces = chunks(text, 12);
        assert!(pieces.iter().all(|p| p.chars().count() <= 12));
        assert_eq!(pieces.concat(), text);
        let long = "à".repeat(25);
        let pieces = chunks(&long, 10);
        assert_eq!(pieces.len(), 3);
        assert_eq!(pieces.concat(), long);
    }
}
