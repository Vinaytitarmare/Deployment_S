
import base64
import os

try:
    src = r"d:/palloti hack/Rag/intelligence-service/serviceAccountKey.json"
    dest = r"d:/palloti hack/Rag/backend/encoded_key.txt"
    
    with open(src, 'rb') as f:
        content = f.read()
        
    encoded = base64.b64encode(content).decode('utf-8')
    
    with open(dest, 'w') as f:
        f.write(encoded)
        
    print("SUCCESS: Key encoded.")
except Exception as e:
    print(f"ERROR: {e}")
