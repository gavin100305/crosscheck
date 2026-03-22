"""Groq API client for making LLM requests."""

import asyncio
import re
from typing import List, Dict, Any, Optional

import httpx

from .config import (
    GROQ_API_KEY,
    GROQ_API_URL,
    GROQ_MAX_CONCURRENT_REQUESTS,
    GROQ_RETRY_ATTEMPTS,
    GROQ_RETRY_BASE_DELAY,
    GROQ_PER_REQUEST_DELAY,
)


_REQUEST_SEMAPHORE = asyncio.Semaphore(max(1, GROQ_MAX_CONCURRENT_REQUESTS))


def sanitize_model_text(text: Optional[str]) -> str:
    """Remove model chain-of-thought tags and normalize noisy output."""
    if not text:
        return ""

    cleaned = text

    # Remove complete <think>...</think> blocks if present.
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.IGNORECASE | re.DOTALL)

    # If model leaked an opening think tag without closing, drop trailing portion.
    cleaned = re.sub(r"<think>.*$", "", cleaned, flags=re.IGNORECASE | re.DOTALL)

    # Normalize non-breaking spaces and repeated blank lines.
    cleaned = cleaned.replace("\u00a0", " ").replace("\u202f", " ")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via Groq API.

    Args:
        model: Groq model identifier
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
    }

    for attempt in range(max(1, GROQ_RETRY_ATTEMPTS)):
        try:
            async with _REQUEST_SEMAPHORE:
                if GROQ_PER_REQUEST_DELAY > 0:
                    await asyncio.sleep(GROQ_PER_REQUEST_DELAY)

                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        GROQ_API_URL,
                        headers=headers,
                        json=payload,
                    )

                    # Retry only on 429 rate limits.
                    if response.status_code == 429 and attempt < GROQ_RETRY_ATTEMPTS - 1:
                        delay = GROQ_RETRY_BASE_DELAY * (2 ** attempt)
                        print(f"Rate limited for model {model}. Retrying in {delay:.1f}s...")
                        await asyncio.sleep(delay)
                        continue

                    response.raise_for_status()

                    data = response.json()
                    message = data["choices"][0]["message"]

                    return {
                        "content": sanitize_model_text(message.get("content")),
                        "reasoning_details": message.get("reasoning_details"),
                    }

        except httpx.HTTPStatusError as e:
            # Do not retry non-429 HTTP errors.
            print(f"Error querying model {model}: {e}")
            return None
        except Exception as e:
            # Retry transient network errors with backoff.
            if attempt < GROQ_RETRY_ATTEMPTS - 1:
                delay = GROQ_RETRY_BASE_DELAY * (2 ** attempt)
                print(f"Transient error for model {model}: {e}. Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)
                continue
            print(f"Error querying model {model}: {e}")
            return None

    return None


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of Groq model identifiers
        messages: List of message dicts to send to each model

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    tasks = [query_model(model, messages) for model in models]
    responses = await asyncio.gather(*tasks)
    return {model: response for model, response in zip(models, responses)}
