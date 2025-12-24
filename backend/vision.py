import os
import base64
from dotenv import load_dotenv
from mistralai import Mistral

load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

try:
    mistral_client = Mistral(api_key=MISTRAL_API_KEY)
except Exception as e:
    print(f"Warning: Failed to initialize Mistral client: {e}")
    mistral_client = None

def analyze_image_logic(image_bytes: bytes, user_prompt: str = None, mode: str = "qa") -> dict:
    """
    Analyzes an image using Mistral API (Pixtral).
    
    mode: "qa" (Default) or "extraction" (OCR-like)
    """
    if not mistral_client:
        return {
            "success": False,
            "answer": "Mistral API client not initialized. Check MISTRAL_API_KEY.",
            "model_used": "none"
        }

    # Encode image to base64 data URL
    try:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        data_url = f"data:image/jpeg;base64,{base64_image}"
    except Exception as e:
        return {
            "success": False,
            "answer": f"Error encoding image: {str(e)}",
            "model_used": "none"
        }
    
    final_prompt = user_prompt or "Describe this image in detail."
    
    if mode == "extraction":
        system_instruction = """You are a high-precision OCR and Layout Analysis engine. 
Your goal is to transcribe ALL visible text from the image into a structured Markdown format.
- Preserve headings (#), lists, and tables.
- Do NOT add commentary or conversational filler.
- Output ONLY the extracted text content.
"""
        user_message_text = f"{system_instruction}\n\nExtract all text from this screen."
    else:
        # QA Mode
        system_instruction = """You are a strict Visual QA agent. You answer questions strictly based on the provided IMAGE.
CRITICAL RULES:
1. Answer ONLY using visual evidence from the image.
2. If the user asks a question that cannot be answered from the image content (e.g., code generation not shown in image, general knowledge), you MUST REFUSE to answer.
3. Your refusal message should be: 'I cannot answer this question based on the visible content of this image.'
4. Do NOT hallucinate content or use outside knowledge.
5. Follow-up suggestions must be derived strictly from visible UI elements.
"""
        user_message_text = f"{system_instruction}\n\nUser Question: {final_prompt}"

    # Use a Pixtral model
    model_name = "pixtral-12b-2409" 

    try:
        print(f"Vision Analysis (Mistral) using model: {model_name}")
        
        chat_response = mistral_client.chat.complete(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_message_text
                        },
                        {
                            "type": "image_url",
                            "image_url": data_url
                        }
                    ]
                }
            ]
        )
        
        answer = chat_response.choices[0].message.content
        
        return {
            "answer": answer,
            "success": True,
            "model_used": model_name
        }

    except Exception as e:
        error_msg = str(e)
        # Log error
        with open("debug_error.log", "a", encoding="utf-8") as f:
            f.write(f"\n[Error] Mistral Vision ({model_name}): {error_msg}\n")
        print(f"Mistral Vision Error ({model_name}): {error_msg}")
        
        return {
            "success": False,
            "answer": f"Error analyzing image: {error_msg}",
            "model_used": model_name
        }
