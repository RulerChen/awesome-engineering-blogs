# Agent Rules

When tagging a blog entry, follow `docs/tags.md`. 
The vocabulary is `src/shared/tags.ts`, and the build rejects any id outside it. 
Every blog entry gets exactly one `domain` from the closed set there: `other` if nothing fits, never nothing at all.

Never write the comments more than one line.

Never use worktree to edit the repo. Always edit in the main branch and commit directly. 