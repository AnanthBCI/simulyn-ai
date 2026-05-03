"""Pytest setup — ensure the ai-service root is on sys.path so `import main` works."""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Force LLM off for tests so the rule engine / deterministic fallbacks are exercised
# (and no accidental live API calls happen in CI).
os.environ["LLM_PROVIDER"] = "off"
