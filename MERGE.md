# Merging `feature/pdf-rag-chat` into `main`

This document provides step-by-step instructions for merging the `feature/pdf-rag-chat` branch (which adds PDF upload and RAG chat functionality) into the `main` branch.

---

## 1. Merge via GitHub Pull Request (Recommended)

1. **Push your branch to GitHub (if not already pushed):**
   ```bash
   git push origin feature/pdf-rag-chat
   ```
2. **Go to your repository on GitHub.**
3. **Click the "Compare & pull request" button** for `feature/pdf-rag-chat`.
4. **Review the changes** and add a descriptive title and summary.
5. **Request reviews** if needed, then click **"Create pull request"**.
6. Once approved, click **"Merge pull request"** and confirm the merge.
7. **Pull the latest changes to your local main branch:**
   ```bash
   git checkout main
   git pull origin main
   ```

---

## 2. Merge via GitHub CLI

1. **Push your branch to GitHub (if not already pushed):**
   ```bash
   git push origin feature/pdf-rag-chat
   ```
2. **Create a pull request from the CLI:**
   ```bash
   gh pr create --base main --head feature/pdf-rag-chat --title "PDF RAG Chat Feature" --body "Adds PDF upload and retrieval-augmented generation chat functionality."
   ```
3. **Review and merge the PR:**
   ```bash
   gh pr view --web
   # (Review in browser, then merge)
   # Or merge directly from CLI:
   gh pr merge --merge
   ```
4. **Pull the latest changes to your local main branch:**
   ```bash
   git checkout main
   git pull origin main
   ```

---

## Notes
- Ensure all tests pass and the app works as expected before merging.
- Resolve any merge conflicts if prompted.
- After merging, delete the `feature/pdf-rag-chat` branch if it is no longer needed. 