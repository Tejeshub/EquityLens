import os
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
GROK_API_KEY = os.getenv("GROK_API_KEY")
GROK_MODEL = os.getenv("GROK_MODEL", "llama-3.1-8b-instant")

# Validate configuration
if not GROK_API_KEY:
    print("❌ ERROR: Missing GROK_API_KEY in environment variables.")
    raise ValueError("❌ Missing GROK_API_KEY in environment variables.")

if not GROK_API_KEY.strip():
    print("❌ ERROR: GROK_API_KEY is empty.")
    raise ValueError("❌ GROK_API_KEY is empty. Please provide a valid API key.")

print(f"grok_client: Initializing with API key (last 4 chars: ...{GROK_API_KEY[-4:]})")

# Initialize Groq client
try:
    client = Groq(api_key=GROK_API_KEY)
    print(f"grok_client: Groq client initialized successfully")
except Exception as e:
    print(f"grok_client: ERROR - Failed to initialize Groq client: {type(e).__name__}: {str(e)}")
    raise


def call_grok(messages: list, temperature: float = 0.2, model: str = None, max_tokens: int = 2048) -> str:
    """
    Call Groq API with the provided messages.
    
    Args:
        messages: List of message dicts with 'role' and 'content' keys
        temperature: Sampling temperature (0.0-2.0)
        model: Model to use (defaults to GROK_MODEL from env)
        max_tokens: Maximum tokens in response
    
    Returns:
        Response text from Groq (empty string on error)
    """
    print(f"call_grok: start - model={model or GROK_MODEL}, messages={len(messages)}")
    try:
        if not messages:
            print(f"call_grok: ERROR - No messages provided")
            return ""
        
        model_to_use = model or GROK_MODEL
        print(f"call_grok: using model={model_to_use}, temperature={temperature}")
        
        print(f"call_grok: calling Groq API")
        response = client.chat.completions.create(
            model=model_to_use,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        print(f"call_grok: response received successfully")
        
        # Extract content from response
        if not response or not response.choices:
            print(f"call_grok: ERROR - No choices in response")
            return ""
        
        first_choice = response.choices[0]
        if not first_choice.message:
            print(f"call_grok: ERROR - No message in first choice")
            return ""
        
        content = first_choice.message.content
        
        if content is None:
            print(f"call_grok: WARNING - Content is None")
            return ""
        
        content = content.strip()
        
        if not content:
            print(f"call_grok: WARNING - Empty content in response")
        
        print(f"call_grok: end (success) - response length={len(content)}")
        return content
        
    except Exception as e:
        print(f"call_grok: ERROR - {type(e).__name__}: {str(e)}")
        # Return empty string instead of raising for graceful degradation
        return ""


def call_grok_with_system_prompt(system_prompt: str, user_message: str, temperature: float = 0.2, **kwargs) -> str:
    """
    Convenience function: Call Groq with a system prompt and user message.
    
    Args:
        system_prompt: System/instruction prompt
        user_message: User query/message
        temperature: Sampling temperature
        **kwargs: Additional arguments to pass to call_grok()
    
    Returns:
        Response text from Groq
    """
    print(f"call_grok_with_system_prompt: start")
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]
    return call_grok(messages, temperature=temperature, **kwargs)


def extract_json_from_text(text: str) -> str:
    """
    Extract JSON object from text that may contain markdown or extra text.
    
    Args:
        text: Text that may contain JSON
    
    Returns:
        JSON string, or empty string if not found
    """
    import re
    text = text.strip()
    
    # Try to find JSON block in markdown code fence
    json_match = re.search(r'```(?:json)?\s*({.*?})\s*```', text, re.DOTALL)
    if json_match:
        print(f"extract_json_from_text: found JSON in markdown code fence")
        return json_match.group(1)
    
    # Try to find JSON object directly (starts with { and ends with })
    json_match = re.search(r'({.*?})', text, re.DOTALL)
    if json_match:
        candidate = json_match.group(1)
        # Quick validation - should have : and be reasonably formatted
        if ':' in candidate:
            print(f"extract_json_from_text: found JSON object directly")
            return candidate
    
    print(f"extract_json_from_text: no JSON found in text")
    return ""