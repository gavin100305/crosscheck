"""Debate-based Crosscheck orchestration."""

import asyncio
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from .config import (
    AUDITOR_MODEL,
    COUNCIL_MODELS,
    GROQ_API_KEY,
    GROQ_API_KEY_2,
    JUDGE_MODELS,
    PIPELINE_VERSION,
    SYNTHESIZER_MODEL,
)
from .groq import query_model, query_models_parallel, sanitize_model_text


def clip_text(text: Optional[str], limit: int = 700) -> str:
    """Trim long text to keep prompts compact."""
    cleaned = sanitize_model_text(text or "")
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


def short_model_name(model: str) -> str:
    """Return a compact model label for display inside prompts."""
    return model.split("/")[-1]


def fallback_summary(text: str, limit: int = 220) -> str:
    """Create a compact summary if a model does not provide one."""
    compact = re.sub(r"\s+", " ", sanitize_model_text(text))
    return compact[:limit].rstrip()


def extract_json_object(text: Optional[str]) -> Optional[Dict[str, Any]]:
    """Best-effort JSON extraction from a model response."""
    if not text:
        return None

    cleaned = sanitize_model_text(text)

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, flags=re.DOTALL)
    if fenced:
        cleaned = fenced.group(1)

    candidates = []
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1 and first < last:
        candidates.append(cleaned[first:last + 1])
    candidates.append(cleaned)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


def normalize_string(value: Any, default: str = "") -> str:
    """Normalize a value into a display-safe string."""
    if isinstance(value, str):
        return sanitize_model_text(value)
    if value is None:
        return default
    return sanitize_model_text(str(value))


def normalize_string_list(value: Any) -> List[str]:
    """Normalize list-like values returned by models."""
    if isinstance(value, list):
        items = [normalize_string(item) for item in value]
        return [item for item in items if item]
    if isinstance(value, str):
        items = [part.strip(" -") for part in value.split("\n")]
        return [item for item in items if item]
    return []


def normalize_score(value: Any, default: float = 0.0) -> float:
    """Parse numeric judge scores safely."""
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        match = re.search(r"\d+(?:\.\d+)?", value)
        number = float(match.group()) if match else default
    else:
        number = default

    return max(0.0, min(10.0, round(number, 1)))


def build_pairings(models: List[str]) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]]]:
    """Create deterministic pairings for the two debate rounds."""
    if len(models) <= 1:
        return [], []

    if len(models) == 2:
        pairings = [(models[0], models[1]), (models[1], models[0])]
        return pairings, pairings

    round_one = [
        (models[0], models[1]),
        (models[1], models[2]),
        (models[2], models[0]),
    ]
    round_two = [
        (models[0], models[2]),
        (models[1], models[0]),
        (models[2], models[1]),
    ]
    return round_one, round_two


def latest_responses_from_rounds(
    stage1_results: List[Dict[str, Any]],
    rounds: List[Dict[str, Any]],
) -> Dict[str, Dict[str, str]]:
    """Recover the latest response and summary for each model."""
    latest = {
        result["model"]: {
            "response": result["response"],
            "summary": result.get("summary") or fallback_summary(result["response"]),
        }
        for result in stage1_results
    }

    for round_info in rounds:
        for exchange in round_info.get("exchanges", []):
            target_model = exchange.get("target_model")
            revised_response = normalize_string(exchange.get("revised_response"))
            revised_summary = normalize_string(exchange.get("revised_summary")) or fallback_summary(
                revised_response
            )
            if target_model and revised_response:
                latest[target_model] = {
                    "response": revised_response,
                    "summary": revised_summary,
                }

    return latest


def make_rating_label(score: float) -> str:
    """Map average judge score to a user-facing label."""
    if score >= 8.5:
        return "Strong"
    if score >= 7.0:
        return "Good"
    if score >= 5.5:
        return "Mixed"
    return "Weak"


async def generate_conversation_title(user_query: str) -> str:
    """Generate a short title for a conversation based on the first user message."""
    words = [w for w in user_query.replace("\n", " ").split(" ") if w.strip()]
    if not words:
        return "New Conversation"

    title = " ".join(words[:5])
    if len(title) > 50:
        title = title[:47] + "..."

    return title


async def stage1_collect_responses(user_query: str) -> List[Dict[str, Any]]:
    """Stage 1: Collect concise opening answers from all council models."""
    opening_prompt = f"""You are a council member in Crosscheck.

Answer the user's question concisely and carefully. Keep the total response compact.

Return valid JSON with this exact shape:
{{
  "response": "2-4 short paragraphs with the answer",
  "summary": "1 sentence summary of your core conclusion"
}}

Question: {user_query}"""

    messages = [{"role": "user", "content": opening_prompt}]
    responses = await query_models_parallel(COUNCIL_MODELS, messages, api_key=GROQ_API_KEY)

    stage1_results = []
    for model, response in responses.items():
        if response is None:
            continue

        content = sanitize_model_text(response.get("content", ""))
        parsed = extract_json_object(content) or {}
        final_response = normalize_string(parsed.get("response")) or content
        final_summary = normalize_string(parsed.get("summary")) or fallback_summary(final_response)

        stage1_results.append({
            "model": model,
            "response": final_response,
            "summary": final_summary,
        })

    return stage1_results


async def query_round_critiques(
    user_query: str,
    latest_positions: Dict[str, Dict[str, str]],
    pairings: List[Tuple[str, str]],
    round_number: int,
) -> Dict[Tuple[str, str], str]:
    """Collect critiques for a debate round."""

    async def get_critique(critic_model: str, target_model: str) -> Tuple[Tuple[str, str], str]:
        target_position = latest_positions[target_model]
        critique_prompt = f"""You are {short_model_name(critic_model)} in a short AI debate.

User question: {user_query}
Peer answer summary: {target_position['summary']}
Peer answer excerpt: {clip_text(target_position['response'], 500)}

Round: {round_number}

Critique the peer answer briefly. Focus on accuracy, missing nuance, and the single most important challenge.

Return valid JSON:
{{
  "critique": "2-4 sentences challenging or refining the answer",
  "question": "1 short question the peer should answer"
}}"""

        response = await query_model(
            critic_model,
            [{"role": "user", "content": critique_prompt}],
            api_key=GROQ_API_KEY,
        )
        if response is None:
            return (critic_model, target_model), ""

        content = sanitize_model_text(response.get("content", ""))
        parsed = extract_json_object(content) or {}
        critique = normalize_string(parsed.get("critique")) or content
        question = normalize_string(parsed.get("question"))
        combined = critique if not question else f"{critique}\n\nQuestion: {question}"
        return (critic_model, target_model), combined

    tasks = [get_critique(critic_model, target_model) for critic_model, target_model in pairings]
    results = await asyncio.gather(*tasks)
    return {pairing: critique for pairing, critique in results}


async def query_round_rebuttals(
    user_query: str,
    latest_positions: Dict[str, Dict[str, str]],
    pairings: List[Tuple[str, str]],
    critiques: Dict[Tuple[str, str], str],
    round_number: int,
    concise_mode: bool,
) -> List[Dict[str, Any]]:
    """Collect rebuttals and revised answers for a debate round."""

    async def get_rebuttal(critic_model: str, target_model: str) -> Dict[str, Any]:
        target_position = latest_positions[target_model]
        critique = critiques.get((critic_model, target_model), "")
        brevity_line = (
            "Keep every field extremely short because the debate is near consensus."
            if concise_mode
            else "Keep every field concise and decision-focused."
        )
        rebuttal_prompt = f"""You are {short_model_name(target_model)} responding to a peer challenge.

User question: {user_query}
Your current answer summary: {target_position['summary']}
Your current answer excerpt: {clip_text(target_position['response'], 500)}

Incoming critique from peer {short_model_name(critic_model)}:
{clip_text(critique, 500)}

Round: {round_number}
{brevity_line}

Return valid JSON:
{{
  "rebuttal": "2-4 sentences addressing the critique",
  "revised_response": "updated final answer in 1-3 short paragraphs",
  "summary": "1 sentence updated conclusion"
}}"""

        response = await query_model(
            target_model,
            [{"role": "user", "content": rebuttal_prompt}],
            api_key=GROQ_API_KEY,
        )
        if response is None:
            return {
                "critic_model": critic_model,
                "target_model": target_model,
                "critique": critique,
                "rebuttal": "No rebuttal generated.",
                "revised_response": target_position["response"],
                "revised_summary": target_position["summary"],
            }

        content = sanitize_model_text(response.get("content", ""))
        parsed = extract_json_object(content) or {}
        revised_response = normalize_string(parsed.get("revised_response")) or target_position["response"]
        revised_summary = normalize_string(parsed.get("summary")) or fallback_summary(revised_response)

        return {
            "critic_model": critic_model,
            "target_model": target_model,
            "critique": critique,
            "rebuttal": normalize_string(parsed.get("rebuttal")) or content,
            "revised_response": revised_response,
            "revised_summary": revised_summary,
        }

    tasks = [
        get_rebuttal(critic_model, target_model)
        for critic_model, target_model in pairings
    ]
    return await asyncio.gather(*tasks)


async def assess_round1_consensus(
    user_query: str,
    round_exchanges: List[Dict[str, Any]],
) -> str:
    """Use the auditor to decide whether round 2 can use reduced context."""
    if not round_exchanges or not GROQ_API_KEY_2:
        return "unknown"

    exchange_lines = []
    for exchange in round_exchanges:
        exchange_lines.append(
            f"{short_model_name(exchange['critic_model'])} -> {short_model_name(exchange['target_model'])}: "
            f"critique={clip_text(exchange['critique'], 220)} | revised={clip_text(exchange['revised_summary'], 180)}"
        )

    prompt = f"""You are checking whether an AI council already shows strong consensus after round 1.

Question: {user_query}
Round 1 exchanges:
{chr(10).join(exchange_lines)}

Return valid JSON:
{{
  "consensus_level": "strong" or "moderate" or "low",
  "reason": "1 short sentence"
}}"""

    response = await query_model(
        AUDITOR_MODEL,
        [{"role": "user", "content": prompt}],
        api_key=GROQ_API_KEY_2,
    )
    if response is None:
        return "unknown"

    parsed = extract_json_object(response.get("content", "")) or {}
    level = normalize_string(parsed.get("consensus_level")).lower()
    return level if level in {"strong", "moderate", "low"} else "unknown"


async def build_audit_summary(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    rounds: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Summarize debate outcomes for users and downstream judging."""
    latest_positions = latest_responses_from_rounds(stage1_results, rounds)
    opening_lines = [
        f"{short_model_name(result['model'])}: {result.get('summary') or fallback_summary(result['response'])}"
        for result in stage1_results
    ]

    round_lines = []
    for round_info in rounds:
        for exchange in round_info.get("exchanges", []):
            round_lines.append(
                f"Round {round_info['round_number']} | "
                f"{short_model_name(exchange['critic_model'])} -> {short_model_name(exchange['target_model'])} | "
                f"critique={clip_text(exchange['critique'], 180)} | "
                f"rebuttal={clip_text(exchange['rebuttal'], 180)} | "
                f"revision={clip_text(exchange['revised_summary'], 140)}"
            )

    latest_lines = [
        f"{short_model_name(model)}: {position['summary']}"
        for model, position in latest_positions.items()
    ]

    if not GROQ_API_KEY_2:
        return {
            "agreements": latest_lines[:2] or ["No audit key configured."],
            "conflicts": ["Audit skipped because GROQ_API_KEY_2 is missing."],
            "unresolved_risks": [],
            "recommendation": "Use the latest revised answers as the basis for synthesis.",
            "consensus_level": "unknown",
        }

    prompt = f"""You are the auditor for Crosscheck. Summarize the debate clearly and briefly.

Question: {user_query}

Opening summaries:
{chr(10).join(opening_lines) or "None"}

Debate exchanges:
{chr(10).join(round_lines) or "No debate exchanges"}

Latest positions:
{chr(10).join(latest_lines) or "None"}

Return valid JSON:
{{
  "agreements": ["2-4 short bullets"],
  "conflicts": ["0-3 short bullets"],
  "unresolved_risks": ["0-3 short bullets"],
  "recommendation": "1-2 sentences on what the final answer should rely on",
  "consensus_level": "strong" or "moderate" or "low"
}}"""

    response = await query_model(
        AUDITOR_MODEL,
        [{"role": "user", "content": prompt}],
        api_key=GROQ_API_KEY_2,
    )
    if response is None:
        return {
            "agreements": latest_lines[:2] or ["No audit response available."],
            "conflicts": [],
            "unresolved_risks": ["Auditor did not respond."],
            "recommendation": "Synthesize from the latest debater positions.",
            "consensus_level": "unknown",
        }

    parsed = extract_json_object(response.get("content", "")) or {}
    return {
        "agreements": normalize_string_list(parsed.get("agreements")) or latest_lines[:2],
        "conflicts": normalize_string_list(parsed.get("conflicts")),
        "unresolved_risks": normalize_string_list(parsed.get("unresolved_risks")),
        "recommendation": normalize_string(parsed.get("recommendation"))
        or "Synthesize from the most consistent revised answers.",
        "consensus_level": normalize_string(parsed.get("consensus_level")).lower() or "unknown",
    }


async def stage2_run_debate(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Stage 2: Run two rounds of debate and summarize with an auditor."""
    active_models = [result["model"] for result in stage1_results]
    latest_positions = {
        result["model"]: {
            "response": result["response"],
            "summary": result.get("summary") or fallback_summary(result["response"]),
        }
        for result in stage1_results
    }
    round_one_pairings, round_two_pairings = build_pairings(active_models)

    rounds: List[Dict[str, Any]] = []
    if round_one_pairings:
        round_one_critiques = await query_round_critiques(
            user_query,
            latest_positions,
            round_one_pairings,
            round_number=1,
        )
        round_one_exchanges = await query_round_rebuttals(
            user_query,
            latest_positions,
            round_one_pairings,
            round_one_critiques,
            round_number=1,
            concise_mode=False,
        )
        for exchange in round_one_exchanges:
            latest_positions[exchange["target_model"]] = {
                "response": exchange["revised_response"],
                "summary": exchange["revised_summary"],
            }
        rounds.append({"round_number": 1, "exchanges": round_one_exchanges})

    consensus_level = await assess_round1_consensus(
        user_query,
        rounds[0]["exchanges"] if rounds else [],
    )

    if round_two_pairings:
        round_two_critiques = await query_round_critiques(
            user_query,
            latest_positions,
            round_two_pairings,
            round_number=2,
        )
        round_two_exchanges = await query_round_rebuttals(
            user_query,
            latest_positions,
            round_two_pairings,
            round_two_critiques,
            round_number=2,
            concise_mode=consensus_level == "strong",
        )
        for exchange in round_two_exchanges:
            latest_positions[exchange["target_model"]] = {
                "response": exchange["revised_response"],
                "summary": exchange["revised_summary"],
            }
        rounds.append({"round_number": 2, "exchanges": round_two_exchanges})

    audit_summary = await build_audit_summary(user_query, stage1_results, rounds)
    if audit_summary.get("consensus_level") == "unknown" and consensus_level != "unknown":
        audit_summary["consensus_level"] = consensus_level

    return {
        "rounds": rounds,
        "audit_summary": audit_summary,
    }


async def synthesize_final_response(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: Dict[str, Any],
) -> Dict[str, str]:
    """Create the final conclusion from openings, debate, and audit."""
    latest_positions = latest_responses_from_rounds(stage1_results, stage2_results.get("rounds", []))
    opening_lines = [
        f"{short_model_name(result['model'])}: {result.get('summary') or fallback_summary(result['response'])}"
        for result in stage1_results
    ]
    latest_lines = [
        f"{short_model_name(model)}: {position['summary']}"
        for model, position in latest_positions.items()
    ]

    audit_summary = stage2_results.get("audit_summary", {})
    prompt = f"""You are the Crosscheck synthesizer.

User question: {user_query}

Opening summaries:
{chr(10).join(opening_lines) or "None"}

Latest debater positions:
{chr(10).join(latest_lines) or "None"}

Audit summary:
- Agreements: {json.dumps(audit_summary.get('agreements', []))}
- Conflicts: {json.dumps(audit_summary.get('conflicts', []))}
- Unresolved risks: {json.dumps(audit_summary.get('unresolved_risks', []))}
- Recommendation: {audit_summary.get('recommendation', '')}
- Consensus level: {audit_summary.get('consensus_level', 'unknown')}

Write one final answer for the user.

Return valid JSON:
{{
  "response": "2-5 short paragraphs with the final answer"
}}"""

    response = await query_model(
        SYNTHESIZER_MODEL,
        [{"role": "user", "content": prompt}],
        api_key=GROQ_API_KEY,
    )
    if response is None:
        fallback_model = stage1_results[0]["model"]
        fallback_response = latest_positions.get(fallback_model, {}).get(
            "response",
            stage1_results[0]["response"],
        )
        return {
            "model": fallback_model,
            "response": fallback_response,
        }

    content = sanitize_model_text(response.get("content", ""))
    parsed = extract_json_object(content) or {}
    return {
        "model": SYNTHESIZER_MODEL,
        "response": normalize_string(parsed.get("response")) or content,
    }


async def judge_final_response(
    user_query: str,
    final_response: Dict[str, str],
    stage1_results: List[Dict[str, Any]],
    stage2_results: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Collect judge reviews using the secondary Groq key."""
    if not GROQ_API_KEY_2:
        return []

    latest_positions = latest_responses_from_rounds(stage1_results, stage2_results.get("rounds", []))
    debate_context = [
        f"{short_model_name(model)}: {position['summary']}"
        for model, position in latest_positions.items()
    ]
    audit_summary = stage2_results.get("audit_summary", {})

    async def get_review(model: str) -> Optional[Dict[str, Any]]:
        judge_prompt = f"""You are an independent judge evaluating the final Crosscheck answer.

Question: {user_query}
Final answer to score:
{clip_text(final_response['response'], 1800)}

Latest council positions:
{chr(10).join(debate_context) or "None"}

Audit summary:
- Agreements: {json.dumps(audit_summary.get('agreements', []))}
- Conflicts: {json.dumps(audit_summary.get('conflicts', []))}
- Unresolved risks: {json.dumps(audit_summary.get('unresolved_risks', []))}
- Consensus level: {audit_summary.get('consensus_level', 'unknown')}

Return valid JSON:
{{
  "overall_score_0_to_10": 0,
  "accuracy_score": 0,
  "reasoning_score": 0,
  "completeness_score": 0,
  "verdict": "2-4 sentences",
  "concerns": ["0-3 short concerns"]
}}"""

        response = await query_model(
            model,
            [{"role": "user", "content": judge_prompt}],
            api_key=GROQ_API_KEY_2,
        )
        if response is None:
            return None

        content = sanitize_model_text(response.get("content", ""))
        parsed = extract_json_object(content) or {}
        return {
            "model": model,
            "overall_score_0_to_10": normalize_score(parsed.get("overall_score_0_to_10"), 0.0),
            "accuracy_score": normalize_score(parsed.get("accuracy_score"), 0.0),
            "reasoning_score": normalize_score(parsed.get("reasoning_score"), 0.0),
            "completeness_score": normalize_score(parsed.get("completeness_score"), 0.0),
            "verdict": normalize_string(parsed.get("verdict")) or clip_text(content, 450),
            "concerns": normalize_string_list(parsed.get("concerns")),
        }

    tasks = [get_review(model) for model in JUDGE_MODELS]
    raw_reviews = await asyncio.gather(*tasks)
    return [review for review in raw_reviews if review is not None]


def build_final_rating(judge_reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate judge scores into a final rating."""
    if not judge_reviews:
        return {
            "average_score_0_to_10": 0.0,
            "responding_judges": 0,
            "label": "Unavailable",
        }

    average = round(
        sum(review["overall_score_0_to_10"] for review in judge_reviews) / len(judge_reviews),
        1,
    )
    return {
        "average_score_0_to_10": average,
        "responding_judges": len(judge_reviews),
        "label": make_rating_label(average),
    }


async def stage3_finalize(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: Dict[str, Any],
) -> Dict[str, Any]:
    """Stage 3: Synthesize the final conclusion and ask judges to rate it."""
    final_response = await synthesize_final_response(user_query, stage1_results, stage2_results)
    judge_reviews = await judge_final_response(user_query, final_response, stage1_results, stage2_results)

    return {
        "final_response": final_response,
        "judge_reviews": judge_reviews,
        "final_rating": build_final_rating(judge_reviews),
    }


async def run_full_council(user_query: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """Run the full debate-based council pipeline."""
    stage1_results = await stage1_collect_responses(user_query)

    if not stage1_results:
        return [], {"rounds": [], "audit_summary": {}}, {
            "final_response": {
                "model": "error",
                "response": "All models failed to respond. Please try again.",
            },
            "judge_reviews": [],
            "final_rating": {
                "average_score_0_to_10": 0.0,
                "responding_judges": 0,
                "label": "Unavailable",
            },
        }, {
            "pipeline_version": PIPELINE_VERSION,
            "participating_models": [],
            "audit_model": AUDITOR_MODEL,
            "judge_models": JUDGE_MODELS,
            "role_assignments": {},
            "uses_secondary_groq_key_for_audit_and_judges": bool(GROQ_API_KEY_2),
            "token_budget_mode": "concise",
        }

    stage2_results = await stage2_run_debate(user_query, stage1_results)
    stage3_results = await stage3_finalize(user_query, stage1_results, stage2_results)

    participating_models = [result["model"] for result in stage1_results]
    metadata = {
        "pipeline_version": PIPELINE_VERSION,
        "participating_models": participating_models,
        "audit_model": AUDITOR_MODEL,
        "judge_models": JUDGE_MODELS,
        "role_assignments": {
            "debaters": participating_models,
            "synthesizer": SYNTHESIZER_MODEL,
            "auditor": AUDITOR_MODEL,
            "judges": JUDGE_MODELS,
        },
        "uses_secondary_groq_key_for_audit_and_judges": bool(GROQ_API_KEY_2),
        "token_budget_mode": "concise",
    }

    return stage1_results, stage2_results, stage3_results, metadata
