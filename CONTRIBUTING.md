# Contributing to Qwen Loop

Thank you for your interest in contributing! Here's how you can help:

## 🐛 Reporting Bugs

- Check the [Issues](https://github.com/tang-vu/Qwen-Loop/issues) page first
- Use the bug report template
- Include:
  - Node.js version (`node --version`)
  - Qwen Code CLI version (`qwen --version`)
  - Steps to reproduce
  - Logs from `logs/qwen-loop.log`

## ✨ Requesting Features

- Open a feature request issue
- Describe the use case and why it's valuable
- Keep scope focused - one feature per issue

## 🔧 Pull Requests

### Before You Start

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Run `npm install` and `npx tsc --noEmit` to verify setup

### Code Standards

- **TypeScript strict mode** - no `any` unless absolutely necessary
- **ESM imports** - use `.js` extension for local imports
- **No console.log** - use the `logger` module instead
- **Test your changes** - run `npx tsc --noEmit` before committing

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Claude agent support
fix: handle Windows spawn ENOENT error
docs: update README with new config options
chore: bump version to 1.1.0
```

### Before Submitting

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Commit messages follow conventions
- [ ] README/docs updated if behavior changed
- [ ] No sensitive data (API keys, etc.) in code or commits

## 📖 Documentation

Docs improvements are always welcome! Fix typos, add examples, clarify confusing sections.

## 🚀 Development Workflow

```bash
# Install deps
npm install

# Type check
npx tsc --noEmit

# Run in dev mode (auto-reload)
npm run dev

# Test the CLI
npm start -- <command>
```

## Questions?

Open a [Discussion](https://github.com/tang-vu/Qwen-Loop/discussions) or tag maintainers in issues/PRs.
