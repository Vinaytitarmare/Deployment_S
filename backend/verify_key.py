from dotenv import load_dotenv
import os
import sys

print("--- Starting Verify Script ---", flush=True)

# 1. Check existing env before loading .env
pre_load_key = os.getenv("GOOGLE_API_KEY")
print(f"Pre-load Key: {pre_load_key[:10]}..." if pre_load_key else "Pre-load Key: None", flush=True)

# 2. Load .env normally (no override)
load_dotenv()
normal_load_key = os.getenv("GOOGLE_API_KEY")
print(f"Normal Load Key: {normal_load_key[:10]}..." if normal_load_key else "Normal Load Key: None", flush=True)

# 3. Load with override
load_dotenv(override=True)
override_load_key = os.getenv("GOOGLE_API_KEY")
print(f"Override Load Key: {override_load_key[:10]}..." if override_load_key else "Override Load Key: None", flush=True)

print("--- End Verify Script ---", flush=True)
