import os
import glob

# 1. Create config.ts
with open("src/config.ts", "w") as f:
    f.write('export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";\n')

# 2. Update files
files_to_update = [
    "src/App.tsx",
    "src/context/AuthContext.tsx",
    "src/components/ShareDocumentDialog.tsx",
    "src/components/ProfileModal.tsx",
    "src/pages/Login.tsx",
    "src/pages/Search.tsx",
    "src/pages/SharedDocuments.tsx",
    "src/pages/PendingReviews.tsx",
    "src/pages/Documents.tsx",
    "src/pages/AdminDashboard.tsx"
]

target_str = "http://${window.location.hostname}:8000"

for filepath in files_to_update:
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            content = f.read()
            
        if target_str in content:
            # Need to determine the relative path for import
            # If in src/, it's ./config
            # If in src/pages/, it's ../config
            # If in src/components/, it's ../config
            depth = filepath.count('/') - 1
            import_path = "../" * depth + "config"
            if depth == 0:
                import_path = "./config"
            
            import_stmt = f'import {{ API_BASE_URL }} from "{import_path}";\n'
            
            # Insert import at the top of the file after the other imports
            # or simply at the very beginning
            new_content = import_stmt + content
            
            # Replace the target string
            new_content = new_content.replace(target_str, "${API_BASE_URL}")
            
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Updated {filepath}")
        else:
            print(f"Target string not found in {filepath}")
    else:
        print(f"File {filepath} not found")

