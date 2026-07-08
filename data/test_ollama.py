import sys
try:
    import ollama
except ImportError:
    print("Error: ollama library not found.")
    sys.exit(1)

def main():
    print("--- Listing Installed Ollama Models ---")
    try:
        models_response = ollama.list()
        models = models_response.get("models", [])
        if not models:
            print("No models found in Ollama!")
            return
            
        for m in models:
            name = m.get("name")
            size = m.get("size", 0) / (1024**3) # GB
            print(f"- {name} ({size:.2f} GB)")
            
    except Exception as e:
        print(f"Error querying Ollama models: {e}")
        return

    print("\n--- Running a Quick test with Ollama ---")
    # Let's see if we can do a simple request to verify what happens
    test_model = "gpt-oss-20b"
    print(f"Testing model: {test_model}")
    try:
        response = ollama.chat(
            model=test_model,
            messages=[
                {"role": "user", "content": "What is the capital of France?"}
            ]
        )
        print("Response received successfully:")
        print(response.get("message", {}).get("content", ""))
    except Exception as e:
        print(f"Error testing model: {e}")

if __name__ == "__main__":
    main()
