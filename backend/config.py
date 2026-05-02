"""Configuration for Crosscheck."""

import os
from dotenv import load_dotenv

load_dotenv()

# Groq API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_KEY_2 = os.getenv("GROQ_API_KEY_2")

# Council members - list of Groq model identifiers
COUNCIL_MODELS = [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "qwen/qwen3-32b",
]

# Role-based model assignments
SYNTHESIZER_MODEL = "openai/gpt-oss-120b"
AUDITOR_MODEL = "openai/gpt-oss-120b"
JUDGE_MODELS = [
    "llama-3.3-70b-versatile",
    "qwen/qwen3-32b",
]

PIPELINE_VERSION = 2

# Groq API endpoint
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Groq request controls to reduce 429 responses
GROQ_MAX_CONCURRENT_REQUESTS = int(os.getenv("GROQ_MAX_CONCURRENT_REQUESTS", "1"))
GROQ_RETRY_ATTEMPTS = int(os.getenv("GROQ_RETRY_ATTEMPTS", "3"))
GROQ_RETRY_BASE_DELAY = float(os.getenv("GROQ_RETRY_BASE_DELAY", "1.5"))
GROQ_PER_REQUEST_DELAY = float(os.getenv("GROQ_PER_REQUEST_DELAY", "0.2"))

# Data directory for conversation storage
DATA_DIR = "data/conversations"
