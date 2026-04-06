# Security Policy

## ⚠️ Important Security Considerations

### Auto-Edit Risks

Qwen Loop runs AI coding agents in **`--yolo` mode** by default, which means:
- Agents can **read, modify, create, and delete files** in your working directory **without confirmation**
- There is **no human review** before changes are applied
- A poorly configured loop or vague task description could result in **unintended code changes**

### Best Practices

1. **Use a dedicated working directory** - Never set the working directory to your entire project root or system directories
2. **Use version control** - Always commit before running the loop so you can revert changes
3. **Start with `--max-concurrent-tasks: 1`** - Test with single tasks before scaling up
4. **Review logs regularly** - Check `logs/qwen-loop.log` for agent activity
5. **Use `.gitignore`** - Protect sensitive files from being tracked or modified
6. **Set appropriate timeouts** - Prevent agents from running indefinitely

### Sensitive Data

- **Never** include API keys, passwords, or secrets in your working directory
- Qwen agents may read files in the working directory
- Use `.env` files (already in `.gitignore`) for secrets

### Reporting a Vulnerability

If you discover a security vulnerability, please:
1. **Do not** open a public issue
2. Email: [your-email@example.com] *(update this)*
3. Include steps to reproduce and potential impact

We will respond within 48 hours and aim to release a fix within 7 days.
